import axios from 'axios'
import { delay, http, HttpResponse } from 'msw'
import { beforeAll, describe, expect, it } from 'vitest'

import { server } from '@/test/server'
import { saveTokens } from '@/utils/tokenStorage'
import { ApiError, isApiError } from '../ApiError'
import { instance } from '../instance'
import { RESULT_CODE } from '../types'

const BASE = 'https://api.test'

beforeAll(() => {
  // 테스트 모드에는 .env 가 없어 VITE_API_BASE_URL 이 비어 있다. 명시적으로 지정한다
  instance.defaults.baseURL = BASE
})

describe('normalize — 성공 응답', () => {
  it('code 가 2xx 면 봉투를 벗겨 data 를 돌려준다', async () => {
    server.use(
      http.get(`${BASE}/api/me/chats`, () =>
        HttpResponse.json({ code: 200, data: { total: 1, items: [] } }),
      ),
    )

    const res = await instance.get('/api/me/chats')

    expect(res.data).toEqual({ total: 1, items: [] })
  })

  it('회원가입의 code 201 도 성공으로 처리한다', async () => {
    server.use(
      http.post(`${BASE}/api/auth/signup`, () =>
        HttpResponse.json({ code: 201, data: { email: 'a@b.c', nickname: '테스터' } }),
      ),
    )

    const res = await instance.post('/api/auth/signup', {})

    expect(res.data).toMatchObject({ email: 'a@b.c' })
  })
})

describe('normalize — 서버가 처리한 실패', () => {
  it('code 가 4xx 면 ApiError 로 바꿔 던진다', async () => {
    server.use(
      http.post(`${BASE}/api/chat`, () =>
        HttpResponse.json({ code: 422, data: { message: '질문은 1~1000자로 입력해 주세요.' } }),
      ),
    )

    const error = await instance.post('/api/chat', {}).catch((e: unknown) => e)

    expect(isApiError(error)).toBe(true)
    expect((error as ApiError).code).toBe(RESULT_CODE.validationError)
    expect((error as ApiError).message).toBe('질문은 1~1000자로 입력해 주세요.')
  })

  it('ApiError 는 Error 파생이라 instanceof 로 판별된다', async () => {
    server.use(
      http.get(`${BASE}/api/auth/me`, () =>
        HttpResponse.json({ code: 401, data: { message: '로그인이 필요합니다.' } }),
      ),
    )

    const error = await instance.get('/api/auth/me').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiError)
  })

  it('안내 문구가 없으면 기본 문구를 쓴다', async () => {
    server.use(http.get(`${BASE}/api/x`, () => HttpResponse.json({ code: 500, data: {} })))

    const error = (await instance.get('/api/x').catch((e: unknown) => e)) as ApiError

    expect(error.code).toBe(RESULT_CODE.internalError)
    expect(error.message).toBe('요청을 처리하지 못했습니다.')
  })

  it('429 는 서버 문구와 관계없이 정해진 안내 문구를 쓴다', async () => {
    server.use(http.post(`${BASE}/api/auth/login`, () => HttpResponse.json({ code: 429, data: { message: 'Too Many Requests' } })))

    const error = (await instance.post('/api/auth/login', {}).catch((e: unknown) => e)) as ApiError

    expect(error.code).toBe(RESULT_CODE.tooManyRequests)
    expect(error.message).toBe('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.')
  })
})

describe('normalize — 서버에 닿지 못한 실패', () => {
  it('body 에 code 가 없으면 연결 실패로 처리한다', async () => {
    server.use(http.get(`${BASE}/api/x`, () => HttpResponse.json({ detail: 'Not Found' })))

    const error = (await instance.get('/api/x').catch((e: unknown) => e)) as ApiError

    expect(error.code).toBe(RESULT_CODE.unreachable)
    expect(error.isUnreachable).toBe(true)
    expect(error.message).toContain('서버에 연결할 수 없습니다')
  })

  it('네트워크 오류도 같은 방식으로 처리한다', async () => {
    server.use(http.get(`${BASE}/api/x`, () => HttpResponse.error()))

    const error = (await instance.get('/api/x').catch((e: unknown) => e)) as ApiError

    expect(error.code).toBe(RESULT_CODE.unreachable)
  })

  it('HTTP 상태가 200 이 아니어도 봉투가 아니면 연결 실패로 본다', async () => {
    server.use(http.get(`${BASE}/api/x`, () => new HttpResponse(null, { status: 502 })))

    const error = (await instance.get('/api/x').catch((e: unknown) => e)) as ApiError

    expect(error.code).toBe(RESULT_CODE.unreachable)
  })
})

describe('normalize — 요청 취소', () => {
  it('취소는 오류로 바꾸지 않고 그대로 통과시킨다', async () => {
    server.use(
      http.get(`${BASE}/api/me/chats`, async () => {
        await delay(50)
        return HttpResponse.json({ code: 200, data: {} })
      }),
    )

    const controller = new AbortController()
    const promise = instance.get('/api/me/chats', { signal: controller.signal })
    controller.abort()

    const error = await promise.catch((e: unknown) => e)

    expect(axios.isCancel(error)).toBe(true)
    expect(isApiError(error)).toBe(false)
  })
})

describe('attachToken', () => {
  it('토큰이 있으면 Authorization 헤더를 붙인다', async () => {
    saveTokens('access-1', 'refresh-1')
    let received: string | null = null
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        received = request.headers.get('Authorization')
        return HttpResponse.json({ code: 200, data: {} })
      }),
    )

    await instance.get('/api/auth/me')

    expect(received).toBe('Bearer access-1')
  })

  it('토큰이 없으면 헤더를 붙이지 않는다', async () => {
    let received: string | null = 'not-set'
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        received = request.headers.get('Authorization')
        return HttpResponse.json({ code: 200, data: {} })
      }),
    )

    await instance.get('/api/auth/me')

    expect(received).toBeNull()
  })
})
