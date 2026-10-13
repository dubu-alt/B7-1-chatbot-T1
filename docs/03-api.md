# 03. API 명세

> 관련 문서: [02-architecture.md](02-architecture.md) · [04-database.md](04-database.md)
> API 계약의 기준 문서다. 합의된 값은 [7. 합의된 값](#7-합의된-값), 문서 간 불일치는 [11-open-issues.md](11-open-issues.md) 에서 관리한다.

## 0. 공통 규약

### Base URL

| 환경 | URL |
|------|-----|
| 개발(백엔드 직접) | `http://localhost:8000` |
| 개발(프론트) | `http://localhost:5173` — axios `baseURL` 은 `VITE_API_BASE_URL` |
| 배포 | `https://<Railway 백엔드 서비스 도메인>` (프론트는 `https://<Railway 프론트 서비스 도메인>`) |

- 요청/응답 본문: `application/json`
- Swagger UI: `<Base URL>/docs` — **로컬 개발에서 `ENABLE_DOCS=true` 일 때만** 열린다. 운영(Railway)은 꺼져 있어(404) 이 문서가 API 명세다

### 인증 방식

**JWT Bearer 토큰.** 로그인 성공 시 발급받은 `access_token` 을 이후 요청 헤더에 포함한다.

```
Authorization: Bearer <access_token>
```

- 서명 알고리즘 `HS256` (`JWT_ALGORITHM`), 비밀키 `JWT_SECRET_KEY`
- **access token + refresh token** 두 가지를 발급한다 (확정 — [11-open-issues.md](11-open-issues.md) A7)

| 토큰 | 형식 | 수명 | 서버 저장 | 용도 |
|------|------|------|-----------|------|
| `access_token` | JWT (`sub`=사용자 public_id(UUID), `exp`) | `JWT_EXPIRE_MINUTES` = **15분** | 저장 안 함 | 모든 인증 API 의 `Authorization` 헤더 |
| `refresh_token` | 무작위 문자열 (`secrets.token_urlsafe`) | `REFRESH_TOKEN_EXPIRE_DAYS` = **1일** (재발급마다 새 토큰이 다시 1일) | **SHA-256 해시로 `refresh_tokens` 테이블에 저장** | `POST /api/auth/refresh` 로 새 토큰 발급 · `POST /api/auth/logout` 으로 폐기 |

- 응답의 `expires_in` / `refresh_expires_in` 은 초 단위
- access token 만료·위조·누락 → `code: 401` → 프론트가 refresh 로 1회 재발급 시도
- refresh token 무효(없음·만료·폐기) → `code: 401` → 다시 로그인
- refresh token 은 요청 **body** 로 보낸다 (쿠키 미사용 → CORS `credentials` 불필요)
- 만료된 refresh token 행은 **하루 1회 스케줄러**가 삭제한다 ([04-database.md](04-database.md) refresh_tokens)
- 값을 이렇게 정한 이유: [12-decisions.md](12-decisions.md)

### 공통 응답 형식 (확정)

모든 API 응답은 성공·실패 모두 아래 봉투(envelope) 형태다.

```ts
type ApiResponse = {
  code: number   // 결과 코드 (HTTP 상태코드 체계의 숫자)
  data: object   // 성공: 결과 데이터 / 실패: { message }
}
```

**성공**
```json
{ "code": 201, "data": { "email": "user@example.com", "nickname": "어썸체크", "created_at": "2026-09-14T10:00:00+09:00" } }
```

**실패**
```json
{ "code": 504, "data": { "message": "현재 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요." } }
```

| 규칙 | 내용 |
|------|------|
| HTTP 상태코드 | 서버가 처리한 응답은 **성공·실패 모두 HTTP 200**. 결과 판단은 **body 의 `code` 로만** 한다 |
| 성공 판단 | `code` 가 2xx |
| 실패 판단 | `code` 가 4xx·5xx, 사용자 안내 문구는 `data.message` |
| 원인 구분 | 같은 `code` 안의 원인은 **요청한 API 로 구분**한다 (예: 로그인 API 의 401 = 로그인 실패, 재발급 API 의 401 = 다시 로그인 필요, 그 외 API 의 401 = access token 만료·없음). 응답에 문자열 에러 코드는 넣지 않는다 |
| FastAPI 기본 에러 | 입력 검증 실패(`RequestValidationError`), 없는 경로(404)·메서드(405), 처리하지 못한 예외(500)도 **예외 핸들러로 같은 봉투 형태**로 변환한다 (기본 `{"detail": ...}` 형식 금지) |
| 봉투가 아닌 응답 | 응답이 없음(네트워크 끊김) 또는 **body 에 `code` 가 없음**(Railway 앞단 502/503 등 서버에 닿지 못한 경우) → 프론트는 "서버에 연결할 수 없습니다" 로 처리 |

### 결과 코드 목록

"구분" 은 문서·로그에서 쓰는 이름이며 **응답 본문에는 포함되지 않는다.**

| code | 구분 | 발생 상황 | `data.message` 예 |
|------|------|-----------|--------------------|
| 200 | – | 조회·처리 성공 | – |
| 201 | – | 회원가입 성공 | – |
| 401 | `INVALID_CREDENTIALS` | 로그인 API 에서 이메일/비밀번호 불일치 | 이메일 또는 비밀번호가 올바르지 않습니다. |
| 401 | `UNAUTHORIZED` | 그 외 API 에서 access token 없음·만료·위조, 재발급 API 에서 refresh token 무효 | 로그인이 필요합니다. |
| 403 | `FORBIDDEN` | 관리자 API 를 일반 사용자가 호출 | 관리자만 접근할 수 있습니다. |
| 404 | `NOT_FOUND` | 없는 경로, 관리자 조회 대상(사용자·request_id) 없음 | 요청한 정보를 찾을 수 없습니다. |
| 405 | `METHOD_NOT_ALLOWED` | 정해진 메서드가 아님 (예: `/api/chat` 을 GET 으로) | 허용되지 않은 요청 방식입니다. |
| 409 | `EMAIL_ALREADY_EXISTS` | 회원가입 이메일 중복 (닉네임은 중복 허용, 검사하지 않음) | 이미 가입된 이메일입니다. |
| 413 | `PAYLOAD_TOO_LARGE` | 요청 본문이 64KB(`MAX_BODY_BYTES`)를 넘음 — 본문을 읽지 않고 거절 (모든 API) | 요청 내용이 너무 큽니다. |
| 422 | `VALIDATION_ERROR` | 입력값 검증 실패 (빈 입력, 길이 초과, 이메일 형식 등) | 질문은 1~1000자로 입력해 주세요. |
| 429 | `TOO_MANY_REQUESTS` | 요청 횟수 제한 초과 — 챗 요청(사용자별 1분 10회), 로그인 실패(이메일별 10분 5회·IP 별 10분 20회, 넘으면 비밀번호가 맞아도 429), 가입 요청(IP 별 10분 20회). 막힌 요청은 서버 로그 `rate_limited`·`login_rate_limited`·`signup_rate_limited`(WARN) | 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 | 서버 내부 오류가 발생했습니다. |
| 502 | `AI_CALL_FAILED` | AI API 호출 실패 (4xx/5xx/연결 오류/빈 응답) | AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요. |
| 504 | `AI_TIMEOUT` | AI API 타임아웃 | 현재 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요. |

> 로그인 실패 메시지는 이메일/비밀번호 중 무엇이 틀렸는지 구분하지 않는다(계정 존재 여부 추측 방지).

## 요약

| Method | Path | 인증 | 설명 | 성공 code |
|--------|------|:----:|------|:---------:|
| POST | `/api/auth/signup` | – | 회원가입 | 201 |
| POST | `/api/auth/login` | – | 로그인, access·refresh token 발급 | 200 |
| POST | `/api/auth/refresh` | – (body 에 refresh token) | 토큰 재발급 | 200 |
| POST | `/api/auth/logout` | – (body 에 refresh token) | 로그아웃, refresh token 폐기 | 200 |
| GET | `/api/auth/me` | ✅ | 현재 사용자 (새로고침 시 상태 복원, `role` 포함) | 200 |
| POST | `/api/chat` | ✅ | 질문 → AI 응답 (+DB 저장) | 200 |
| GET | `/api/me/chats` | ✅ | 내 대화 로그 | 200 |
| GET | `/api/admin/stats` | 🔒 | 전체 요약 통계 | 200 |
| GET | `/api/admin/users` | 🔒 | 사용자 목록·이메일 검색 | 200 |
| GET | `/api/admin/users/{user_id}/chats` | 🔒 | 사용자별 대화 기록 | 200 |
| GET | `/api/admin/failures` | 🔒 | AI 실패 기록 | 200 |
| GET | `/api/admin/requests/{request_id}/logs` | 🔒 | 요청 흐름 로그 | 200 |

✅ 로그인 필요 · 🔒 관리자(`role=admin`) 필요

---

## 1. 인증

### 1-1. 회원가입

```
POST /api/auth/signup
```

**Request**
```json
{ "email": "user@example.com", "password": "password1234", "nickname": "어썸체크" }
```

**Response**
```json
{
  "code": 201,
  "data": { "email": "user@example.com", "nickname": "어썸체크", "created_at": "2026-09-14T10:00:00+09:00" }
}
```

**검증 규칙**

| 필드 | 규칙 |
|------|------|
| `email` | 이메일 형식(Pydantic `EmailStr`), **중복 불가** |
| `password` | 8자 이상 128자 이하 |
| `nickname` | 1~20자, **중복 허용 (검사하지 않음)** |

- 비밀번호는 **bcrypt 로 해싱해서 저장** (평문 저장 금지). 응답에 해시를 포함하지 않는다.
- 가입으로 생성되는 계정은 항상 `role=user`. 관리자는 가입으로 만들 수 없다 ([4. 관리자](#4-관리자-필수--mission-2-2절-관리자내부-로그-확인-화면-4-4절-관리자-조회-api화면) 참고).

**실패**: `409`(이메일 중복), `422`(검증 실패)

```bash
curl -s -X POST http://localhost:8000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password1234","nickname":"어썸체크"}'
```
```json
{"code":409,"data":{"message":"이미 가입된 이메일입니다."}}
{"code":422,"data":{"message":"비밀번호는 8자 이상으로 입력해 주세요."}}
```

---

### 1-2. 로그인

```
POST /api/auth/login
```

**Request**
```json
{ "email": "user@example.com", "password": "password1234" }
```

**Response**
```json
{
  "code": 200,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "q3Xv9...",
    "token_type": "bearer",
    "expires_in": 900,
    "refresh_expires_in": 86400
  }
}
```

| 필드 | 의미 |
|------|------|
| `access_token` | JWT. payload 에 `sub`(사용자 public_id — UUID 문자열, 정수 id 아님), `exp` 포함 |
| `refresh_token` | 무작위 문자열. 서버는 **해시만** `refresh_tokens` 에 저장 |
| `token_type` | 항상 `bearer` |
| `expires_in` | access token 만료까지 남은 초. `JWT_EXPIRE_MINUTES × 60` |
| `refresh_expires_in` | refresh token 만료까지 남은 초. `REFRESH_TOKEN_EXPIRE_DAYS × 86400` |

**실패**: `401`(이메일/비밀번호 불일치), `422`(검증 실패 — 비밀번호 128자 초과 포함, 실패 횟수에 세지 않음)

```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password1234"}'
```
```json
{"code":401,"data":{"message":"이메일 또는 비밀번호가 올바르지 않습니다."}}
```

---

### 1-3. 내 정보 조회

> 프론트가 새로고침 후 로그인 상태를 복원하고, `role` 로 관리자 메뉴 표시 여부를 정할 때 사용한다.

```
GET /api/auth/me
Authorization: Bearer <token>
```

**Response**
```json
{ "code": 200, "data": { "email": "user@example.com", "nickname": "어썸체크", "role": "user" } }
```

> 회원가입·내 정보 조회 응답에는 사용자 `id` 를 넣지 않는다. 순차 정수 id 를 알면 가입 순서와 전체 가입자 수를 유추할 수 있어서다. 사용자 id 는 관리자 API 에서만 쓴다.

**실패**: `401`

```json
{"code":401,"data":{"message":"로그인이 필요합니다."}}
```

---

### 1-4. 토큰 재발급

> access token 이 만료되어 `code: 401` 을 받았을 때 프론트가 **1회** 호출한다.

```
POST /api/auth/refresh
```

**Request**
```json
{ "refresh_token": "q3Xv9..." }
```

**Response** — 로그인과 같은 형태
```json
{
  "code": 200,
  "data": { "access_token": "eyJ...", "refresh_token": "Zk81...", "token_type": "bearer", "expires_in": 900, "refresh_expires_in": 86400 }
}
```

**동작**
1. body 의 refresh token 을 SHA-256 해시 → `refresh_tokens` 에서 조회
2. 없음 / `expires_at` 지남 → `code: 401`
3. 새 access token 발급 + **refresh token 회전**: 기존 행 삭제 후 새 refresh token(만료 = 지금 + 1일) 발급·저장 → 이전 refresh token 은 즉시 사용 불가

**실패**: `401`(refresh token 무효), `422`(body 누락)

```json
{"code":401,"data":{"message":"로그인이 필요합니다."}}
```

---

### 1-5. 로그아웃

```
POST /api/auth/logout
```

**Request**
```json
{ "refresh_token": "q3Xv9..." }
```

**Response**
```json
{ "code": 200, "data": {} }
```

**동작**
1. body 의 refresh token 해시와 일치하는 `refresh_tokens` 행을 **삭제** → 이후 이 refresh token 으로 재발급 불가
2. 이미 없거나 만료된 토큰이어도 `code: 200` (같은 요청을 여러 번 보내도 결과 동일)
3. 프론트는 응답과 관계없이 저장된 access·refresh token 을 삭제하고 로그인 화면으로 이동

> **한계**: 로그아웃해도 이미 발급된 access token 은 `exp` 까지 유효하다 (서버가 access token 을 저장하지 않기 때문). 수명을 짧게 두어 위험을 줄인다.

**실패**: `422`(body 누락)

---

## 2. 챗봇

### 2-1. 질문 전송

```
POST /api/chat
Authorization: Bearer <token>
```

**Request**

| 필드 | 타입 | 설명 |
|------|------|------|
| `message` | string | 필수. 앞뒤 공백 제거 후 1~`MAX_MESSAGE_LENGTH`(1000)자 |

```json
{ "message": "FastAPI에서 CORS 설정은 어떻게 해?" }
```

**Response**
```json
{
  "code": 200,
  "data": {
    "chat_id": 987,
    "question": "FastAPI에서 CORS 설정은 어떻게 해?",
    "answer": "FastAPI에서는 CORSMiddleware를 사용합니다...",
    "created_at": "2026-09-14T10:05:12+09:00"
  }
}
```

**동작 흐름**

1. 인증 확인 (실패 `401`)
2. 요청마다 `request_id` 발급, 로그 `request_received`
3. 입력 검증 (빈 문자열·공백만 차단, 최대 1000자) — **AI 호출 이전에 수행** (실패 `422`)
4. 해당 사용자의 최근 성공 Q/A N개를 DB 에서 조회 → 컨텍스트 구성
5. Codyssey AI API 호출 (`httpx.AsyncClient`, 호출 전체 대기 상한 `AI_TIMEOUT_SECONDS`=30초, **서버 자동 재시도 없음**)
6. 결과를 `chat_logs` 에 저장 — **성공은 `status=success`, AI 실패도 `status=error` + `error_code` 로 저장** (관리자 실패 기록용)
7. 결과 반환

**컨텍스트 유지 정책**

- 같은 사용자의 최근 `AI_CONTEXT_TURNS`(**5**, A16 확정)개 **성공** Q/A 쌍을 프롬프트에 포함한다 (실패 기록은 제외).
- 토큰 초과 방지를 위해 **오래된 것부터** 잘라낸다.
- 조회는 항상 `WHERE user_id = <토큰의 사용자>` 로 강제한다. 클라이언트가 보낸 user_id 는 사용하지 않는다.

**실패**: `401`, `422`, `504`(AI 타임아웃), `502`(AI 호출 실패)

```json
{"code":422,"data":{"message":"질문은 1~1000자로 입력해 주세요."}}
{"code":504,"data":{"message":"현재 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요."}}
{"code":502,"data":{"message":"AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요."}}
```

> **AI 호출이 실패해도 서버는 종료되지 않고 위 응답을 반환해야 한다.**
> 타임아웃/실패 이후에 보낸 정상 질문은 계속 `code: 200` 으로 처리되어야 한다.

**AI 실패 시 재시도 방식 (확정)**

| 항목 | 규칙 |
|------|------|
| 서버 | AI 호출이 실패하면 **자동 재시도하지 않고** 즉시 `code: 504` / `502` 반환 |
| 프론트 | 오류 말풍선에 안내 문구 + **[다시 시도] 버튼** 표시 |
| 재시도 | 사용자가 버튼을 누르면 **같은 질문으로 `POST /api/chat` 을 새로 호출** (새 `request_id`) |
| 기록 | 실패한 요청은 `status=error` 로 남고, 재시도는 별도 행으로 저장된다 |
| 중복 방지 | 재시도 요청 중에는 버튼·전송 비활성 |

---

## 3. 대화 로그

### 3-1. 내 대화 로그 조회

```
GET /api/me/chats?limit=20&offset=0
Authorization: Bearer <token>
```

| 이름 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `limit` | int | 20 | 조회 개수 (최대 100) |
| `offset` | int | 0 | 시작 위치 |

**Response**
```json
{
  "code": 200,
  "data": {
    "total": 42,
    "items": [
      { "chat_id": 987, "question": "FastAPI에서 CORS 설정은 어떻게 해?", "answer": "FastAPI에서는 CORSMiddleware를 사용합니다...", "created_at": "2026-09-14T10:05:12+09:00" }
    ]
  }
}
```

| 필드 | 의미 |
|------|------|
| `total` | 해당 사용자의 전체 **성공** 기록 수 |
| `items` | 최신순. 성공 기록만 (AI 실패 기록 노출 여부는 [11-open-issues.md](11-open-issues.md) G5) |

**실패**: `401`

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password1234"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["access_token"])')

curl -s -H "Authorization: Bearer $TOKEN" 'http://localhost:8000/api/me/chats?limit=20&offset=0'
```

> 이 엔드포인트가 평가지의 **"사용자 기준 대화 로그 조회/추적"** 항목을 충족한다.

---

## 4. 관리자 (필수 — mission 2-2절 "관리자/내부 로그 확인 화면", 4-4절 "관리자 조회 API/화면")

### 4-0. 공통

| 항목 | 규칙 |
|------|------|
| 권한 | `require_admin` 의존성: 토큰 사용자 조회 → **DB 의 `users.role` 이 `admin` 이 아니면 `code: 403`** (토큰에 role 을 넣지 않고 매 요청 DB 확인) |
| 관리자 계정 생성 | 회원가입으로 불가. 서버 시작 시 `.env` 의 `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NICKNAME` 으로 생성(이미 있으면 `role=admin` 으로 승격). 관리자는 `ADMIN_EMAIL` 한 명뿐이라, 그 외 관리자 계정은 시작 시 `user` 로 내린다. 관리자 비밀번호는 시작 시 `ADMIN_PASSWORD` 로 맞춘다(다르면 바꾸고 refresh 토큰 폐기) |
| 조회 전용 | 수정·삭제 API 없음 |
| 노출 금지 | `hashed_password`, API 키, 토큰은 어떤 응답에도 포함하지 않는다 |
| 감사 로그 | 모든 관리자 API 호출을 로그로 남긴다 ([6. 서버 로그 이벤트 규약](#6-서버-로그-이벤트-규약)) |
| 페이지네이션 | 목록은 `limit`(기본 20, 최대 100) · `offset`, 응답 `{total, items}` |

**실패 공통**: `401`(토큰), `403`(일반 사용자)

```json
{"code":403,"data":{"message":"관리자만 접근할 수 있습니다."}}
```

### 4-1. 요약 통계

```
GET /api/admin/stats
```
```json
{
  "code": 200,
  "data": {
    "users": 12,
    "chats": { "total": 240, "success": 228, "failed": 12 },
    "failures": { "AI_TIMEOUT": 7, "AI_CALL_FAILED": 5 },
    "avg_latency_ms": 1320
  }
}
```
- `avg_latency_ms`: 성공 기록의 평균 AI 응답시간. **성공 기록이 하나도 없으면 `null`** (배포 직후, 모든 대화가 실패했을 때). `0` 으로 바꾸지 않는다 — "0ms, 아주 빠름"으로 읽힌다. 화면은 "–" 로 표시

### 4-2. 사용자 목록 · 검색

```
GET /api/admin/users?q=example&limit=20&offset=0
```

| 이름 | 설명 |
|------|------|
| `q` | 이메일 부분 검색 (선택) |

```json
{
  "code": 200,
  "data": {
    "total": 1,
    "items": [
      { "id": 1, "email": "user@example.com", "nickname": "어썸체크", "role": "user", "created_at": "2026-09-14T10:00:00+09:00", "chat_count": 44, "last_chat_at": "2026-09-14T10:06:00+09:00" }
    ]
  }
}
```
- **정렬: 최근 활동 순** (`last_chat_at` 최신순). 대화가 없는 사용자(`last_chat_at: null`)는 뒤에 최근 가입 순. 가입만 하고 쓰지 않는 계정보다 지금 쓰는 사용자를 먼저 본다
- `chat_count`: 성공 + 실패 **전체** 대화 수. 선택하면 나오는 사용자별 대화([4-3](#4-3-사용자별-대화-기록))의 `total` 과 같다

### 4-3. 사용자별 대화 기록

```
GET /api/admin/users/{user_id}/chats?limit=20&offset=0
```
```json
{
  "code": 200,
  "data": {
    "user": { "id": 1, "email": "user@example.com", "nickname": "어썸체크" },
    "total": 44,
    "items": [
      { "chat_id": 988, "question": "긴 글 요약해줘", "answer": null, "status": "error", "error_code": "AI_TIMEOUT", "latency_ms": 30000, "request_id": "351990af2cf2", "created_at": "2026-09-14T10:06:00+09:00" },
      { "chat_id": 987, "question": "FastAPI에서 CORS 설정은 어떻게 해?", "answer": "FastAPI에서는...", "status": "success", "error_code": null, "latency_ms": 1240, "request_id": "5d14c34e071f", "created_at": "2026-09-14T10:05:12+09:00" }
    ]
  }
}
```
- 성공·실패 기록 모두 최신순
- 없는 `user_id` → `code: 404`

### 4-4. AI 실패 기록

```
GET /api/admin/failures?limit=20&offset=0
```
```json
{
  "code": 200,
  "data": {
    "total": 12,
    "items": [
      { "chat_id": 988, "user_id": 1, "email": "user@example.com", "question": "긴 글 요약해줘", "error_code": "AI_TIMEOUT", "latency_ms": 30000, "request_id": "351990af2cf2", "created_at": "2026-09-14T10:06:00+09:00" }
    ]
  }
}
```
- `chat_logs.status = 'error'` 인 기록, 최신순. `request_id` 로 [4-5. 요청 흐름 로그](#4-5-요청-흐름-로그) 흐름 조회

### 4-5. 요청 흐름 로그

```
GET /api/admin/requests/{request_id}/logs
```
```json
{
  "code": 200,
  "data": {
    "request_id": "351990af2cf2",
    "items": [
      { "event": "request_received", "level": "INFO",    "user_id": 1, "detail": "path=/api/chat",                 "created_at": "2026-09-14T10:05:30+09:00" },
      { "event": "ai_call_start",    "level": "INFO",    "user_id": 1, "detail": "context_turns=2",                "created_at": "2026-09-14T10:05:30+09:00" },
      { "event": "ai_call_failed",   "level": "ERROR",   "user_id": 1, "detail": "reason=timeout latency_ms=30000", "created_at": "2026-09-14T10:06:00+09:00" },
      { "event": "db_save_success",  "level": "INFO",    "user_id": 1, "detail": "chat_id=988 status=error",       "created_at": "2026-09-14T10:06:00+09:00" }
    ]
  }
}
```
- `server_logs` 테이블에서 해당 `request_id` 의 이벤트를 시간순으로 반환 ([04-database.md](04-database.md))
- 기록이 없으면 `code: 404`

---

## 5. 연관 DB 스키마 (요약)

상세는 [04-database.md](04-database.md).

| 테이블 | 필드 |
|--------|------|
| `users` | id · public_id UNIQUE · email UNIQUE · hashed_password · nickname · **role**(user/admin) · created_at |
| `chat_logs` | id · **user_id** · **question** · **answer**(실패 시 NULL) · status · error_code · latency_ms · request_id · **created_at** |
| `server_logs` | id · request_id · level · event · user_id · detail · created_at |
| `refresh_tokens` | id · user_id · token_hash(SHA-256) UNIQUE · expires_at · created_at |

> 평가지 최소 추적 필드(사용자 / 시간 / 질문 / 응답)를 모두 포함한다.

---

## 6. 서버 로그 이벤트 규약

같은 이벤트를 **로그 출력(콘솔/파일)과 `server_logs` 테이블에 함께** 남긴다.

```
INFO  request_received   request_id=abc123 user_id=12 path=/api/chat
INFO  ai_call_start      request_id=abc123 user_id=12 context_turns=2
INFO  ai_call_success    request_id=abc123 latency_ms=1240
ERROR ai_call_failed     request_id=abc123 reason=timeout
INFO  db_save_success    request_id=abc123 user_id=12 chat_id=987
ERROR db_save_failed     request_id=abc123 user_id=12 reason=...
INFO  admin_access       request_id=def456 admin_id=1 path=/api/admin/users/12/chats
WARN  admin_forbidden    request_id=def457 user_id=12 path=/api/admin/stats
```

- 질문 원문·비밀번호·API 키·토큰은 로그에 남기지 않는다.
- `request_id` 로 한 요청의 흐름을 이어서 추적한다.

---

## 7. 합의된 값

팀이 합의해 확정한 값이다. 바꾸면 이 표와 관련 문서를 함께 갱신한다. 결정 과정은 [11-open-issues.md](11-open-issues.md).

| 항목 | 값 | 상태 |
|------|---------|------|
| access token 만료 시간 | **15분** (`JWT_EXPIRE_MINUTES=15`) | 확정 |
| 로그아웃 API · refresh token | **access + refresh token, `POST /api/auth/refresh`·`/logout` 제공** | 확정 (A7) |
| refresh token 수명 · 회전 · 형식 · 정리 | **1일** (`REFRESH_TOKEN_EXPIRE_DAYS=1`) · 재발급 시 회전 · 무작위 문자열 SHA-256 해시 저장 · 하루 1회 스케줄러 삭제 | 확정 |
| 로그아웃 요청에 필요한 토큰 | **body 의 refresh token 만** | 확정 (A7-8) — 기기별 로그아웃, access 만료 후에도 동작 |
| 컨텍스트 유지 개수 N | **5** (`AI_CONTEXT_TURNS=5`) | 확정 |
| AI API 타임아웃 | **30초, 호출 전체 대기 상한** (`AI_TIMEOUT_SECONDS=30`) | 확정 |
| AI 실패 재시도 | 서버 자동 재시도 없음, 사용자 [다시 시도] 버튼 | 확정 |
| 질문 최대 길이 | **1000자** (`MAX_MESSAGE_LENGTH=1000`) | 확정 |
| 사용할 AI API 제공자 | **Codyssey AI API (COPA)** | 확정 |
| 응답 형식 | `{code, data}`, HTTP 항상 200 | 확정 |
| 배포 | **Railway 서비스 2개 (프론트·백엔드 별도 도메인)** | 확정 |
| 토큰 저장 위치 | **`localStorage`** (access·refresh 같은 곳, refresh 는 body 전송) | 확정 (A15) — 근거·XSS 대응 [12-decisions.md 4. 토큰을 프론트에 저장하는 위치 — 위험성과 대안](12-decisions.md#4-토큰을-프론트에-저장하는-위치--위험성과-대안) |
