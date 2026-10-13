import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it } from 'vitest'

import { instance } from '@/api/instance'
import App from '@/App'
import { AuthProvider } from '@/store/AuthProvider'
import { ToastProvider } from '@/store/ToastProvider'
import { server } from '@/test/server'
import { getAccessToken, saveTokens } from '@/utils/tokenStorage'

const BASE = 'https://api.test'

// vite.config.ts 의 test.env 와 같은 값. 실제 관리자 주소는 .env 에만 둔다
const ADMIN_URL = '/test-admin-console'

beforeAll(() => {
  instance.defaults.baseURL = BASE
})

const USER = { email: 'user@example.com', nickname: '테스터', role: 'user' }
const ADMIN = { email: 'admin@example.com', nickname: '관리자님', role: 'admin' }

function mockMe(data: unknown, delayMs = 0) {
  server.use(
    http.get(`${BASE}/api/auth/me`, async () => {
      if (delayMs) await delay(delayMs)
      return HttpResponse.json({ code: 200, data })
    }),
  )
}

// 헤더는 레이아웃에 있으므로 레이아웃을 감싸는 App 을 렌더한다
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

// 헤더(banner) 안에서만 찾는다. 로그인 화면 본문에도 "회원가입" 링크가 있어 겹친다
const link = (name: string) => within(screen.getByRole('banner')).queryByRole('link', { name })

describe('헤더 — 인증 상태별 메뉴', () => {
  it('비로그인은 로그인 메뉴만 본다 (회원가입은 헤더에 없다)', () => {
    renderAt('/login')

    expect(link('로그인')).toBeInTheDocument()
    expect(link('회원가입')).toBeNull()
    expect(link('챗')).toBeNull()
    expect(link('내 대화 로그')).toBeNull()
    expect(screen.queryByRole('button', { name: '로그아웃' })).toBeNull()
  })

  it('로그인 사용자는 챗·내 대화 로그·닉네임·로그아웃을 본다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    renderAt('/chat')

    expect(await screen.findByRole('button', { name: '로그아웃' })).toBeInTheDocument()
    expect(link('챗')).toBeInTheDocument()
    expect(link('내 대화 로그')).toBeInTheDocument()
    expect(screen.getByText('테스터')).toBeInTheDocument()
    // 로그인한 사용자에게 로그인·회원가입 메뉴를 보여주지 않는다
    expect(link('회원가입')).toBeNull()
  })

  it('이메일은 노출하지 않는다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    renderAt('/chat')

    await screen.findByRole('button', { name: '로그아웃' })
    expect(screen.queryByText('user@example.com')).toBeNull()
  })

  it('일반 사용자에게는 관리자 탭이 없다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    renderAt('/chat')

    await screen.findByRole('button', { name: '로그아웃' })
    expect(link('관리자')).toBeNull()
  })

  it('관리자에게만 관리자 탭이 보인다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe(ADMIN)
    renderAt('/chat')

    await screen.findByRole('button', { name: '로그아웃' })
    // 탭은 환경변수로 지정한 주소로 연결된다
    expect(link('관리자')).toHaveAttribute('href', ADMIN_URL)
  })

  it('확인 중(저장된 토큰 있음)에도 메뉴는 먼저 그리고, 로그인 버튼은 그리지 않는다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe(USER, 50)
    renderAt('/chat')

    // 헤더 높이가 바뀌지 않도록 메뉴 틀은 먼저 그린다
    expect(link('챗')).toBeInTheDocument()
    expect(link('내 대화 로그')).toBeInTheDocument()
    expect(link('로그인')).toBeNull()

    expect(await screen.findByRole('button', { name: '로그아웃' })).toBeInTheDocument()
  })
})

describe('헤더 — 현재 메뉴 표시', () => {
  it('지금 있는 화면의 메뉴에 aria-current 가 붙는다', async () => {
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    renderAt('/logs')

    await screen.findByRole('button', { name: '로그아웃' })
    expect(link('내 대화 로그')).toHaveAttribute('aria-current', 'page')
    expect(link('챗')).not.toHaveAttribute('aria-current')
  })

  it('메뉴를 누르면 해당 화면으로 이동한다', async () => {
    const user = userEvent.setup()
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    renderAt('/chat')
    await screen.findByRole('button', { name: '로그아웃' })

    await user.click(link('내 대화 로그')!)

    expect(screen.getByRole('heading', { name: '내 대화 로그' })).toBeInTheDocument()
  })
})

describe('헤더 — 로그아웃', () => {
  it('서버에 refresh token 을 보내고 토큰을 지운 뒤 로그인 화면으로 간다', async () => {
    const user = userEvent.setup()
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    let received: unknown = null
    server.use(
      http.post(`${BASE}/api/auth/logout`, async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({ code: 200, data: {} })
      }),
    )
    renderAt('/chat')

    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument()
    expect(received).toEqual({ refresh_token: 'refresh-1' })
    expect(getAccessToken()).toBeNull()
  })

  it('로그아웃 요청이 실패해도 로그아웃된다', async () => {
    const user = userEvent.setup()
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    server.use(http.post(`${BASE}/api/auth/logout`, () => HttpResponse.error()))
    renderAt('/chat')

    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
  })

  it('로그아웃하면 헤더 아래에 "로그아웃되었습니다" 를 띄운다 (만료 알림은 아님)', async () => {
    const user = userEvent.setup()
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    server.use(http.post(`${BASE}/api/auth/logout`, () => HttpResponse.json({ code: 200, data: {} })))
    renderAt('/chat')

    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    const banner = screen.getByRole('banner')
    expect(await within(banner).findByText('로그아웃되었습니다.')).toBeInTheDocument()
    expect(screen.queryByText(/로그인이 만료되었습니다/)).toBeNull()
  })

  it('로그아웃 중에는 버튼을 잠근다', async () => {
    const user = userEvent.setup()
    saveTokens('access-1', 'refresh-1')
    mockMe(USER)
    server.use(
      http.post(`${BASE}/api/auth/logout`, async () => {
        await delay(100)
        return HttpResponse.json({ code: 200, data: {} })
      }),
    )
    renderAt('/chat')

    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '로그아웃 중…' })).toBeDisabled(),
    )
  })
})

describe('본문 바로가기', () => {
  it('화면 맨 앞에 "본문 바로가기" 링크가 있고 본문(main)을 가리킨다', async () => {
    renderAt('/login')
    const skip = screen.getByRole('link', { name: '본문 바로가기' })
    expect(skip).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')

    // 키보드로 처음 Tab 을 누르면 가장 먼저 닿는다
    await userEvent.tab()
    expect(skip).toHaveFocus()
  })
})

