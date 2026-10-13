import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeAll, describe, expect, it } from 'vitest'

import { instance } from '@/api/instance'
import { useAccessToken } from '@/hooks/useAccessToken'
import { useAuth } from '@/hooks/useAuth'
import { server } from '@/test/server'
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '@/utils/tokenStorage'
import { ToastRegion } from '@/components/Toast'
import { AuthProvider } from './AuthProvider'
import { ToastProvider } from './ToastProvider'

const BASE = 'https://api.test'

beforeAll(() => {
  instance.defaults.baseURL = BASE
})

const USER = { email: 'user@example.com', nickname: '테스터', role: 'user' }
const ADMIN = { email: 'admin@example.com', nickname: '관리자', role: 'admin' }

/** GET /api/auth/me 핸들러. 호출 횟수를 센다 */
function mockMe(data: unknown = USER, options: { fail?: boolean } = {}) {
  const calls = { count: 0 }
  server.use(
    http.get(`${BASE}/api/auth/me`, () => {
      calls.count += 1
      if (options.fail) {
        return HttpResponse.json({ code: 401, data: { message: '로그인이 필요합니다.' } })
      }
      return HttpResponse.json({ code: 200, data })
    }),
  )
  return calls
}

/** 현재 인증 상태를 화면에 드러내는 검사용 컴포넌트 */
function Probe() {
  const { status, user } = useAuth()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="nickname">{user?.nickname ?? '-'}</span>
      <span data-testid="role">{user?.role ?? '-'}</span>
    </div>
  )
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

describe('AuthProvider — 상태 전이', () => {
  it('토큰이 없으면 anonymous 이고 서버에 묻지 않는다', () => {
    const meCalls = mockMe()

    renderProbe()

    expect(screen.getByTestId('status').textContent).toBe('anonymous')
    expect(meCalls.count).toBe(0)
  })

  it('토큰이 있으면 checking 을 거쳐 authenticated 가 된다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe()

    renderProbe()

    expect(screen.getByTestId('status').textContent).toBe('checking')
    expect(await screen.findByText('authenticated')).toBeTruthy()
    expect(screen.getByTestId('nickname').textContent).toBe('테스터')
  })

  it('role 을 그대로 전달한다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe(ADMIN)

    renderProbe()

    expect(await screen.findByText('authenticated')).toBeTruthy()
    expect(screen.getByTestId('role').textContent).toBe('admin')
  })

  it('앱이 떠 있는 동안 /api/auth/me 를 한 번만 호출한다', async () => {
    saveTokens('access-1', 'refresh-1')
    const meCalls = mockMe()

    const { rerender } = renderProbe()
    expect(await screen.findByText('authenticated')).toBeTruthy()

    rerender(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(meCalls.count).toBe(1)
  })
})

describe('AuthProvider — 토큰 구독 연결', () => {
  it('인터셉터처럼 clearTokens() 만 호출해도 anonymous 로 바뀐다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe()

    renderProbe()
    expect(await screen.findByText('authenticated')).toBeTruthy()

    // 재발급이 최종 실패했을 때 인터셉터가 하는 일과 동일하다
    act(() => clearTokens())

    expect(screen.getByTestId('status').textContent).toBe('anonymous')
    expect(screen.getByTestId('nickname').textContent).toBe('-')
  })

  it('다른 탭에서 로그아웃하면(storage 이벤트) 이 탭도 anonymous 가 된다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe()

    renderProbe()
    expect(await screen.findByText('authenticated')).toBeTruthy()

    act(() => {
      localStorage.removeItem('auth:access_token')
      window.dispatchEvent(new StorageEvent('storage', { key: 'auth:access_token' }))
    })

    expect(screen.getByTestId('status').textContent).toBe('anonymous')
  })

  it('/api/auth/me 가 실패하면 토큰을 정리하고 anonymous 가 된다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe(null, { fail: true })
    // 재발급도 실패시켜 인터셉터가 로그인 상태를 되살리지 못하게 한다
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json({ code: 401, data: { message: '로그인이 필요합니다.' } }),
      ),
    )

    renderProbe()

    expect(await screen.findByText('anonymous')).toBeTruthy()
    expect(getAccessToken()).toBeNull()
  })
})

describe('AuthProvider — login / logout', () => {
  it('login 은 토큰을 저장하고 이어서 사용자 정보를 불러온다', async () => {
    const meCalls = mockMe()
    server.use(
      http.post(`${BASE}/api/auth/login`, () =>
        HttpResponse.json({
          code: 200,
          data: {
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            token_type: 'bearer',
            expires_in: 900,
            refresh_expires_in: 86_400,
          },
        }),
      ),
    )

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    expect(result.current.status).toBe('anonymous')

    await act(() => result.current.login('user@example.com', 'password1234'))

    expect(getAccessToken()).toBe('access-1')
    expect(getRefreshToken()).toBe('refresh-1')
    expect(result.current.status).toBe('authenticated')
    expect(meCalls.count).toBe(1)
  })

  it('logout 은 refresh token 을 서버에 보내고 토큰을 지운다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe()
    let received: unknown = null
    server.use(
      http.post(`${BASE}/api/auth/logout`, async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({ code: 200, data: {} })
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    await act(async () => {
      await Promise.resolve()
    })

    await act(() => result.current.logout())

    expect(received).toEqual({ refresh_token: 'refresh-1' })
    expect(getAccessToken()).toBeNull()
    expect(result.current.status).toBe('anonymous')
  })

  it('로그아웃 요청이 실패해도 토큰을 지운다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe()
    server.use(http.post(`${BASE}/api/auth/logout`, () => HttpResponse.error()))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await act(() => result.current.logout().catch(() => undefined))

    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(result.current.status).toBe('anonymous')
  })
})

describe('useAuth', () => {
  it('Provider 밖에서 쓰면 오류를 던진다', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/)
  })
})

describe('useAccessToken', () => {
  it('토큰 변화를 구독해 최신 값을 돌려준다', () => {
    const { result } = renderHook(() => useAccessToken())

    expect(result.current).toBeNull()

    act(() => saveTokens('access-1', 'refresh-1'))
    expect(result.current).toBe('access-1')

    act(() => clearTokens())
    expect(result.current).toBeNull()
  })
})

describe('AuthProvider — 계정 전환과 일시 실패 (#34)', () => {
  function mockLoginAs(user: unknown, token: string) {
    server.use(
      http.post(`${BASE}/api/auth/login`, () =>
        HttpResponse.json({
          code: 200,
          data: {
            access_token: token,
            refresh_token: `${token}-r`,
            token_type: 'bearer',
            expires_in: 900,
            refresh_expires_in: 86_400,
          },
        }),
      ),
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        const auth = request.headers.get('Authorization')
        return HttpResponse.json({ code: 200, data: auth === `Bearer ${token}` ? user : USER })
      }),
    )
  }

  it('토큰만 지워진 뒤 다른 계정으로 로그인하면 새 사용자로 판정한다', async () => {
    saveTokens('access-user', 'refresh-user')
    mockMe(USER)
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.user?.role).toBe('user'))

    // 재발급 최종 실패 — 인터셉터는 토큰만 지운다
    act(() => clearTokens())
    expect(result.current.status).toBe('anonymous')

    mockLoginAs(ADMIN, 'access-admin')
    await act(() => result.current.login('admin@example.com', 'admin1234'))

    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.user?.role).toBe('admin')
  })

  it('다시 로그인한 직후 이전 사용자를 한 순간도 보여주지 않는다', async () => {
    saveTokens('access-user', 'refresh-user')
    mockMe(USER)
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.user).not.toBeNull())
    act(() => clearTokens())

    act(() => saveTokens('access-admin', 'refresh-admin'))

    // 확인 전에는 checking — 이전 사용자(일반)로 판정되면 가드가 /admin 에서 튕긴다
    expect(result.current.status).toBe('checking')
    expect(result.current.user).toBeNull()
  })

  it('연결 실패로 확인하지 못해도 토큰을 지우지 않는다 (다른 탭 보호)', async () => {
    saveTokens('access-1', 'refresh-1')
    server.use(http.get(`${BASE}/api/auth/me`, () => HttpResponse.error()))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    expect(getAccessToken()).toBe('access-1')
  })

  it('재발급으로 토큰이 회전돼도 재확인 동안 로그인 상태를 유지한다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    act(() => saveTokens('access-2', 'refresh-2'))

    // checking 으로 떨어지면 가드가 화면을 비워 15분마다 깜빡인다
    expect(result.current.status).toBe('authenticated')
    expect(result.current.user?.nickname).toBe('테스터')
  })
})

describe('AuthProvider — 로그인 만료 알림', () => {
  function renderWithToasts() {
    render(
      <ToastProvider>
        <AuthProvider>
          <Probe />
        </AuthProvider>
        <ToastRegion />
      </ToastProvider>,
    )
  }

  it('재발급 실패로 토큰이 지워지면 "로그인이 만료되었습니다" 를 띄운다', async () => {
    mockMe(USER)
    saveTokens('access-1', 'refresh-1')
    renderWithToasts()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

    act(() => clearTokens('expired'))

    expect(await screen.findByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).toBeInTheDocument()
  })

  it('직접 로그아웃하거나 다른 이유로 지워지면 만료 알림을 띄우지 않는다', async () => {
    mockMe(USER)
    saveTokens('access-1', 'refresh-1')
    renderWithToasts()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

    act(() => clearTokens())

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(screen.queryByText(/로그인이 만료되었습니다/)).toBeNull()
  })
})
