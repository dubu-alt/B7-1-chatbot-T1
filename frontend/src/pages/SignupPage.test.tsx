import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, describe, expect, it } from 'vitest'

import { instance } from '@/api/instance'
import { server } from '@/test/server'
import SignupPage from './SignupPage'

const BASE = 'https://api.test'

beforeAll(() => {
  instance.defaults.baseURL = BASE
})

/** 이동 결과를 확인하기 위해 로그인 자리에 state 를 그대로 드러내는 화면을 둔다 */
function LoginStub() {
  return <h1>로그인 도착</h1>
}

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

const fill = async (user: ReturnType<typeof userEvent.setup>, values: {
  email?: string
  password?: string
  nickname?: string
}) => {
  if (values.email !== undefined) await user.type(screen.getByLabelText('이메일'), values.email)
  if (values.password !== undefined) await user.type(screen.getByLabelText('비밀번호'), values.password)
  if (values.nickname !== undefined) await user.type(screen.getByLabelText('닉네임'), values.nickname)
}

const submitButton = () => screen.getByRole('button', { name: '가입하기' })

describe('회원가입 — 클라이언트 검증', () => {
  it('입력 전에는 제출 버튼이 잠겨 있다', () => {
    renderSignup()

    expect(submitButton()).toBeDisabled()
  })

  it('비밀번호가 8자 미만이면 제출할 수 없다', async () => {
    const user = userEvent.setup()
    renderSignup()

    await fill(user, { email: 'user@example.com', password: 'short', nickname: '테스터' })

    expect(submitButton()).toBeDisabled()
  })

  it('이메일 형식이 잘못되면 포커스를 벗어난 뒤 오류를 보여준다', async () => {
    const user = userEvent.setup()
    renderSignup()

    await user.type(screen.getByLabelText('이메일'), 'not-an-email')
    // 입력 중에는 아직 나무라지 않는다
    expect(screen.queryByText('이메일 형식이 올바르지 않습니다.')).toBeNull()

    await user.tab()

    expect(screen.getByText('이메일 형식이 올바르지 않습니다.')).toBeTruthy()
  })

  it('모든 값이 올바르면 제출 버튼이 열린다', async () => {
    const user = userEvent.setup()
    renderSignup()

    await fill(user, { email: 'user@example.com', password: 'password1234', nickname: '테스터' })

    expect(submitButton()).toBeEnabled()
  })
})

describe('회원가입 — 서버 응답 처리', () => {
  it('성공하면 로그인 화면으로 이동한다', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${BASE}/api/auth/signup`, () =>
        HttpResponse.json({
          code: 201,
          data: {
            email: 'user@example.com',
            nickname: '테스터',
            created_at: '2026-09-18T10:00:00+09:00',
          },
        }),
      ),
    )
    renderSignup()

    await fill(user, { email: 'user@example.com', password: 'password1234', nickname: '테스터' })
    await user.click(submitButton())

    expect(await screen.findByRole('heading', { name: '로그인 도착' })).toBeTruthy()
  })

  it('보낸 값에서 앞뒤 공백을 제거한다', async () => {
    const user = userEvent.setup()
    let received: unknown = null
    server.use(
      http.post(`${BASE}/api/auth/signup`, async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({
          code: 201,
          data: { email: 'user@example.com', nickname: '테스터', created_at: '' },
        })
      }),
    )
    renderSignup()

    await fill(user, { email: '  user@example.com  ', password: 'password1234', nickname: ' 테스터 ' })
    await user.click(submitButton())

    await waitFor(() =>
      expect(received).toEqual({
        email: 'user@example.com',
        password: 'password1234',
        nickname: '테스터',
      }),
    )
  })

  it('이메일이 중복되면 이메일 필드에 오류를 붙이고 포커스를 옮긴다', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${BASE}/api/auth/signup`, () =>
        HttpResponse.json({ code: 409, data: { message: '이미 가입된 이메일입니다.' } }),
      ),
    )
    renderSignup()

    await fill(user, { email: 'user@example.com', password: 'password1234', nickname: '테스터' })
    await user.click(submitButton())

    expect(await screen.findByText('이미 가입된 이메일입니다.')).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText('이메일')).toHaveFocus())
    // 화면 이동 없이 같은 자리에 머문다
    expect(screen.queryByRole('heading', { name: '로그인 도착' })).toBeNull()
  })

  it('중복 오류는 이메일을 고치면 사라진다', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${BASE}/api/auth/signup`, () =>
        HttpResponse.json({ code: 409, data: { message: '이미 가입된 이메일입니다.' } }),
      ),
    )
    renderSignup()
    await fill(user, { email: 'user@example.com', password: 'password1234', nickname: '테스터' })
    await user.click(submitButton())
    expect(await screen.findByText('이미 가입된 이메일입니다.')).toBeTruthy()

    await user.type(screen.getByLabelText('이메일'), 'x')

    expect(screen.queryByText('이미 가입된 이메일입니다.')).toBeNull()
  })

  it('서버 검증 실패(422)는 서버 문구를 그대로 보여준다', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${BASE}/api/auth/signup`, () =>
        HttpResponse.json({ code: 422, data: { message: '비밀번호는 8자 이상으로 입력해 주세요.' } }),
      ),
    )
    renderSignup()

    await fill(user, { email: 'user@example.com', password: 'password1234', nickname: '테스터' })
    await user.click(submitButton())

    expect(await screen.findByText('비밀번호는 8자 이상으로 입력해 주세요.')).toBeTruthy()
  })

  it('서버에 닿지 못하면 연결 실패를 안내한다', async () => {
    const user = userEvent.setup()
    server.use(http.post(`${BASE}/api/auth/signup`, () => HttpResponse.error()))
    renderSignup()

    await fill(user, { email: 'user@example.com', password: 'password1234', nickname: '테스터' })
    await user.click(submitButton())

    expect(await screen.findByText(/서버에 연결할 수 없습니다/)).toBeTruthy()
  })
})

describe('회원가입 — 입력 길이 상한 (#34)', () => {
  it('입력칸에 길이 상한이 걸려 있다', () => {
    renderSignup()

    expect(screen.getByLabelText('이메일')).toHaveAttribute('maxLength', '254')
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('maxLength', '128')
    expect(screen.getByLabelText('닉네임')).toHaveAttribute('maxLength', '20')
  })
})

describe('이동 안내 문장 (#42)', () => {
  it('문장 전체가 하나의 링크다', () => {
    renderSignup()

    const guide = screen.getByRole('link', { name: '이미 계정이 있나요? 로그인' })
    expect(guide).toHaveAttribute('href', '/login')
  })
})
