# 07. 검증 계획 및 결과

> [1. 검증 계획 (스펙 기준)](#1-검증-계획-스펙-기준)~[3. 실제 Codyssey AI API 연동 검증 (키 설정 후)](#3-실제-codyssey-ai-api-연동-검증-키-설정-후)은 팀 스펙(JWT · Codyssey AI API · `{code, data}` 응답 · 관리자 · Railway) 기준 검증 계획이다. 실행 결과는 [2. 진행 상태](#2-진행-상태)에 적는다.
>
> **판정 기준**: 서버 응답은 항상 HTTP 200 이므로, 아래 "기대" 의 `code` 는 **body 의 `code`** 를 뜻한다 ([03-api.md 0. 공통 규약](03-api.md#0-공통-규약)).

---

## 1. 검증 계획 (스펙 기준)

| 단계 | 방법 | 목적 | 담당 |
|------|------|------|------|
| **L1 서버 단위** | pytest + FastAPI `TestClient` (임시 DB) | 요구사항·경계 케이스 | 각 트랙 |
| **L2 API 흐름** | curl 스크립트 (body `code` 판정) | 가입→로그인→질문→응답→로그→관리자 전 흐름 | 팀장 |
| **L3 브라우저** | 수동 + (여유 시) Playwright | 화면 조작, 리다이렉트, 오류 표시, 반응형 | 이성준 |
| **L4 배포/외부망** | Railway 배포 URL 을 휴대폰 데이터망에서 접속, CORS 확인 | mission 4-6절 | 팀장 |
| **L5 데이터/로그** | `sqlite3`, 로그 확인 | DB 누적 저장·로그 이벤트 증빙 | 팀장 |

### 1-1. L1 — 서버 단위 케이스

| ID | 테스트 | 기대 | mission |
|----|--------|------|---------|
| V01 | 회원가입 | HTTP 200, `code: 201`, `data` 에 `hashed_password` 없음, role=user | 4-2절 |
| V02 | 같은 이메일 재가입 | `code: 409` | 4-2절 |
| V02b | 다른 이메일 + 같은 닉네임 | `code: 201` (닉네임 중복 허용) | 4-2절 |
| V03 | 비밀번호 7자 / 잘못된 이메일 / 닉네임 21자 | `code: 422`, `data.message` 존재, `detail` 키 없음 | 4-5절 |
| V04 | DB 의 `hashed_password` 확인 | bcrypt prefix(`$2b$`), 평문 아님 | 4-2절 |
| V05 | 로그인 성공 | `code: 200`, `data.access_token`·`refresh_token`·`token_type=bearer`·`expires_in=900`·`refresh_expires_in=86400`, `refresh_tokens` 에 해시 1행(원문 아님) | 4-2절 |
| V05b | `POST /api/auth/refresh` 유효 토큰 | `code: 200`, 새 토큰 쌍, (회전 시) 이전 refresh 로 재요청하면 `code: 401` | 4-2절 |
| V05c | refresh 만료 / 위조 / body 누락 | `code: 401` / `code: 401` / `code: 422` | 4-2절 |
| V05d | `POST /api/auth/logout` 후 같은 refresh 로 재발급 | 로그아웃 `code: 200`, 행 삭제, 재발급 `code: 401` | 4-2절 |
| V05e | 이미 폐기된 refresh 로 로그아웃 재요청 | `code: 200` (같은 결과) | 4-2절 |
| V05f | 만료 행 정리 작업 실행 (`delete_expired` 직접 호출) | `expires_at < now` 행만 삭제, 유효 행 유지 | 4-2절 |
| V06 | 틀린 비밀번호 / 없는 이메일 | `code: 401` (메시지 동일) | 4-2절 |
| V07 | `GET /api/auth/me` 유효 토큰 | `code: 200`, `data: {email, nickname, role}` (id 없음) | 4-2절 |
| V08 | 토큰 없음 / 변조 / 만료 | `code: 401` | 4-2절 |
| V09 | 비로그인 `POST /api/chat`, `GET /api/me/chats` | `code: 401` | 4-2절 |
| V10 | 챗 성공 | `code: 200`, `data: {chat_id, question, answer, created_at}`, `chat_logs` 1건(status=success) | 4-3절, 4-4절 |
| V11 | 두 번째 질문 | 프롬프트에 직전 Q/A 포함 (AI 클라이언트를 목으로 두고 payload 검사) | 4-3절 |
| V12 | 7번째 질문 | 컨텍스트가 `AI_CONTEXT_TURNS`(5)턴으로 제한됨, 실패 기록은 제외 | 4-3절 |
| V13 | 빈 문자열 / 공백만 | `code: 422`, AI 호출 안 됨 | 4-5절 |
| V14 | 1001자 → 422 / 1000자 → 200 (경계값) | | 4-5절 |
| V15 | AI 타임아웃 강제 (응답을 30초 넘게 지연 / `httpx.TimeoutException`) | `code: 504`, `chat_logs` status=error·error_code=AI_TIMEOUT, **서버 프로세스 유지** | 4-5절, 6절 |
| V16 | AI 500/429/연결 실패 강제 | `code: 502`, error_code=AI_CALL_FAILED | 4-5절 |
| V17 | 장애 직후 정상 질문 | `code: 200` (서비스 유지) | 4-5절 |
| V18 | 사용자 A 의 로그가 B 에게 안 보임 | `items` 에 타인 기록 없음 | 4-4절 |
| V19 | `limit=101` / `offset` 동작, 실패 기록 미포함 | 상한 처리, 최신순, `total` 정확 | 4-4절 |
| V20 | 로그 이벤트 | `request_received`·`ai_call_start`·`ai_call_success`/`ai_call_failed`·`db_save_success` 가 로그와 `server_logs` 에 존재, **비밀번호·API 키·질문 원문 미기록** | 4-5절 |
| V21 | DB commit 실패 강제 | 파일 로그에 `db_save_failed`, 서버 유지 | 4-5절 |
| V22 | CORS preflight (`OPTIONS`) | 허용 Origin 은 `access-control-allow-origin` 헤더 있음, 미허용은 없음 | 배포 |
| V23 | 없는 경로 / 처리 안 된 예외 | `code: 404` / `code: 500` 봉투 형식 | 4-5절 |
| V30 | 서버 시작 시 관리자 시드 | `ADMIN_EMAIL` 계정 role=admin, 재시작해도 중복 생성 없음 | 2-2절 |
| V31 | 일반 사용자 `GET /api/admin/*` 5종 | 모두 `code: 403`, 로그 `admin_forbidden` | 4-2절 |
| V32 | 비로그인 `GET /api/admin/*` | `code: 401` | 4-2절 |
| V33 | `GET /api/admin/stats` | 사용자 수·성공/실패·에러별 건수·평균 응답시간이 DB 와 일치 | 4-5절 |
| V34 | `GET /api/admin/users?q=` | 이메일 부분 검색, chat_count 정확, 응답에 `hashed_password` 없음 | 4-4절 |
| V35 | `GET /api/admin/users/{id}/chats` | 성공·실패 모두 최신순 / 없는 id → `code: 404` | 4-4절 |
| V36 | `GET /api/admin/failures` | status=error 만, error_code·request_id 포함 | 4-5절 |
| V37 | `GET /api/admin/requests/{request_id}/logs` | 해당 요청 이벤트 시간순 / 없는 id → `code: 404` | 4-5절 |
| V38 | 관리자 API 호출 감사 로그 | `admin_access admin_id= path=` 기록 | 4-5절 |

### 1-2. L2 — API 흐름 스크립트

```bash
BASE=${BASE:-http://localhost:8000}
EMAIL="e2e_$(date +%s)@example.com"
code() { python3 -c 'import sys,json;print(json.load(sys.stdin)["code"])'; }

# 1. 회원가입 → 201 / 2. 중복 → 409
curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password1234\",\"nickname\":\"e2e\"}" | code
curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password1234\",\"nickname\":\"e2e\"}" | code

# 3. 비로그인 차단 → 401
curl -s -X POST $BASE/api/chat -H 'Content-Type: application/json' -d '{"message":"hi"}' | code

# 4. 로그인
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password1234\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["access_token"])')
AUTH="Authorization: Bearer $TOKEN"

# 5. 내 정보 → 200
curl -s -H "$AUTH" $BASE/api/auth/me | code

# 6. 질문 2회 (문맥 유지 확인)
curl -s -X POST $BASE/api/chat -H "$AUTH" -H 'Content-Type: application/json' -d '{"message":"배포 방법 알려줘"}'
curl -s -X POST $BASE/api/chat -H "$AUTH" -H 'Content-Type: application/json' -d '{"message":"내가 방금 뭘 물어봤지?"}'

# 7. 입력 검증 → 422
curl -s -X POST $BASE/api/chat -H "$AUTH" -H 'Content-Type: application/json' -d '{"message":"   "}' | code

# 8. 로그 조회 → data.total ≥ 2
curl -s -H "$AUTH" "$BASE/api/me/chats?limit=20&offset=0"

# 9. 잘못된 토큰 → 401 / 10. 일반 사용자 관리자 API → 403
curl -s -H "Authorization: Bearer xxx" $BASE/api/auth/me | code
curl -s -H "$AUTH" $BASE/api/admin/stats | code

# 11. 관리자 (ADMIN_EMAIL / ADMIN_PASSWORD 는 환경변수로 전달, 스크립트에 쓰지 않음)
ATOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["access_token"])')
curl -s -H "Authorization: Bearer $ATOKEN" $BASE/api/admin/stats
curl -s -H "Authorization: Bearer $ATOKEN" "$BASE/api/admin/users?q=e2e_"
curl -s -H "Authorization: Bearer $ATOKEN" $BASE/api/admin/failures
```

체크: `201 / 409 / 401 / 200 / 문맥 반영 / 422 / total≥2 / 401 / 403 / 관리자 3종 200`

### 1-3. L3 — 브라우저 확인 항목

| ID | 사용자 행동 | 기대 결과 |
|----|-------------|-----------|
| B01 | 비로그인으로 `/chat` 접속 | `/login` 이동, 게스트 메뉴만 표시 |
| B02 | 빈 폼 제출 | 클라이언트 검증 메시지, **네트워크 요청 없음** |
| B03 | 회원가입 성공 | `/login` 이동 + 안내 + 이메일 자동 입력 |
| B04 | 같은 이메일 재가입 | "이미 가입된 이메일입니다." |
| B05 | 틀린 비밀번호 | "이메일 또는 비밀번호가 올바르지 않습니다.", 비밀번호 칸만 비움, 로그인 화면 유지 |
| B06 | 로그인 성공 | `/chat` 이동, 헤더에 닉네임·탭 표시 (관리자 탭 없음) |
| B07 | 질문 Enter 전송 | 사용자 말풍선 즉시 → 로딩 → 봇 말풍선 (같은 화면) |
| B08 | "내가 방금 뭘 물어봤지?" | 답변에 직전 질문 맥락 포함 |
| B09 | 한글 조합 중 Enter | 전송 안 됨, 조합 완료 후 Enter 는 1회만 전송 |
| B10 | 공백만 입력 | 전송 버튼 비활성 |
| B11 | 1200자 입력 | 1000자에서 잘림, 카운터 강조 |
| B12 | AI 실패 재현 (`COPA_API_KEY` 를 잘못된 값으로 두고 재배포) | 오류 말풍선 + `502 · AI_CALL_FAILED` + [다시 시도] 버튼, 서버 유지, **자동 재요청 없음**(Network 에 `/api/chat` 1회) |
| B12b | 키를 정상으로 되돌린 뒤 [다시 시도] 클릭 | 같은 질문으로 `/api/chat` 1회 재호출, 오류 말풍선이 응답으로 교체, 요청 중 버튼 비활성 |
| B13 | 새로고침 | 로그인 유지(`/auth/me`), 이전 대화 복원 |
| B14 | 내 대화 로그 | 카드 수 = 성공 질문 수, `total` 표시 |
| B15 | 새 계정의 로그 화면 | "아직 저장된 대화가 없습니다." |
| B16 | 로그아웃 → 뒤로가기 | Network 에 `POST /api/auth/logout`, 두 토큰 삭제, `/login` 유지 (보호 페이지 재진입 차단) |
| B17 | access token 만료 후 요청 (`JWT_EXPIRE_MINUTES=1` 로 테스트) | 화면 이동 없이 refresh 후 요청 성공 |
| B17b | refresh token 까지 무효인 상태로 요청 | 로그인 화면으로 이동 |
| B17c | access 만료 상태에서 **API 를 2개 이상 동시에 호출하는 화면 진입**(챗: `/auth/me`+`/me/chats`, 관리자: stats+users) | Network 에 `POST /api/auth/refresh` **1회만** 기록(single-flight), 두 요청 모두 재시도 성공, 로그아웃되지 않음 ([12-decisions.md 15. 토큰 재발급 동시성 — single-flight](12-decisions.md#15-토큰-재발급-동시성--single-flight)) |
| B18 | 375px 폭 | 가로 스크롤 0, 1열 |
| B19 | 백엔드 중지 상태에서 질문 | "서버에 연결할 수 없습니다" 말풍선 |
| B20 | 일반 사용자·비로그인이 `<관리자 주소>` 직접 입력 | 없는 주소와 **같은 404 화면**, 주소 그대로. `/admin` 은 관리자에게도 404 |
| B20b | 없는 주소 입력 | 404 Not Found (로그인 화면으로 보내지 않음) |
| B21 | 관리자 로그인 | 헤더에 "관리자" 탭, `<관리자 주소>` 요약 카드 표시 |
| B22 | 관리자: 이메일 검색 → 사용자 선택 | 해당 사용자 대화(성공·실패 배지) 표시, 새로고침해도 `?user=` 유지 |
| B23 | 관리자: AI 실패 기록 → request_id 클릭 | 요청 흐름 타임라인 표시 |
| B24 | 관리자 화면 375px 폭 | 패널 세로 배치, 가로 스크롤 0 |

### 1-4. L4 — 배포 / 외부망 (Railway)

| ID | 확인 | 기대 |
|----|------|------|
| D01 | 휴대폰 데이터망에서 Railway 프론트 URL 접속 | 화면 로드 |
| D02 | 외부망에서 가입→로그인→질문→응답→로그→관리자 | 전 흐름 성공 |
| D03 | 브라우저 Console / Network | **CORS 오류 없음**, preflight(OPTIONS) 통과 ([06-deployment.md 7. 외부 접속 · CORS 검증 (평가 전 필수)](06-deployment.md#7-외부-접속--cors-검증-평가-전-필수)) |
| D04 | 허용되지 않은 Origin 으로 preflight | `access-control-allow-origin` 헤더 없음 |
| D05 | 프론트 번들 검색 | `COPA_API_KEY` 값 등 비밀값 미포함 |
| D06 | 백엔드 재배포 후 기존 계정 로그인 | 성공 (Volume 에 DB 유지) |
| D07 | `/chat`, `<관리자 주소>` 에서 새로고침 | 404 없이 화면 로드 (SPA fallback) |
| D08 | `git ls-files \| grep -E '(^\|/)\.env$'` | 출력 없음 |

### 1-5. L5 — 데이터 / 로그 증빙

```bash
sqlite3 backend/data/app.db < backend/scripts/check_logs.sql
sqlite3 backend/data/app.db "SELECT event, detail FROM server_logs WHERE request_id='<id>' ORDER BY id;"
grep ai_call_failed backend/logs/app.log
```
- `chat_logs` 에 질문·응답이 누적되는지, 실패는 `status=error` 로 남는지
- 한 요청의 `request_id` 로 `request_received → ai_call_start → ai_call_success → db_save_success` 가 이어지는지
- `users.hashed_password` 가 bcrypt 해시(60자)인지

---

## 2. 진행 상태

| 단계 | 상태 | 비고 |
|------|:----:|------|
| L1 서버 단위 | ✅ | 2026-10-10 `cd backend && pytest -q` **83건 통과** (`test_auth.py`·`test_me_chats.py`·`test_chat.py`·`test_admin.py`·`test_app.py`). V01~V23(V02b·V05b~V05f 포함)·V30~V38 + 추가 케이스(여러 기기 로그인, 관리자 승격, 사용자별 컨텍스트, 키 미설정 502, `auth_failed`, 평균 응답시간 null, 이메일 검색 `%` 글자 그대로, 최근 활동 순, **동시 챗 요청 시 서버 멈춤 방지 #74**, **관리자 시드 — 이전 관리자 강등·비밀번호 동기화 #85**, **요청 횟수 제한 429 — 챗·로그인 실패·가입·실제 IP #87**, **API 문서 운영에서 끄기 #91**, **요청 본문 64KB 상한 413·비밀번호 128자 #93**, **서명 키 32바이트 미만이면 시작 거부**). AI 호출은 가짜 AI 서버(`httpx.MockTransport`) |
| L2 API 흐름 | ✅ | [1-2. L2 — API 흐름 스크립트](#1-2-l2--api-흐름-스크립트)의 curl 단계(가입·로그인·질문·422·401·403·관리자)는 2026-10-08 로컬 백엔드 침투·통합 테스트에서 개별 실행해 확인([13-security-review.md](13-security-review.md) 7절). 2026-10-01 로컬 실서버 Swagger(`/docs`)에서 실제 Codyssey AI 로 가입(201)→중복 가입(409)→로그인→질문(200)→이어 질문(직전 대화 반영)→공백 질문(422)→토큰 없이 요청(401) 수동 확인 (PR #62 스크린샷). 2026-10-06 관리자 계정으로 요약 통계 → 사용자 목록·검색 → 사용자별 대화 → 없는 사용자 404 → 일반 사용자 403 → 감사 로그(`admin_access`·`admin_forbidden`) 수동 확인 (PR #67 스크린샷) |
| L3 브라우저 | ✅ | 프론트 자동 테스트 **268건** · 수동 확인 168항목 — [frontend/TESTING.md](../frontend/TESTING.md). 인증은 로컬 실서버(G), 내 대화 로그 API 는 로컬 실서버(G-2), **챗·로그·관리자 전체는 배포 서버(R, 2026-10-06~07)** 로 확인. Chrome·Safari·Firefox·Edge, 아이폰 13 mini·안드로이드 실기기 |
| L4 배포/외부망 | ✅ | 2026-10-06~07 Railway 프론트·백엔드 공개 도메인(HTTPS)에서 A~F 단계 확인 — HTTPS·CORS 허용/차단·401/403·번들 비밀값 없음·휴대폰 LTE 접속·재배포 후 데이터 유지(TESTING R 133~155). 2026-10-08 보안 헤더·침투 테스트 배포 6건([13-security-review.md](13-security-review.md) 7절) |
| L5 데이터/로그 | ✅ | 로컬(2026-10-02, PR #65): `AI_TIMEOUT_SECONDS=1` → 504, `COPA_API_KEY=invalid` → 502, `request_received → ai_call_start → ai_call_failed → db_save_success status=error` 가 같은 `request_id` 로 기록. **배포(2026-10-07)**: Railway Deploy Logs 에 같은 순서로 남고 질문·토큰 미기록 확인(TESTING R 151), 관리자 화면 요청 흐름에서도 확인 |

---

## 3. 실제 Codyssey AI API 연동 검증 (키 설정 후)

1. `backend/.env` (배포는 Railway Variables) 에 `COPA_API_KEY` 입력 → 재시작
2. L2 스크립트 실행 (문맥 유지 항목은 실제 모델이 문장을 바꿔 말하므로 **의미로 판정**)
3. 실제 타임아웃: `AI_TIMEOUT_SECONDS=0.5` 로 낮추고 질문 → `ai_call_failed reason=timeout`, `code: 504`
4. 실제 호출 실패: `COPA_API_KEY=invalid` 로 두고 질문 → `ai_call_failed reason=auth_failed`, `code: 502`
5. rate limit: 짧은 시간에 반복 호출 → `429` → `code: 502`, 로그 `reason=rate_limited`
6. 위 3~5 직후 정상 질문이 `code: 200` 인지 확인 (서비스 유지)
7. 관리자 화면 AI 실패 기록·요청 흐름에 3~5 가 보이는지 확인
