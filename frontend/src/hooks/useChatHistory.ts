import { useCallback, useMemo, useState } from 'react'

import { getMyChats } from '@/api/logs'
import type { ChatLogItem } from '@/api/types'
import { useAbortableRequest } from '@/hooks/useAbortableRequest'
import { useSubmit } from '@/hooks/useSubmit'

/** 한 번에 불러올 개수 — 서버 기본값과 같다 (docs/03-api.md 3-1절) */
export const HISTORY_PAGE_SIZE = 20

/**
 * 내 대화 기록 — 최근 기록부터 불러오고, 이전 기록을 거슬러 이어 붙인다.
 *
 * 챗 화면과 내 대화 로그 화면이 같은 규칙으로 보여주도록 한곳에 모았다.
 * 서버는 최신순으로 주지만, 화면에는 **위가 오래된 것 · 아래가 최신**으로 돌려준다
 * (메신저처럼 최근 대화가 아래에 있고, 위로 올리면 이전 대화가 나온다).
 *
 * - 첫 페이지는 화면이 뜰 때 불러오고 화면을 벗어나면 취소한다
 * - 이전 기록은 useSubmit 으로 잠가 스크롤이 여러 번 닿아도 한 번만 요청한다
 * - chat_id 로 중복을 거른다. 보는 도중 새 대화가 생기면 최신순 목록이 한 칸씩 밀려
 *   다음 페이지 첫 항목이 이미 받은 것과 겹친다
 */
export function useChatHistory() {
  const first = useAbortableRequest((signal) =>
    getMyChats({ limit: HISTORY_PAGE_SIZE, offset: 0 }, signal),
  )
  const [older, setOlder] = useState<ChatLogItem[]>([])
  const [latestTotal, setLatestTotal] = useState<number | null>(null)
  const olderRequest = useSubmit((offset: number) =>
    getMyChats({ limit: HISTORY_PAGE_SIZE, offset }),
  )

  // 받은 "원본" 개수. offset 은 이 값으로 정한다 — 중복을 거른 개수를 쓰면 같은 구간을 다시 받는다
  const received = (first.data?.items.length ?? 0) + older.length
  // 도중에 새 대화가 생기면 total 도 늘어난다. 가장 최근에 받은 값을 쓴다
  const total = latestTotal ?? first.data?.total ?? 0

  // 최신순으로 받은 것을 뒤집어 오래된 것부터 둔다
  const items = useMemo(
    () => dedupe([...(first.data?.items ?? []), ...older]).reverse(),
    [first.data, older],
  )

  // 맨 위(가장 오래된) 항목이 내 기록에서 몇 번째인가. 가장 오래된 대화가 1번째, 최신이 총 기록 수다.
  // 첫 페이지의 total 로 센다 — 받은 목록은 첫 페이지 최신부터 빈틈없이 이어지므로(겹침은 거름),
  // 보는 도중 새 대화가 생겨 total 이 늘어도 이미 보이는 카드의 순번은 바뀌지 않는다
  const firstNumber = (first.data?.total ?? 0) - items.length + 1

  const loadOlder = useCallback(async () => {
    const result = await olderRequest.submit(received)
    if (!result.ok) return
    setOlder((prev) => [...prev, ...result.data.items])
    setLatestTotal(result.data.total)
  }, [olderRequest, received])

  return {
    /** 위가 오래된 것 · 아래가 최신 */
    items,
    /** items[0] 의 순번. items[i] 는 firstNumber + i 번째 대화 */
    firstNumber,
    total,
    isLoading: first.isPending,
    loadError: first.error,
    retry: first.reload,
    hasOlder: first.data !== null && received < total,
    loadOlder,
    isLoadingOlder: olderRequest.isSubmitting,
    olderError: olderRequest.error,
  }
}

function dedupe(items: ChatLogItem[]): ChatLogItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.chat_id)) return false
    seen.add(item.chat_id)
    return true
  })
}
