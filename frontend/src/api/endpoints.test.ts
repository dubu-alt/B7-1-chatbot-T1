import axios from 'axios'
import { delay, http, HttpResponse } from 'msw'
import { beforeAll, describe, expect, it } from 'vitest'

import { server } from '@/test/server'
import { saveTokens } from '@/utils/tokenStorage'
import type { ApiError } from './ApiError'
import { isApiError } from './ApiError'
import { getAdminFailures, getAdminStats, getAdminUserChats, getAdminUsers, getRequestLogs } from './admin'
import { login, logout, me, refresh, signup } from './auth'
import { sendMessage } from './chat'
import { instance } from './instance'
import { getMyChats } from './logs'
import { RESULT_CODE } from './types'

const BASE = 'https://api.test'

beforeAll(() => {
  instance.defaults.baseURL = BASE
})

const TOKENS = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  token_type: 'bearer',
  expires_in: 900,
  refresh_expires_in: 86_400,
}

describe('auth 엔드포인트', () => {
  it('signup 은 입력을 그대로 보내고 생성된 사용자를 돌려준다', async () => {
    let received: unknown = null
    server.use(
      http.post(`${BASE}/api/auth/signup`, async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({
          code: 201,
          data: {
            email: 'user@example.com',
            nickname: '테스터',
            created_at: '2026-09-17T10:00:00+09:00',
          },
        })
      }),
    )

    const user = await signup({
      email: 'user@example.com',
      password: 'password1234',
      nickname: '테스터',
    })

    expect(received).toEqual({
      email: 'user@example.com',
      password: 'password1234',
      nickname: '테스터',
    })
    expect(user.email).toBe('user@example.com')
    expect(user.created_at).toBe('2026-09-17T10:00:00+09:00')
  })

  it('login 은 토큰 쌍을 돌려준다', async () => {
    server.use(
      http.post(`${BASE}/api/auth/login`, () => HttpResponse.json({ code: 200, data: TOKENS })),
    )

    const tokens = await login({ email: 'user@example.com', password: 'password1234' })

    expect(tokens.access_token).toBe('access-1')
    expect(tokens.refresh_expires_in).toBe(86_400)
  })

  it('refresh 는 refresh token 을 body 로 보낸다 (쿠키를 쓰지 않는다)', async () => {
    let received: unknown = null
    server.use(
      http.post(`${BASE}/api/auth/refresh`, async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({ code: 200, data: TOKENS })
      }),
    )

    await refresh({ refresh_token: 'refresh-0' })

    expect(received).toEqual({ refresh_token: 'refresh-0' })
  })

  it('logout 은 refresh token 만 보내고 반환값이 없다', async () => {
    let received: unknown = null
    server.use(
      http.post(`${BASE}/api/auth/logout`, async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({ code: 200, data: {} })
      }),
    )

    const result = await logout({ refresh_token: 'refresh-1' })

    expect(received).toEqual({ refresh_token: 'refresh-1' })
    expect(result).toBeUndefined()
  })

  it('me 는 role 을 포함한 사용자 정보를 돌려준다', async () => {
    saveTokens('access-1', 'refresh-1')
    server.use(
      http.get(`${BASE}/api/auth/me`, () =>
        HttpResponse.json({
          code: 200,
          data: { email: 'admin@example.com', nickname: '관리자', role: 'admin' },
        }),
      ),
    )

    const user = await me()

    expect(user.role).toBe('admin')
  })
})

describe('chat 엔드포인트', () => {
  it('sendMessage 는 질문을 보내고 답변을 돌려준다', async () => {
    saveTokens('access-1', 'refresh-1')
    let received: unknown = null
    server.use(
      http.post(`${BASE}/api/chat`, async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({
          code: 200,
          data: {
            chat_id: '6f1c2b9e-3d4a-4e5f-8a7b-1c2d3e4f5a6b',
            question: 'FastAPI에서 CORS 설정은?',
            answer: 'CORSMiddleware 를 사용합니다.',
            created_at: '2026-09-17T10:05:12+09:00',
          },
        })
      }),
    )

    const result = await sendMessage({ message: 'FastAPI에서 CORS 설정은?' })

    expect(received).toEqual({ message: 'FastAPI에서 CORS 설정은?' })
    expect(result.chat_id).toBe('6f1c2b9e-3d4a-4e5f-8a7b-1c2d3e4f5a6b')
  })
})

describe('logs 엔드포인트', () => {
  it('getMyChats 는 기본 limit 20 · offset 0 으로 조회한다', async () => {
    saveTokens('access-1', 'refresh-1')
    let url: URL | null = null
    server.use(
      http.get(`${BASE}/api/me/chats`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ code: 200, data: { total: 0, items: [] } })
      }),
    )

    await getMyChats()

    expect(url!.searchParams.get('limit')).toBe('20')
    expect(url!.searchParams.get('offset')).toBe('0')
  })

  it('[더 보기] 처럼 offset 을 올려 조회할 수 있다', async () => {
    saveTokens('access-1', 'refresh-1')
    let url: URL | null = null
    server.use(
      http.get(`${BASE}/api/me/chats`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          code: 200,
          data: {
            total: 42,
            items: [
              {
                chat_id: 'c-1',
                question: 'q',
                answer: 'a',
                created_at: '2026-09-17T10:00:00+09:00',
              },
            ],
          },
        })
      }),
    )

    const result = await getMyChats({ limit: 10, offset: 20 })

    expect(url!.searchParams.get('limit')).toBe('10')
    expect(url!.searchParams.get('offset')).toBe('20')
    expect(result.total).toBe(42)
    expect(result.items).toHaveLength(1)
  })
})

describe('admin 엔드포인트', () => {
  /** 요청 주소(경로+쿼리)를 기록하고 빈 목록을 돌려준다 */
  function recordGet(path: string, data: unknown = { total: 0, items: [] }) {
    const urls: string[] = []
    server.use(
      http.get(`${BASE}${path}`, ({ request }) => {
        const url = new URL(request.url)
        urls.push(url.pathname + url.search)
        return HttpResponse.json({ code: 200, data })
      }),
    )
    return urls
  }

  it('통계를 돌려준다', async () => {
    recordGet('/api/admin/stats', { users: 3 })
    expect(await getAdminStats()).toEqual({ users: 3 })
  })

  it('사용자 목록은 검색어가 있을 때만 q 를 보낸다', async () => {
    const urls = recordGet('/api/admin/users')
    await getAdminUsers()
    await getAdminUsers({ q: 'kim', offset: 20 })
    expect(urls).toEqual(['/api/admin/users?limit=20&offset=0', '/api/admin/users?q=kim&limit=20&offset=20'])
  })

  it('사용자별 대화·실패 기록은 limit·offset 을 보낸다', async () => {
    const chats = recordGet('/api/admin/users/:id/chats')
    const failures = recordGet('/api/admin/failures')
    await getAdminUserChats(12, { offset: 40 })
    await getAdminFailures()
    expect(chats).toEqual(['/api/admin/users/12/chats?limit=20&offset=40'])
    expect(failures).toEqual(['/api/admin/failures?limit=20&offset=0'])
  })

  it('request_id 는 주소에 안전하게 넣는다', async () => {
    const urls = recordGet('/api/admin/requests/:id/logs', { request_id: 'a/b', items: [] })
    await getRequestLogs('a/b')
    expect(urls).toEqual(['/api/admin/requests/a%2Fb/logs'])
  })

  it('관리자가 아니면 403 ApiError', async () => {
    server.use(
      http.get(`${BASE}/api/admin/stats`, () =>
        HttpResponse.json({ code: 403, data: { message: '관리자만 접근할 수 있습니다.' } }),
      ),
    )
    const error = (await getAdminStats().catch((e: unknown) => e)) as ApiError
    expect(isApiError(error)).toBe(true)
    expect(error.code).toBe(RESULT_CODE.forbidden)
    expect(error.message).toBe('관리자만 접근할 수 있습니다.')
  })
})

describe('엔드포인트 공통 동작', () => {
  it('실패는 ApiError 로 전파된다', async () => {
    server.use(
      http.post(`${BASE}/api/auth/signup`, () =>
        HttpResponse.json({ code: 409, data: { message: '이미 가입된 이메일입니다.' } }),
      ),
    )

    const error = await signup({
      email: 'user@example.com',
      password: 'password1234',
      nickname: '테스터',
    }).catch((e: unknown) => e)

    expect(isApiError(error)).toBe(true)
    expect((error as ApiError).code).toBe(RESULT_CODE.conflict)
    expect((error as ApiError).message).toBe('이미 가입된 이메일입니다.')
  })

  it('signal 을 넘기면 요청을 취소할 수 있다', async () => {
    saveTokens('access-1', 'refresh-1')
    server.use(
      http.get(`${BASE}/api/me/chats`, async () => {
        await delay(50)
        return HttpResponse.json({ code: 200, data: { total: 0, items: [] } })
      }),
    )

    const controller = new AbortController()
    const promise = getMyChats({}, controller.signal)
    controller.abort()

    const error = await promise.catch((e: unknown) => e)

    expect(axios.isCancel(error)).toBe(true)
  })
})
