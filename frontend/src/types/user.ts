/**
 * 사용자 관련 공유 타입.
 * AuthContext · 헤더 · 관리자 화면이 함께 쓰므로 src/types 에 둔다 (README 타입 규칙).
 */

/** 권한. 가입으로 만들어지는 계정은 항상 user 이며 admin 은 서버 시드로만 생성된다 (docs/03-api.md 4-0절) */
export type Role = 'user' | 'admin'

/**
 * 화면에 노출해도 되는 사용자 정보. 비밀번호 해시는 어떤 응답에도 포함되지 않는다.
 * DB 의 사용자 번호(id)는 없다 — 가입 순서·가입자 수가 드러나 일반 사용자 응답에서 뺐다 (docs/03-api.md 1절).
 * 관리자 응답만 id 를 받는다 (api/types.ts AdminUserRef)
 */
export interface User {
  email: string
  nickname: string
}
