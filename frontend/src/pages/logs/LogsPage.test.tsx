import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it } from 'vitest'

import { instance } from '@/api/instance'
import { ToastRegion } from '@/components/Toast'
import { ToastProvider } from '@/store/ToastProvider'
import { server } from '@/test/server'
import LogsPage from './LogsPage'

const BASE = 'https://api.test'

beforeAll(() => {
  instance.defaults.baseURL = BASE
})

// chat_id 는 서버의 공개 id(UUID 자리). 화면 번호는 이 값이 아니라 내 기록 안의 순번이다.
// ids 를 1..N 으로 두면 id 와 순번이 같아 기대값을 읽기 쉽다
const item = (id: number) => ({
  chat_id: `chat-${id}`,
  question: `질문 ${id}`,
  answer: `답변 ${id}`,
  created_at: '2026-09-28T10:05:00+09:00',
})

/** 최신순 목록을 흉내 낸다. ids 는 최신 → 오래된 순 */
function mockLogs(getIds: () => number[], options: { delayMs?: number } = {}) {
  const requests: { limit: string | null; offset: string | null }[] = []
  server.use(
    http.get(`${BASE}/api/me/chats`, async ({ request }) => {
      const url = new URL(request.url)
      const limit = Number(url.searchParams.get('limit'))
      const offset = Number(url.searchParams.get('offset'))
      requests.push({ limit: url.searchParams.get('limit'), offset: url.searchParams.get('offset') })
      if (options.delayMs) await delay(options.delayMs)
      const ids = getIds()
      return HttpResponse.json({
        code: 200,
        data: { total: ids.length, items: ids.slice(offset, offset + limit).map(item) },
      })
    }),
  )
  return requests
}

const range = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => from - i)

function renderLogs() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <LogsPage />
        <ToastRegion />
      </ToastProvider>
    </MemoryRouter>,
  )
}

const cards = () => within(screen.getByRole('list', { name: '대화 기록' })).queryAllByRole('article')
const cardIds = () => cards().map((card) => card.getAttribute('aria-label'))
const total = () => screen.getByLabelText('총 기록 수').textContent
/** 스크롤 영역을 맨 위로 올린다 — 이전 기록을 불러온다 */
const scrollToTop = () => {
  const scroller = screen.getByLabelText('대화 기록 스크롤 영역')
  scroller.scrollTop = 0
  fireEvent.scroll(scroller)
}

describe('내 대화 로그 — 첫 화면', () => {
  it('최근 20건을 아래가 최신이 되게 보여주고 총 기록 수를 표시한다', async () => {
    const requests = mockLogs(() => range(25, 1))
    renderLogs()

    await waitFor(() => expect(cards()).toHaveLength(20))
    expect(total()).toBe('25')
    // 위가 오래된 것, 아래가 최신 — 챗 화면과 같은 규칙
    expect(cardIds()[0]).toBe('6번째 대화')
    expect(cardIds().at(-1)).toBe('25번째 대화')
    expect(requests[0]).toEqual({ limit: '20', offset: '0' })
  })

  it('카드에 순번·시각·질문·답변이 있다', async () => {
    mockLogs(() => [7])
    renderLogs()

    const card = (await screen.findAllByRole('article'))[0]
    // 기록이 1건이면 1번째다. 서버 id(chat-7)는 보여 주지 않는다 — 서비스 전체 대화 수를 드러내지 않게
    expect(card).toHaveTextContent('1번째')
    expect(card).not.toHaveTextContent('chat-7')
    // 보이는 글자는 오늘 기준("오늘 10:05"·"9월 28일 10:05")이라 날짜마다 달라진다.
    // 기계가 읽는 값과 마우스를 올리면 보이는 전체 시각으로 확인한다
    const time = card.querySelector('time')
    expect(time).toHaveAttribute('dateTime', '2026-09-28T10:05:00+09:00')
    expect(time?.getAttribute('title')).toMatch(/^2026-09-28 \d{2}:05:00$/)
    expect(card).toHaveTextContent('질문 7')
    expect(card).toHaveTextContent('답변 7')
  })

  it('기록이 없으면 안내 문구를 보여준다', async () => {
    mockLogs(() => [])
    renderLogs()

    expect(await screen.findByText('아직 저장된 대화가 없습니다.')).toBeInTheDocument()
  })

  it('답변을 HTML 로 해석하지 않는다 (XSS 방지)', async () => {
    server.use(
      http.get(`${BASE}/api/me/chats`, () =>
        HttpResponse.json({
          code: 200,
          data: { total: 1, items: [{ ...item(1), answer: '<img src=x onerror=alert(1)>' }] },
        }),
      ),
    )
    renderLogs()

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('article img')).toBeNull()
  })

  it('불러오지 못하면 안내하고 다시 불러올 수 있다', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${BASE}/api/me/chats`, () =>
        HttpResponse.json({ code: 500, data: { message: '서버 내부 오류가 발생했습니다.' } }),
      ),
    )
    renderLogs()

    expect(await screen.findByText(/대화 기록을 불러오지 못했습니다/)).toBeInTheDocument()

    mockLogs(() => [3, 2, 1])
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }))

    await waitFor(() => expect(cards()).toHaveLength(3))
  })
})

describe('내 대화 로그 — 위로 스크롤해 이전 기록 불러오기', () => {
  it('맨 위에 닿으면 받은 개수만큼 offset 을 올려 이전 기록을 위에 붙인다', async () => {
    const requests = mockLogs(() => range(25, 1))
    renderLogs()
    await waitFor(() => expect(cards()).toHaveLength(20))

    scrollToTop()

    await waitFor(() => expect(cards()).toHaveLength(25))
    expect(requests[1]).toEqual({ limit: '20', offset: '20' })
    expect(cardIds()[0]).toBe('1번째 대화')
    expect(cardIds().at(-1)).toBe('25번째 대화')
  })

  it('다 받은 뒤에는 더 요청하지 않고 아무것도 표시하지 않는다', async () => {
    const requests = mockLogs(() => range(25, 1))
    renderLogs()
    await waitFor(() => expect(cards()).toHaveLength(20))
    scrollToTop()
    await waitFor(() => expect(cards()).toHaveLength(25))

    scrollToTop()

    expect(requests).toHaveLength(2)
    expect(screen.queryByText(/처음/)).toBeNull()
  })

  it('보는 도중 새 대화가 생겨 순서가 밀려도 같은 카드를 두 번 보여주지 않는다', async () => {
    let ids = range(25, 1)
    mockLogs(() => ids)
    renderLogs()
    await waitFor(() => expect(cards()).toHaveLength(20))

    // 챗에서 새 대화가 생겨 모든 기록이 한 칸씩 밀린다
    ids = range(26, 1)
    scrollToTop()

    await waitFor(() => expect(cardIds()[0]).toBe('1번째 대화'))
    expect(new Set(cardIds()).size).toBe(cardIds().length)
    expect(total()).toBe('26')
    // 새 대화(26번째)는 아직 받지 않았다. 이미 보이던 카드의 순번은 바뀌지 않는다
    expect(cardIds().at(-1)).toBe('25번째 대화')
  })

  it('스크롤이 여러 번 닿아도 한 번만 요청한다', async () => {
    const requests = mockLogs(() => range(25, 1), { delayMs: 50 })
    renderLogs()
    await waitFor(() => expect(cards()).toHaveLength(20))

    scrollToTop()
    scrollToTop()
    scrollToTop()

    await waitFor(() => expect(cards()).toHaveLength(25))
    expect(requests).toHaveLength(2)
  })

  it('실패해도 이미 받은 목록은 그대로 둔다', async () => {
    let fail = false
    server.use(
      http.get(`${BASE}/api/me/chats`, ({ request }) => {
        if (fail) return HttpResponse.error()
        const offset = Number(new URL(request.url).searchParams.get('offset'))
        const ids = range(25, 1).slice(offset, offset + 20)
        return HttpResponse.json({ code: 200, data: { total: 25, items: ids.map(item) } })
      }),
    )
    renderLogs()
    await waitFor(() => expect(cards()).toHaveLength(20))

    fail = true
    scrollToTop()

    // 흐름을 막지 않게 토스트로 알리고, 다시 불러오기 아이콘을 준다
    const toast = await screen.findByRole('alert')
    expect(toast).toHaveTextContent('이전 기록을 불러오지 못했습니다.')
    expect(within(toast).getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
    expect(cards()).toHaveLength(20)
  })
})

describe('내 대화 로그 — 새로고침', () => {
  it('처음부터 다시 불러와 새 대화를 맨 아래(최신)에 보여준다', async () => {
    const user = userEvent.setup()
    let ids = range(25, 1)
    mockLogs(() => ids)
    renderLogs()
    await waitFor(() => expect(cards()).toHaveLength(20))
    scrollToTop()
    await waitFor(() => expect(cards()).toHaveLength(25))

    ids = range(26, 1)
    const refresh = screen.getByRole('button', { name: '새로고침' })
    // 새로고침은 글자 없이 아이콘만 (이름은 스크린리더·툴팁)
    expect(refresh.textContent).toBe('')
    await user.click(refresh)

    await waitFor(() => expect(cardIds().at(-1)).toBe('26번째 대화'))
    expect(cards()).toHaveLength(20)
    expect(total()).toBe('26')
  })
})
