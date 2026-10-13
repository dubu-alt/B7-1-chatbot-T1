import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, describe, expect, it } from 'vitest'

import { instance } from '@/api/instance'
import { AuthProvider } from '@/store/AuthProvider'
import { server } from '@/test/server'
import { getAccessToken } from '@/utils/tokenStorage'
import LoginPage from './LoginPage'

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

const USER = { email: 'user@example.com', nickname: '테스터', role: 'user' }

function mockLoginSuccess() {
  server.use(
    http.post(`${BASE}/api/auth/login`, () => HttpResponse.json({ code: 200, data: TOKENS })),
    http.get(`${BASE}/api/auth/me`, () => HttpResponse.json({ code: 200, data: USER })),
  )
}

function mockLoginFailure() {
  server.use(
    http.post(`${BASE}/api/auth/login`, () =>
      HttpResponse.json({
        code: 401,
        data: { message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
      }),
    ),
  )
}

/** location.state 를 함께 넘길 수 있도록 initialEntries 를 객체로 준다 */
function renderLogin(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/chat" element={<h1>챗 도착</h1>} />
          <Route path="/logs" element={<h1>로그 도착</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const emailInput = () => screen.getByLabelText('이메일')
const passwordInput = () => screen.getByLabelText('비밀번호')
const submitButton = () => screen.getByRole('button', { name: '로그인' })

describe('로그인 — 입력과 제출', () => {
  it('입력 전에는 제출 버튼이 잠겨 있다', () => {
    renderLogin()

    expect(submitButton()).toBeDisabled()
  })

  it('이메일과 비밀번호를 채우면 제출할 수 있다', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(emailInput(), 'user@example.com')
    await user.type(passwordInput(), 'password1234')

    expect(submitButton()).toBeEnabled()
  })

  it('비밀번호는 길이를 검사하지 않는다 (가입 시점 규칙이라 기존 계정을 막으면 안 된다)', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(emailInput(), 'user@example.com')
    await user.type(passwordInput(), 'old')

    expect(submitButton()).toBeEnabled()
  })
})

describe('로그인 — 성공 후 이동', () => {
  it('토큰을 저장하고 챗으로 이동한다', async () => {
    const user = userEvent.setup()
    mockLoginSuccess()
    renderLogin()

    await user.type(emailInput(), 'user@example.com')
    await user.type(passwordInput(), 'password1234')
    await user.click(submitButton())

    expect(await screen.findByRole('heading', { name: '챗 도착' })).toBeTruthy()
    expect(getAccessToken()).toBe('access-1')
  })

  it('원래 가려던 경로가 있으면 그곳으로 돌아간다', async () => {
    const user = userEvent.setup()
    mockLoginSuccess()
    // RequireAuth 가 넘기는 형태
    renderLogin({ from: { pathname: '/logs' } })

    await user.type(emailInput(), 'user@example.com')
    await user.type(passwordInput(), 'password1234')
    await user.click(submitButton())

    expect(await screen.findByRole('heading', { name: '로그 도착' })).toBeTruthy()
  })
})

describe('로그인 — 실패 처리', () => {
  it('401 이면 안내를 보여주고 비밀번호만 비운다', async () => {
    const user = userEvent.setup()
    mockLoginFailure()
    renderLogin()

    await user.type(emailInput(), 'user@example.com')
    await user.type(passwordInput(), 'wrong-password')
    await user.click(submitButton())

    expect(await screen.findByText('이메일 또는 비밀번호가 올바르지 않습니다.')).toBeTruthy()
    // 이메일까지 지우면 다시 입력해야 한다
    expect(emailInput()).toHaveValue('user@example.com')
    expect(passwordInput()).toHaveValue('')
  })

  it('401 이어도 화면을 벗어나지 않는다 (전역 로그아웃이 아니다)', async () => {
    const user = userEvent.setup()
    mockLoginFailure()
    renderLogin()

    await user.type(emailInput(), 'user@example.com')
    await user.type(passwordInput(), 'wrong-password')
    await user.click(submitButton())

    expect(await screen.findByText('이메일 또는 비밀번호가 올바르지 않습니다.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '챗 도착' })).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('서버에 닿지 못하면 연결 실패를 안내한다', async () => {
    const user = userEvent.setup()
    server.use(http.post(`${BASE}/api/auth/login`, () => HttpResponse.error()))
    renderLogin()

    await user.type(emailInput(), 'user@example.com')
    await user.type(passwordInput(), 'password1234')
    await user.click(submitButton())

    expect(await screen.findByText(/서버에 연결할 수 없습니다/)).toBeTruthy()
  })
})

describe('로그인 — 회원가입에서 넘어온 경우', () => {
  it('가입 완료 안내를 보여주고 이메일을 채워 둔다', () => {
    renderLogin({ signedUpEmail: 'new@example.com' })

    expect(screen.getByRole('status')).toHaveTextContent('가입이 완료되었습니다')
    expect(emailInput()).toHaveValue('new@example.com')
  })

  it('그냥 들어오면 안내가 없고 이메일도 비어 있다', () => {
    renderLogin()

    expect(screen.queryByRole('status')).toBeNull()
    expect(emailInput()).toHaveValue('')
  })
})

describe('이동 안내 문장 (#42)', () => {
  it('문장 전체가 하나의 링크다', () => {
    renderLogin()

    const guide = screen.getByRole('link', { name: '아직 계정이 없나요? 회원가입' })
    expect(guide).toHaveAttribute('href', '/signup')
  })
})
