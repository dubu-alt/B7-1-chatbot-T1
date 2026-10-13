/**
 * API 요청·응답 타입. docs/03-api.md 와 1:1 로 맞춘다.
 */
import type { Role, User } from '@/types/user'

/* ------------------------------------------------------------------ */
/* 공통 응답 형식                                                       */
/* ------------------------------------------------------------------ */

/**
 * 서버 응답의 공통 겉포장.
 *
 * 이 서버는 성공·실패 모두 **HTTP 200** 으로 응답하고 결과는 body 의 code 로만 판단한다
 * (docs/03-api.md 0절). 따라서 axios 는 실패를 에러로 던지지 않으며,
 * 응답 인터셉터가 code 를 보고 ApiError 로 바꾼다.
 */
export interface ApiEnvelope<T> {
  code: number
  data: T
}

/** 실패 응답의 data. 사용자에게 보여줄 문구가 들어 있다 */
export interface ApiFailureData {
  message: string
}

/**
 * 결과 코드 (docs/03-api.md 0절).
 *
 * 같은 코드 안의 원인은 **호출한 API 로 구분**한다.
 * 예: 로그인 API 의 401 은 로그인 실패, 재발급 API 의 401 은 재로그인 필요,
 * 그 외 API 의 401 은 access token 만료·없음.
 */
export const RESULT_CODE = {
  /** 서버에 닿지 못함. 서버가 준 값이 아니라 프론트가 붙이는 값이다 */
  unreachable: 0,
  ok: 200,
  created: 201,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  validationError: 422,
  /** 요청 횟수 제한 초과 — 챗(AI 호출)·로그인 시도 (docs/13-security-review.md S01·S02) */
  tooManyRequests: 429,
  internalError: 500,
  aiCallFailed: 502,
  aiTimeout: 504,
} as const

export type ResultCode = (typeof RESULT_CODE)[keyof typeof RESULT_CODE]

/* ------------------------------------------------------------------ */
/* 인증 (docs/03-api.md 1절)                                            */
/* ------------------------------------------------------------------ */

/** POST /api/auth/signup — 비밀번호 8자 이상, 닉네임 1~20자(중복 허용) */
export interface SignupRequest {
  email: string
  password: string
  nickname: string
}

/** 회원가입 성공 응답 (code 201) */
export interface SignupResponse extends User {
  created_at: string
}

/** POST /api/auth/login */
export interface LoginRequest {
  email: string
  password: string
}

/** 로그인·재발급 응답. 재발급 시 refresh_token 도 새 값으로 회전된다 (docs/03-api.md 1-4절) */
export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  /** access token 만료까지 남은 초 (15분 = 900) */
  expires_in: number
  /** refresh token 만료까지 남은 초 (1일 = 86400) */
  refresh_expires_in: number
}

/** POST /api/auth/refresh · POST /api/auth/logout — refresh token 은 쿠키가 아니라 body 로 보낸다 */
export interface RefreshTokenRequest {
  refresh_token: string
}

/** GET /api/auth/me — 새로고침 후 상태 복원과 관리자 메뉴 표시 판단에 사용한다 */
export interface MeResponse extends User {
  role: Role
}

/* ------------------------------------------------------------------ */
/* 챗봇 (docs/03-api.md 2절)                                            */
/* ------------------------------------------------------------------ */

/** POST /api/chat — 앞뒤 공백 제거 후 1~1000자 */
export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  chat_id: number
  question: string
  answer: string
  created_at: string
}

/* ------------------------------------------------------------------ */
/* 대화 로그 (docs/03-api.md 3절)                                       */
/* ------------------------------------------------------------------ */

/** GET /api/me/chats — limit 기본 20(최대 100), offset 기본 0 */
export interface ChatLogQuery {
  limit?: number
  offset?: number
}

export interface ChatLogItem {
  chat_id: number
  question: string
  answer: string
  created_at: string
}

/** total 은 해당 사용자의 전체 성공 기록 수. items 는 최신순이며 성공 기록만 담긴다 */
export interface ChatLogList {
  total: number
  items: ChatLogItem[]
}

/* ------------------------------------------------------------------ */
/* 관리자 (docs/03-api.md 4절) — role=admin 만 호출할 수 있다           */
/* ------------------------------------------------------------------ */

/** 목록 API 공통 쿼리 — limit 기본 20, offset 기본 0 */
export interface PageQuery {
  limit?: number
  offset?: number
}

/** 목록 API 공통 응답. total 은 조건에 맞는 전체 개수 */
export interface PageResult<T> {
  total: number
  items: T[]
}

/** GET /api/admin/stats */
export interface AdminStats {
  users: number
  chats: { total: number; success: number; failed: number }
  failures: { AI_TIMEOUT: number; AI_CALL_FAILED: number }
  /** 성공 기록의 평균 AI 응답시간. 기록이 없으면 null 일 수 있다 */
  avg_latency_ms: number | null
}

/** GET /api/admin/users?q= — q 는 이메일 부분 검색 */
export interface AdminUserQuery extends PageQuery {
  q?: string
}

/** 관리자 응답의 사용자. 관리자 API 만 사용자 번호(id)를 준다 — 목록 선택·?user= 에 쓴다 */
export interface AdminUserRef extends User {
  id: number
}

export interface AdminUser extends AdminUserRef {
  role: Role
  created_at: string
  chat_count: number
  /** 대화가 없으면 null */
  last_chat_at: string | null
}

export type ChatStatus = 'success' | 'error'

/** 관리자가 보는 대화 기록 한 건. 실패 기록도 포함된다 */
export interface AdminChat {
  chat_id: number
  question: string
  /** 실패 기록은 null */
  answer: string | null
  status: ChatStatus
  /** AI_TIMEOUT · AI_CALL_FAILED. 성공은 null */
  error_code: string | null
  latency_ms: number | null
  request_id: string
  created_at: string
}

/** GET /api/admin/users/{user_id}/chats — 성공·실패 모두 최신순. 없는 사용자는 404 */
export interface AdminUserChats extends PageResult<AdminChat> {
  user: AdminUserRef
}

/** GET /api/admin/failures — status=error 기록, 최신순 */
export interface AdminFailure {
  chat_id: number
  user_id: number
  email: string
  question: string
  error_code: string
  latency_ms: number | null
  request_id: string
  created_at: string
}

export type LogLevel = 'INFO' | 'WARN' | 'WARNING' | 'ERROR'

export interface RequestLogEvent {
  event: string
  level: LogLevel
  user_id: number | null
  detail: string
  created_at: string
}

/** GET /api/admin/requests/{request_id}/logs — 시간순. 기록이 없으면 404 */
export interface RequestLogs {
  request_id: string
  items: RequestLogEvent[]
}
