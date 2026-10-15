# 08. 평가 대응 체크리스트

> 기준: [features.md](features.md) · [03-api.md](03-api.md) · [02-architecture.md](02-architecture.md) · 미확정·불일치: [11-open-issues.md](11-open-issues.md)
> 범례: ✅ 완료 · 🟡 진행/부분 · ⬜ 미착수 — **실제 진행 기준** (설계 문서만 있으면 ⬜ 또는 "(설계)")

---

## 1. mission 요구사항 대조

### mission 2-1. 최종 결과물 — 웹 기반 AI 챗봇 (FastAPI)

| 요구 | 상태 | 대응 |
|------|:----:|------|
| 로그인 상태에서 웹 페이지로 텍스트 질문 입력 | ✅ | features.md F6 (Chat 화면) — 프론트(#45·#53) + 백엔드 `POST /api/chat`(#61·PR #62). **배포 서버 통합 확인**(2026-10-07, frontend/TESTING.md R 144·145) |
| 서버가 질문 수신 후 AI API 호출해 응답 생성 | ✅ | B7·B8 (`POST /api/chat` → Codyssey AI API) — #61·PR #62, pytest V10, 로컬 실서버에서 실제 Codyssey AI 응답 확인 |
| AI 응답이 웹 화면에 표시 | ✅ | F6 (같은 화면 누적) — 배포 서버에서 질문 → 답변·문맥 유지·새로고침 복원 확인 (TESTING R 144) |
| 평가 시점 외부 네트워크에서 접속 가능한 URL | ✅ | C2 — Railway 서비스 2개(프론트·백엔드 공개 도메인, HTTPS). 휴대폰 LTE 접속·CORS 허용/차단 확인(2026-10-06~07, TESTING R 133·134·154), [06-deployment.md 6. 배포 — Railway](06-deployment.md#6-배포--railway) |

### mission 2-2. 프로젝트 산출물

| 요구 | 상태 | 위치 |
|------|:----:|------|
| GitHub Repository 링크 | ✅ | [루트 README](../README.md) 맨 위에 저장소 `b7-1-chatbot-team/B7-1-chatbot` 링크·서비스 URL 기입 (2026-10-08 작성) |
| 프로젝트 개요(문제·타겟·시나리오) | ✅ | [01-scenario.md](01-scenario.md) |
| 시스템 구조(아키텍처·컴포넌트 역할) | ✅ | [02-architecture.md](02-architecture.md) |
| API 명세(요청/응답 예시) | ✅ | [03-api.md](03-api.md), Swagger `/docs`(로컬 전용 — `ENABLE_DOCS=true`, 운영은 꺼짐) |
| DB 구조(ERD·필드 설명) | ✅ | [04-database.md](04-database.md) |
| DB 확인 방법 안내 (1개 이상) | ✅ | ① `GET /api/me/chats`(#58·PR #59) · `/api/admin/*` 5종(#66·PR #67) **구현** ② "내 대화 로그"·**관리자 화면** (배포 서버 확인, TESTING R 146·149) ③ `scripts/check_logs.sql` **구현**(#11·PR #17). 사용 방법은 backend/README 9-4 |
| 배포 및 실행 방법(환경변수 설정 포함) | ✅ | [06-deployment.md](06-deployment.md) — Railway 절차·환경변수·정적 서버(Caddyfile)·트러블슈팅. 외부망·CORS·재배포 데이터 유지 확인(TESTING R 150) |
| 환경변수 키 목록(이름 수준) | ✅ | [06-deployment.md 3. 환경변수](06-deployment.md#3-환경변수) · 루트 README 6절, 프론트 `.env.*.example` |
| 팀 구성원 역할 및 개인별 작업 요약 | 🟡 | [09-team.md](09-team.md) — 마감 시 커밋 수·PR 과 함께 6절 갱신 |

### mission 4-1. 웹 UI

| 요구 | 상태 | 대응 |
|------|:----:|------|
| 질문 입력 웹 페이지 존재 | ✅ | `/chat` (F6, 배포 확인) |
| 질문 후 응답을 같은 화면에서 확인 | ✅ | 단일 페이지 말풍선 누적 (페이지 전환 없음) |

### mission 4-2. 사용자 인증 및 접근 제어

| 요구 | 상태 | 대응 |
|------|:----:|------|
| 회원가입 정상 동작 | ✅ | B3 (`POST /api/auth/signup`) — V01~V04 통과 (#16·PR #25) |
| 로그인 정상 동작 | ✅ | B4 (JWT 발급) — V05·V06 통과 (#16·PR #25) |
| 인증 상태에 따라 기능 구분 | ✅ | F4·F5·F10 (라우팅 가드, 메뉴 분기, 관리자 탭) — B01·B20. **프론트 완료**, 인증은 실서버로 확인(frontend/TESTING.md G). 관리자 API 는 비로그인 401 · 일반 사용자 403 (#66·PR #67, V31·V32 통과) |
| 챗봇 질문/응답은 로그인 사용자만 | ✅ | B6 (`get_current_user`) — V09 통과 (`/api/chat`·`/api/me/chats`) |
| 비밀번호 평문 저장 금지 | ✅ | B3 (bcrypt) — V04 통과 |

### mission 4-3. AI 챗봇 처리

| 요구 | 상태 | 대응 |
|------|:----:|------|
| 서버가 질문 수신 → AI API 호출 → 응답 생성 | ✅ | B7 `POST /api/chat` (#61·PR #62) — V10 통과, 실제 Codyssey AI 응답 확인 |
| AI 호출은 서버에서만, 키 클라이언트 미노출 | ✅ | B8 `services/ai_service.py` — `COPA_API_KEY` 는 서버 환경변수(`config.py`)로만 사용, 응답·로그에 미포함. 배포 번들 확인은 D05 |
| 최소한의 컨텍스트 전략 | ✅ | B10 (최근 5턴 성공 Q/A, 오래된 것부터 제거) — V11·V12 통과, 실제 AI 로 이어 질문 반영 확인 |

### mission 4-4. 대화 로그 저장 및 조회/추적

| 요구 | 상태 | 대응 |
|------|:----:|------|
| 질문과 AI 응답 DB 누적 저장 | ✅ | B2·B7 (`chat_logs`, 성공 status=success·실패 status=error) — V10·V15·V16 통과. 배포에서 Railway 로그·관리자 화면으로 증빙(TESTING R 151) |
| 최소 추적 필드: 사용자 식별·생성 시각·질문·응답 | ✅ | `user_id, created_at, question, answer` (+ `status`·`error_code`·`latency_ms`·`request_id`) — docs/04, `models/chat_log.py` (#11·PR #17) |
| 사용자 기준 로그 조회/추적 | ✅ | B12 `GET /api/me/chats`(#58·PR #59, V18·V19 통과) · B16·B17 관리자 사용자 목록·사용자별 대화(#66·PR #67, V34·V35 통과) |

### mission 4-5. 운영 및 유지보수

| 요구 | 상태 | 대응 |
|------|:----:|------|
| 로그: 요청 수신 | ✅ | `request_received` (B13) — #64·PR #65, V20 통과 |
| 로그: AI 호출 | ✅ | `ai_call_start` (B13) — #64·PR #65, V20 통과 |
| 로그: AI 응답 수신 또는 실패 | ✅ | `ai_call_success` / `ai_call_failed reason=` (B13) — #64·PR #65, V20 통과. 실제 AI 로 타임아웃(`reason=timeout`)·잘못된 키(`reason=auth_failed`) 확인 |
| 로그: DB 저장 성공·실패 | ✅ | `db_save_success` / `db_save_failed` (B13) — #64·PR #65, V20·V21 통과 (저장 실패 시 서버 유지) |
| AI 실패/타임아웃 시 비정상 종료 없음 | ✅ | B9 — V15~V17 통과 (호출 전체 30초 상한, 실패 저장 후 504/502, 장애 직후 정상 질문 200) |
| 사용자에게 오류 알림(메시지/상태코드/안내) | ✅ | `{code: 504/502, data:{message}}` + F7 오류 말풍선 — **프론트 완료**(문구 안내·다시 시도, 사용자 화면에는 코드 미표시 — 05-ui-ux 5절), **백엔드 완료**(PR #62). 배포 서버 확인. 요청 횟수 제한 429 도 프론트 안내 완료(#78) |
| 입력 검증 1개 이상 | ✅ | B11 (빈 입력·1000자, **서버 필수**, `code: 422`) + F8 (클라이언트 보조) — V13·V14 통과, 회원가입 입력도 V03 |
| (관리자) 실패 원인 추적 | ✅ | B18 AI 실패 기록 · B19 요청 흐름(#66·PR #67) + F13·F14(#49). 배포 서버에서 실패 탭·요청 흐름 확인(TESTING R 149) |

### mission 4-6. 배포 및 접근성

| 요구 | 상태 | 대응 |
|------|:----:|------|
| 외부 네트워크 접속 가능 | ✅ | Railway 프론트·백엔드 공개 도메인(HTTPS, http→https 301). 휴대폰 LTE·Chrome/Safari/Firefox/Edge 확인, SPA fallback·robots.txt·sitemap.xml (TESTING R 133~155) |
| 배포/실행 방법·환경변수 문서화 | ✅ | docs/06 (Railway) — Start Command·Caddyfile 보안 헤더·`VITE_API_BASE_URL` 빌드/실행 쓰임·트러블슈팅 |

### mission 4-7. 협업 및 형상관리

| 요구 | 상태 | 수행 방법 |
|------|:----:|-----------|
| 브랜치 전략 (main/develop) | ✅ | main·develop 분리. **main 은 보호 규칙(PR 리뷰 필수)**, develop 은 보호 없음(2026-10-08 확인) ([09-team.md 2-1. 브랜치](09-team.md#2-1-브랜치)) |
| 기능 단위 작업 브랜치 흔적 | ✅ | `feature/setup`, `feature/fe-setup`, 프론트 `feature/fe-*`·`refactor/fe-*`·`fix/fe-*` / 백엔드: `chore/be-init`, `feature/be-db`, `feature/be-auth-jwt`, `feature/be-logs`, `feature/be-chat`, `feature/be-server-logs`, `feature/be-admin`, `feature/be-rate-limit`, `feature/be-docs-toggle`, `feature/be-body-limit`, `feature/be-jwt-key-strength`, `fix/be-concurrent-chat`, `fix/be-admin-seed-demote`, `fix/be-chat-db-thread`, `fix/be-hide-user-id`, `fix/be-hide-chat-id` |
| PR 기반 Merge 기록 | ✅ | 머지된 PR 56건(2026-10-14 main) — 백엔드 17건(#15~#107), 프론트 32건(#4~#109), 초기 3건(#2·#3·#9), develop → main 반영 4건(#96·#102·#105·#110) |
| 팀원별 유의미한 커밋 10회 이상 | ✅ | 성원모 69회 · 이성준 111회 (2026-10-14 main, 머지 커밋 제외 `git shortlog -sn --no-merges`) |

### mission 5·6. 개발 환경 / 제약 사항

| 요구 | 상태 | 대응 |
|------|:----:|------|
| Python & FastAPI | ✅ (결정) | [02-architecture.md 1. 기술 스택](02-architecture.md#1-기술-스택) |
| SQLite, 평가자가 연결/조회 가능 | ✅ (결정) | Railway Volume `/data/app.db` + `check_logs.sql` |
| 민감정보 코드/문서에 직접 작성 금지 | ✅ | 코드는 환경변수 사용, git 전체 이력 비밀값 검색 결과 없음(2026-10-07, 13-security-review S11), 프론트 번들 비밀값 없음(배포 A7) |
| 모든 민감정보 환경변수 관리 | ✅ | B1 `config.py`(pydantic-settings) 로 `COPA_API_KEY`·`JWT_SECRET_KEY`·`ADMIN_PASSWORD` 등 로딩 (#10·PR #15) |
| `.env` 저장소 업로드 방지 | ✅ | 루트 `.gitignore` 에 `.env`·`.env.*`·`*.db`·`node_modules/`·`dist/` (#10, E12 해결). 2026-10-01 D08 명령 출력 없음 |
| README 에 환경변수 키 목록·설정 방법 | ✅ | [루트 README](../README.md) 6절 실행 방법·환경변수 표 |
| AI 호출 타임아웃 + 실패 시 오류 안내 | ✅ | 호출 전체 30초 상한(`asyncio.wait_for`), 타임아웃 504·그 외 실패 502 + 안내 문구 (PR #62, E11 해결) — V15·V16 통과 |
| 요청·AI 호출/응답·DB 저장 로그 | ✅ | B13 — 콘솔·`logs/app.log`·`server_logs` 에 같은 `request_id` 로 기록 (#64·PR #65), V20·V21 통과 |

---

## 2. 기능 번호 대조

> 이 절의 번호는 [features.md](features.md) 기준이다. [09-team.md 3. 역할 분담](09-team.md#3-역할-분담)·[4. 브랜치·커밋 계획 (팀원별 10회 이상 보장)](09-team.md#4-브랜치커밋-계획-팀원별-10회-이상-보장)의 번호 체계는 다르다 — [11-open-issues.md](11-open-issues.md) C6

### Backend

| 항목 | features.md | 상태 |
|------|-------------|:----:|
| 앱 기본 구성·공통 응답 봉투·CORS | B1 | ✅ #10·PR #15 (V22·V23 통과) + 운영에서 API 문서 화면 끄기(#90·PR #91) · 요청 본문 64KB 상한 413(#92·PR #93) · 서명 키 32바이트 미만이면 시작 거부(#94·PR #95) |
| DB 모델 (users·chat_logs·server_logs) | B2 | ✅ #11·PR #17 (+ refresh_tokens) |
| 회원가입 API | B3 | ✅ #16·PR #25 + 가입 IP 별 횟수 제한 429(#86·PR #87) · 응답에서 `id` 제거(#99·PR #101) |
| 로그인·재발급·로그아웃 API (access·refresh token) | B4 | ✅ #16·PR #25 (만료 행 정리 스케줄러 포함) + 로그인 실패 횟수 제한 429(#86·PR #87) · JWT `sub` 를 UUID(public_id)로(#99·PR #101) |
| 현재 사용자 API (role) | B5 | ✅ #16·PR #25 (응답에서 `id` 제거 #99·PR #101) |
| 인증 dependency | B6 | ✅ #16·PR #25 |
| 챗 API | B7 | ✅ #61·PR #62 + 사용자별 1분 10회 제한 429(#86·PR #87) · DB 작업 별도 스레드(#97·PR #98) · `chat_id` UUID(#106·PR #107) |
| AI 클라이언트 (Codyssey) | B8 | ✅ #61·PR #62 |
| 실패 처리 504/502 + 실패 저장 | B9 | ✅ #61·PR #62 |
| 컨텍스트 유지 | B10 | ✅ #61·PR #62 |
| 입력 검증 422 | B11 | ✅ #61·PR #62 |
| 내 로그 조회 API | B12 | ✅ #58·PR #59 (`chat_id` UUID #106·PR #107) |
| 서버 로그 (+ `server_logs`) | B13 | ✅ #64·PR #65 (관리자 감사 로그 `admin_access`/`admin_forbidden` 은 B15 에서) |
| 확인용 SQL | B14 | ✅ #11·PR #17 (`scripts/check_logs.sql`) |
| 관리자 권한·시드·감사 로그 | B15 | ✅ `require_admin`·관리자 시드(#16·PR #25) + 감사 로그 `admin_access`/`admin_forbidden`(#66·PR #67, V38 통과) + 시드 보강 — 이전 관리자 강등·비밀번호 `ADMIN_PASSWORD` 동기화(#84·PR #85) |
| 관리자 사용자 목록 | B16 | ✅ #66·PR #67 |
| 관리자 사용자별 대화 | B17 | ✅ #66·PR #67 |
| 관리자 AI 실패 기록 | B18 | ✅ #66·PR #67 |
| 관리자 통계·요청 흐름 | B19 | ✅ #66·PR #67 |

### Frontend

| 항목 | features.md | 상태 |
|------|-------------|:----:|
| 프로젝트 구성 (TypeScript·Vite·React·Router·axios·CSS Modules·Node 24) | F1 | ✅ TypeScript strict·alias·디자인 토큰·스타일링(#53)·SEO(#55) |
| 회원가입 화면 | F2 | ✅ 실서버 확인 |
| 로그인 화면 | F3 | ✅ 실서버 확인 |
| 인증 상태 관리 | F4 | ✅ 실서버 확인 (로그인 만료 알림 포함) |
| 보호 라우트 | F5 | ✅ 실서버 확인 (재발급 single-flight 포함) |
| 챗 화면 | F6 | ✅ 배포 서버 확인 |
| 오류 안내 | F7 | ✅ 배포 서버 확인 (429 안내 #78 포함) |
| 클라이언트 입력 검증 | F8 | ✅ |
| 내 대화 로그 화면 | F9 | ✅ 배포 서버 확인 |
| 관리자 가드·메뉴 | F10 | ✅ 실서버 확인 (비관리자 404) |
| 관리자 통계 | F11 | ✅ 배포 서버 확인 |
| 관리자 사용자 목록·대화 | F12 | ✅ 배포 서버 확인 (모바일 목록 접기·높이 제한 #75) |
| 관리자 AI 실패 기록 | F13 | ✅ 배포 서버 확인 |
| 관리자 요청 흐름 | F14 | ✅ 배포 서버 확인 |

### 공통 — 문서 & 협업

| 항목 | 상태 | 위치 |
|------|:----:|------|
| 프로젝트 개요 | ✅ | docs/01 |
| 시스템 구조 | ✅ | docs/02 |
| API 명세 | ✅ | docs/03 |
| DB 구조 | ✅ | docs/04 |
| DB 확인 방법 안내 | ✅ (문서) | docs/04 |
| 배포 및 실행 방법 | ✅ | docs/06 (Railway, 외부망·CORS 확인) |
| 환경변수 키 목록 | ✅ (문서) | [06-deployment.md 3. 환경변수](06-deployment.md#3-환경변수) |
| 팀 역할 및 개인별 작업 요약 | 🟡 | docs/09 |
| 기능 단위 작업 브랜치 흔적 | ✅ | feature/setup, feature/fe-setup, 프론트 feature/fe-* 등, 백엔드 feature/be-* 10개·fix/be-* 5개·chore/be-init |
| PR 기반 머지 기록 | ✅ | 머지된 PR 56건 (위 4-7 참고) |
| 성원모 — 커밋 10회 이상 | ✅ | 69회 (2026-10-14 main, 머지 커밋 제외 `git shortlog -sn --no-merges`) |
| 이성준 — 커밋 10회 이상 | ✅ | 111회 (2026-10-14 main, 같은 기준) |

---

## 3. 평가 당일 체크리스트

- [ ] Railway 프론트 URL 이 **휴대폰 데이터망**에서 열린다
- [ ] Railway **Serverless(슬리핑)가 꺼져 있다** (첫 요청 지연·502 방지)
- [ ] 브라우저 Console 에 **CORS 오류가 없다**
- [ ] 회원가입 → 로그인 → 질문 → 응답 → 로그 조회 전체 흐름 시연 준비
- [ ] 관리자 계정으로 통계 → 사용자별 대화 → AI 실패 기록 → 요청 흐름 시연 준비
- [ ] 비로그인 상태에서 챗 기능이 막히고, 일반 사용자는 관리자 화면에 못 들어가는지 확인
- [ ] AI API 실패 상황을 의도적으로 재현해 에러 안내가 나오는지 확인
- [ ] `sqlite3 backend/data/app.db < backend/scripts/check_logs.sql` 시연 준비 (Railway 는 관리자 화면으로 대체)
- [ ] 서버 로그(`request_received → ai_call_* → db_save_*`) 시연 준비
- [ ] 레포에 `.env` 가 올라가지 않았는지 확인 — `git ls-files | grep -E '(^|/)\.env$'`
- [ ] 코드 어디에도 API 키가 하드코딩되어 있지 않은지 검색으로 확인
- [ ] `git log --merges --oneline` 에 PR 머지 기록
- [ ] `git shortlog -sn` 팀원 2명(성원모·이성준) 모두 10 이상
- [x] README 서비스 URL / Repository 링크 기입 (2026-10-08)
