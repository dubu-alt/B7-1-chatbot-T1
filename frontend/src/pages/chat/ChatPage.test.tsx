import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import type { JsonBodyType } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it } from 'vitest'

import { instance } from '@/api/instance'
import { ToastRegion } from '@/components/Toast'
import { ToastProvider } from '@/store/ToastProvider'
import { server } from '@/test/server'
import ChatPage from './ChatPage'

const BASE = 'https://api.test'

beforeAll(() => {
  instance.defaults.baseURL = BASE
})

const item = (id: number, q: string, a: string) => ({
  chat_id: `c-${id}`,
  question: q,
  answer: a,
  created_at: '2026-09-28T10:00:00+09:00',
})

function mockHistory(items: unknown[] = []) {
  server.use(
    http.get(`${BASE}/api/me/chats`, () =>
      HttpResponse.json({ code: 200, data: { total: items.length, items } }),
    ),
  )
}

function mockChat(respond: (message: string) => JsonBodyType) {
  const sent: string[] = []
  server.use(
    http.post(`${BASE}/api/chat`, async ({ request }) => {
      const { message } = (await request.json()) as { message: string }
      sent.push(message)
      await delay(20)
      return HttpResponse.json(respond(message))
    }),
  )
  return sent
}

const ok = (message: string) => ({
  code: 200,
  data: { chat_id: 'c-99', question: message, answer: `답: ${message}`, created_at: '2026-09-28T10:05:00+09:00' },
})
const timeout = { code: 504, data: { message: '현재 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.' } }

function renderChat() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <ChatPage />
        <ToastRegion />
      </ToastProvider>
    </MemoryRouter>,
  )
}

const bubbles = () => within(screen.getByRole('list', { name: '대화' })).queryAllByRole('listitem')
const kinds = () => bubbles().map((li) => li.dataset.kind)

async function ask(question: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('질문'), `${question}{Enter}`)
}

describe('챗 — 이전 대화 복원', () => {
  it('진입하면 이전 대화를 불러와 오래된 것부터 보여준다', async () => {
    // 서버는 최신순으로 준다
    mockHistory([item(2, '두 번째 질문', '두 번째 답'), item(1, '첫 질문', '첫 답')])
    renderChat()

    await waitFor(() => expect(bubbles()).toHaveLength(4))
    expect(bubbles().map((li) => li.querySelector('p')?.textContent)).toEqual([
      '첫 질문',
      '첫 답',
      '두 번째 질문',
      '두 번째 답',
    ])
  })

  it('이전 대화가 없으면 인사 문구를 보여준다', async () => {
    mockHistory([])
    renderChat()

    expect(await screen.findByText('안녕하세요. 무엇이든 물어보세요.')).toBeInTheDocument()
  })

  it('이전 대화가 없으면 "새 대화 · 최근 대화 5개를 기억해요"', async () => {
    mockHistory([])
    renderChat()

    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')
    expect(screen.getByLabelText('대화 정보')).toHaveTextContent('새 대화 · 최근 대화 5개를 기억해요')
  })

  it('이전 대화가 있으면 이어지는 대화라 "새 대화" 없이 context 만', async () => {
    mockHistory([item(1, '첫 질문', '첫 답')])
    renderChat()

    await waitFor(() => expect(bubbles()).toHaveLength(2))
    expect(screen.getByLabelText('대화 정보')).toHaveTextContent(/^최근 대화 5개를 기억해요$/)
  })

  it('첫 질문을 보내면 "새 대화" 가 빠진다', async () => {
    mockHistory([])
    mockChat(ok)
    renderChat()
    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')

    await ask('안녕')
    expect(screen.getByLabelText('대화 정보')).toHaveTextContent(/^최근 대화 5개를 기억해요$/)
  })

  it('불러오지 못하면 안내하고 다시 불러올 수 있다', async () => {
    const user = userEvent.setup()
    server.use(http.get(`${BASE}/api/me/chats`, () => HttpResponse.json({ code: 500, data: { message: 'x' } })))
    renderChat()

    expect(await screen.findByText(/이전 대화를 불러오지 못했습니다/)).toBeInTheDocument()

    mockHistory([item(1, '복구된 질문', '복구된 답')])
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }))

    await waitFor(() => expect(bubbles()).toHaveLength(2))
  })
})

describe('챗 — 전송', () => {
  it('질문을 즉시 보여주고, 응답 대기 뒤 답으로 바꾼다', async () => {
    mockHistory([])
    mockChat(ok)
    renderChat()
    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')

    await ask('CORS 가 뭐야?')

    expect(kinds()).toEqual(['user', 'pending'])
    await waitFor(() => expect(kinds()).toEqual(['user', 'bot']))
    expect(screen.getByText('답: CORS 가 뭐야?')).toBeInTheDocument()
  })

  it('이전 대화 아래에 이어서 쌓인다', async () => {
    mockHistory([item(1, '예전 질문', '예전 답')])
    mockChat(ok)
    renderChat()
    await waitFor(() => expect(bubbles()).toHaveLength(2))

    await ask('새 질문')

    await waitFor(() => expect(kinds()).toEqual(['user', 'bot', 'user', 'bot']))
  })

  it('AI 답변을 HTML 로 해석하지 않는다 (XSS 방지)', async () => {
    mockHistory([])
    mockChat(() => ({
      code: 200,
      data: { chat_id: 'c-1', question: 'q', answer: '<img src=x onerror=alert(1)>', created_at: '' },
    }))
    renderChat()
    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')

    await ask('q')

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('ol img')).toBeNull()
  })
})

describe('챗 — 오류와 다시 시도', () => {
  it('504 는 안내 문구와 다시 시도 아이콘을 보여주고, 결과 코드는 보여주지 않는다', async () => {
    mockHistory([])
    mockChat(() => timeout)
    renderChat()
    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')

    await ask('느린 질문')

    const bubble = await screen.findByRole('alert')
    expect(bubble).toHaveTextContent('현재 응답이 지연되고 있어요')
    // 코드는 사용자에게 필요 없는 정보다 (2026-09-29 결정)
    expect(bubble).not.toHaveTextContent('504')
    expect(bubble).not.toHaveTextContent('AI_TIMEOUT')
    // 글자 없이 아이콘만 — 이름은 스크린리더와 툴팁이 가진다
    const retryButton = within(bubble).getByRole('button', { name: '다시 시도' })
    expect(retryButton.textContent).toBe('')
  })

  it('[다시 시도] 는 같은 질문을 다시 보내고 오류 자리를 결과로 바꾼다', async () => {
    const user = userEvent.setup()
    mockHistory([])
    let calls = 0
    const sent = mockChat((message) => (++calls === 1 ? timeout : ok(message)))
    renderChat()
    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')
    await ask('다시 보낼 질문')
    const bubble = await screen.findByRole('alert')

    await user.click(within(bubble).getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(kinds()).toEqual(['user', 'bot']))
    expect(sent).toEqual(['다시 보낼 질문', '다시 보낼 질문'])
  })

  it('500 은 다시 보내도 결과가 같아 [다시 시도] 가 없다', async () => {
    mockHistory([])
    mockChat(() => ({ code: 500, data: { message: '서버 내부 오류가 발생했습니다.' } }))
    renderChat()
    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')

    await ask('질문')

    const bubble = await screen.findByRole('alert')
    expect(bubble).toHaveTextContent('서버 내부 오류가 발생했습니다.')
    expect(bubble).not.toHaveTextContent('INTERNAL_ERROR')
    expect(within(bubble).queryByRole('button', { name: '다시 시도' })).toBeNull()
  })

  it('429 는 정해진 안내 문구를 보여주고 [다시 시도] 가 없다 (제한이 풀리기 전엔 다시 막힌다)', async () => {
    mockHistory([])
    mockChat(() => ({ code: 429, data: { message: 'rate limit exceeded' } }))
    renderChat()
    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')

    await ask('질문')

    const bubble = await screen.findByRole('alert')
    expect(bubble).toHaveTextContent('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.')
    expect(bubble).not.toHaveTextContent('rate limit exceeded')
    expect(within(bubble).queryByRole('button', { name: '다시 시도' })).toBeNull()
  })

  it('서버에 닿지 못하면 연결 실패를 안내한다', async () => {
    mockHistory([])
    server.use(http.post(`${BASE}/api/chat`, () => HttpResponse.error()))
    renderChat()
    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')

    await ask('질문')

    const bubble = await screen.findByRole('alert')
    expect(bubble).toHaveTextContent('서버에 연결할 수 없습니다')
    expect(bubble).not.toHaveTextContent('NETWORK_ERROR')
  })

  it('오류 뒤 입력칸으로 포커스가 돌아온다', async () => {
    mockHistory([])
    mockChat(() => timeout)
    renderChat()
    await screen.findByText('안녕하세요. 무엇이든 물어보세요.')

    await ask('질문')
    await screen.findByRole('alert')

    await waitFor(() => expect(screen.getByLabelText('질문')).toHaveFocus())
  })
})

describe('챗 — 위로 스크롤해 이전 대화 불러오기', () => {
  it('맨 위에 닿으면 이전 대화를 위에 붙인다 (아래가 최신)', async () => {
    const all = Array.from({ length: 25 }, (_, i) => item(25 - i, `질문 ${25 - i}`, `답 ${25 - i}`))
    server.use(
      http.get(`${BASE}/api/me/chats`, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset') ?? 0)
        return HttpResponse.json({ code: 200, data: { total: 25, items: all.slice(offset, offset + 20) } })
      }),
    )
    renderChat()
    await waitFor(() => expect(bubbles()).toHaveLength(40))
    // 맨 아래가 가장 최근 답
    expect(bubbles().at(-1)?.querySelector('p')?.textContent).toBe('답 25')

    const scroller = screen.getByLabelText('대화 스크롤 영역')
    scroller.scrollTop = 0
    fireEvent.scroll(scroller)

    await waitFor(() => expect(bubbles()).toHaveLength(50))
    expect(bubbles()[0].querySelector('p')?.textContent).toBe('질문 1')
    expect(bubbles().at(-1)?.querySelector('p')?.textContent).toBe('답 25')
  })

  it('이전 대화를 더 불러오지 못하면 토스트로 알리고 보던 대화는 그대로 둔다', async () => {
    const user = userEvent.setup()
    const all = Array.from({ length: 25 }, (_, i) => item(25 - i, `질문 ${25 - i}`, `답 ${25 - i}`))
    let olderCalls = 0
    server.use(
      http.get(`${BASE}/api/me/chats`, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset') ?? 0)
        if (offset > 0 && ++olderCalls === 1) return HttpResponse.error()
        return HttpResponse.json({ code: 200, data: { total: 25, items: all.slice(offset, offset + 20) } })
      }),
    )
    renderChat()
    await waitFor(() => expect(bubbles()).toHaveLength(40))

    const scroller = screen.getByLabelText('대화 스크롤 영역')
    scroller.scrollTop = 0
    fireEvent.scroll(scroller)

    const toast = await screen.findByRole('alert')
    expect(toast).toHaveTextContent('이전 기록을 불러오지 못했습니다.')
    expect(bubbles()).toHaveLength(40)

    // 화면이 다시 그려져도(입력) 같은 토스트가 또 뜨지 않는다 — 한 번의 실패에 한 번
    await user.type(screen.getByLabelText('질문'), '다시 그리기')
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    // 토스트의 다시 불러오기 아이콘으로 이어서 받는다
    await user.click(within(toast).getByRole('button', { name: '다시 불러오기' }))
    await waitFor(() => expect(bubbles()).toHaveLength(50))
  })
})

describe('챗 — 날짜 구분선과 로딩', () => {
  const daysAgo = (n: number, hour = 10) => {
    const date = new Date()
    date.setDate(date.getDate() - n)
    date.setHours(hour, 0, 0, 0)
    return date.toISOString()
  }

  it('날짜가 바뀌는 곳마다 구분선을 넣는다 — 오늘·어제·그 전', async () => {
    // 서버는 최신순
    mockHistory([
      { ...item(3, '오늘 질문', '오늘 답'), created_at: daysAgo(0) },
      { ...item(2, '어제 질문', '어제 답'), created_at: daysAgo(1) },
      { ...item(1, '지난 질문', '지난 답'), created_at: daysAgo(10) },
    ])
    renderChat()
    await waitFor(() => expect(bubbles()).toHaveLength(6))

    const separators = within(screen.getByRole('list', { name: '대화' })).getAllByRole('separator')
    expect(separators.map((li) => li.textContent)).toHaveLength(3)
    expect(separators[1]).toHaveTextContent('어제')
    expect(separators[2]).toHaveTextContent('오늘')
    // 같은 날의 질문·답 사이에는 구분선이 없다 — 말풍선 6개에 구분선 3개
  })

  it('이전 대화를 불러오는 동안 로딩 표시', async () => {
    server.use(
      http.get(`${BASE}/api/me/chats`, async () => {
        await delay(50)
        return HttpResponse.json({ code: 200, data: { total: 0, items: [] } })
      }),
    )
    renderChat()
    expect(screen.getByRole('status')).toHaveTextContent('이전 대화를 불러오는 중…')
    expect(await screen.findByText('안녕하세요. 무엇이든 물어보세요.')).toBeInTheDocument()
    expect(screen.queryByText('이전 대화를 불러오는 중…')).toBeNull()
  })
})
