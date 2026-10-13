import type { ChatLogItem } from '@/api/types'
import { Timestamp } from '@/components/Timestamp'
import styles from './LogsPage.module.css'

/**
 * 대화 기록 한 건 (docs/05-ui-ux.md 화면 4).
 * 번호는 서버 id 가 아니라 내 기록 안에서의 순번이다 — 가장 오래된 대화가 1번째.
 * 서버 id(UUID)는 읽을 수 없고, 순차 DB 번호는 서비스 전체 대화 수를 드러낸다
 */
export function LogCard({ item, number }: { item: ChatLogItem; number: number }) {
  return (
    <article aria-label={`${number}번째 대화`} className={styles.card}>
      <header className={styles.cardHead}>
        <span>{number}번째</span>
        <Timestamp iso={item.created_at} />
      </header>
      {/* 줄바꿈은 살리되 HTML 로 해석하지 않는다 — AI 답변도 텍스트로만 (XSS 방지) */}
      <dl className={styles.qa}>
        <dt>질문</dt>
        <dd>{item.question}</dd>
        <dt>답변</dt>
        <dd className={styles.answer}>{item.answer}</dd>
      </dl>
    </article>
  )
}
