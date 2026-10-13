import { useEffect, useRef, useState } from 'react'

import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { HistoryScroller } from '@/components/HistoryScroller'
import { LoadingStatus } from '@/components/Spinner'
import { useChatHistory } from '@/hooks/useChatHistory'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useToast } from '@/hooks/useToast'
import { LogCard } from './LogCard'
import styles from './LogsPage.module.css'

/**
 * 내 대화 로그 화면 (docs/05-ui-ux.md 화면 4).
 *
 * mission 4-4절 "사용자 기준 로그 조회/추적"을 화면으로 보여주는 곳이다.
 * 조회 범위는 서버가 토큰의 사용자로 강제하므로 다른 사람의 기록은 오지 않는다.
 *
 * 챗 화면과 같은 규칙으로 보여준다 — 아래가 최신, 위로 올리면 이전 기록을 더 불러온다.
 *
 * [새로고침] 은 목록을 key 로 새로 그린다. 받아 둔 페이지·오류·진행 상태를 하나씩
 * 초기화하지 않아도 되고, 초기화를 빠뜨리는 실수가 생기지 않는다.
 */
export default function LogsPage() {
  usePageMeta({ title: '내 대화 로그', noindex: true })
  const [version, setVersion] = useState(0)
  return <LogsView key={version} onRefresh={() => setVersion((v) => v + 1)} />
}

function LogsView({ onRefresh }: { onRefresh: () => void }) {
  const history = useChatHistory()

  // 이전 기록을 더 불러오지 못해도 받은 목록은 그대로다. 흐름을 막지 않게 토스트로 알린다
  const showToast = useToast()
  // loadOlder 는 렌더마다 새로 만들어진다. 의존성에 넣으면 렌더마다 같은 토스트가 다시 뜨므로
  // 최신 값만 ref 로 보고, 오류가 새로 생겼을 때만 한 번 띄운다
  const { olderError } = history
  const loadOlderRef = useRef(history.loadOlder)
  useEffect(() => {
    loadOlderRef.current = history.loadOlder
  })
  useEffect(() => {
    if (!olderError) return
    showToast(`이전 기록을 불러오지 못했습니다. ${olderError.message}`, {
      tone: 'error',
      action: { label: '다시 불러오기', onClick: () => void loadOlderRef.current() },
    })
  }, [olderError, showToast])

  const isEmpty = !history.isLoading && !history.loadError && history.items.length === 0

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>내 대화 로그</h1>
          <p className={styles.description}>
            로그인한 사용자 본인의 기록만 보입니다.
          </p>
        </div>
        <div className={styles.summary}>
          <p className={styles.total}>
            <span className={styles.totalLabel}>총 기록</span>
            <strong aria-label="총 기록 수">{history.isLoading ? '…' : history.total}</strong>
          </p>
          <Button icon="refresh" label="새로고침" onClick={onRefresh} disabled={history.isLoading} />
        </div>
      </div>

      {history.loadError ? (
        <Alert
          tone="error"
          action={<Button variant="ghost" size="sm" icon="refresh" label="다시 불러오기" onClick={history.retry} />}
        >
          대화 기록을 불러오지 못했습니다. {history.loadError.message}
        </Alert>
      ) : null}

      {history.isLoading ? <LoadingStatus>불러오는 중…</LoadingStatus> : null}
      {isEmpty ? <p className={styles.empty}>아직 저장된 대화가 없습니다.</p> : null}

      <HistoryScroller
        label="대화 기록 스크롤 영역"
        className={styles.scroller}
        firstKey={history.items[0]?.chat_id}
        lastKey={history.items.at(-1)?.chat_id}
        hasOlder={history.hasOlder}
        isLoadingOlder={history.isLoadingOlder}
        onReachTop={history.loadOlder}
      >
        <ol aria-label="대화 기록" className={styles.list}>
          {history.items.map((item, index) => (
            <li key={item.chat_id}>
              <LogCard item={item} number={history.firstNumber + index} />
            </li>
          ))}
        </ol>
      </HistoryScroller>
    </section>
  )
}
