# 02. 시스템 구조 · 내부 절차 · 기술 결정

> 관련 문서: [03-api.md](03-api.md) · [04-database.md](04-database.md) · [features.md](features.md)
> 이 문서는 시스템 구조와 **내부 처리 절차·결정 근거**를 정리한다. 미확정·불일치 항목: [11-open-issues.md](11-open-issues.md)

## 1. 기술 스택

### 백엔드

| 구분 | 기술 | 용도 / 근거 |
|------|------|-------------|
| 언어 | **Python 3.11+** | mission 5절 필수 |
| 프레임워크 | **FastAPI** | mission 5절 필수. 웹 서버·라우팅 |
| ASGI 서버 | **Uvicorn** | 애플리케이션 실행 |
| ORM | **SQLAlchemy 2.0** | DB 접근 계층 분리 |
| DB | **SQLite** | 사용자 / 대화 로그 / 서버 로그 저장. 파일 1개라 평가자가 `sqlite3` 로 바로 확인 가능 |
| 스키마 검증 | **Pydantic v2** | 요청·응답 형식 관리 |
| 설정 관리 | **pydantic-settings**, python-dotenv | 환경변수 로딩 (mission 6절) |
| 비밀번호 해싱 | **bcrypt** | 단방향·salt 내장. 평문 저장 금지 |
| 인증 | **PyJWT** | 토큰 발급·검증 |
| HTTP 클라이언트 | **httpx `AsyncClient`** | AI API 비동기 호출, 타임아웃 제어 (현재 코드의 `requests` 는 교체 대상) |
| 로깅 | 표준 `logging` + `server_logs` 테이블 | 운영 이벤트 추적 (mission 4-5절), 관리자 요청 흐름 조회 |

### 프론트엔드

| 구분 | 기술 |
|------|------|
| 라이브러리 | **React 19** |
| 언어 | **TypeScript** (`strict: true`, `tsc --noEmit` 로 빌드 전 검사) |
| 빌드 도구 | **Vite** (Node 24, `.nvmrc`) |
| 라우팅 | **React Router** |
| HTTP | **axios** |
| 상태 관리 | **Context API** (전역 상태가 `user`·인증 상태뿐이라 별도 라이브러리를 쓰지 않는다) |
| 서버 데이터 | **직접 관리** (TanStack Query 미도입 — [12-decisions.md 17. 토큰 변경을 useSyncExternalStore 로 구독](12-decisions.md#17-토큰-변경을-usesyncexternalstore-로-구독)) |
| 스타일 | **CSS Modules** (`*.module.css`, Vite 기본 지원) + 전역 CSS 변수 |
| 테스트 | **Vitest** + **MSW**(네트워크 모킹) + **happy-dom**(DOM·localStorage 환경) |
| import 경로 | alias **`@/`** → `src` (`tsconfig.app.json` 의 `paths` + `vite.config.ts` 의 `resolve.alias`) |

### 외부 서비스

| 구분 | 선택 | 비고 |
|------|------|------|
| AI API | **Codyssey AI API (COPA)** | 교육 환경 제공 API. OpenAI 호환 `chat/completions` 형식 |
| 배포 | **Railway** | 한 프로젝트에 서비스 2개 — 백엔드(Volume `/data`) · 프론트, 서비스별 도메인 |
| 형상관리 | **GitHub** (조직 `b7-1-chatbot-team`) | PR 기반 협업 |

## 2. 아키텍처

```mermaid
flowchart TD
    subgraph client["브라우저"]
        React["React SPA<br/>TypeScript · Vite · React Router · axios · CSS Modules"]
    end

    subgraph railway["Railway 프로젝트"]
        Web["frontend 서비스<br/>정적 빌드(dist) 서빙<br/>https://&lt;frontend&gt;.up.railway.app"]
        subgraph api["backend 서비스 · https://&lt;backend&gt;.up.railway.app"]
            MW["미들웨어<br/>CORS · request_id · 공통 응답 봉투"]
            Router["라우터<br/>auth · chat · me · admin"]
            Service["서비스 계층<br/>인증 · AI 호출 · 관리자 조회"]
            Crud["CRUD 계층<br/>SQLAlchemy 2.0"]
        end
        Vol[("Volume /data<br/>SQLite app.db<br/>users · chat_logs · server_logs")]
    end

    AI["Codyssey AI API<br/>httpx · 타임아웃"]

    Web -. "HTML/JS 다운로드" .-> React
    React -->|"HTTPS · JSON + JWT<br/>(다른 도메인 → CORS)"| MW
    MW --> Router
    Router --> Service
    Service --> Crud
    Service -->|"질문 + 최근 대화"| AI
    AI -->|"응답"| Service
    Crud --> Vol
```

프론트와 백엔드는 Railway 에서 **서로 다른 도메인**으로 서비스된다. 따라서
- 백엔드에 **CORS 설정이 필수**다 (`CORS_ORIGINS` 에 개발 서버 + Railway 프론트 도메인).
- 쿠키 대신 **Authorization 헤더 기반 JWT** 를 쓴다 ([4. 인증 방식 결정: JWT vs 서버 측 세션](#4-인증-방식-결정-jwt-vs-서버-측-세션)).
- SQLite 파일은 재배포에도 남도록 **Volume(`/data`)** 에 둔다.

## 3. 디렉터리 구조

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 앱, CORS, 라우터 등록, 예외 핸들러(공통 봉투), 관리자 시드
│   │   ├── config.py            # 환경변수 로딩 (pydantic-settings)
│   │   ├── database.py          # 엔진·세션·Base·get_db (SQLite 파일 DB 는 NullPool)
│   │   ├── models/              # SQLAlchemy 모델 (user.py, chat_log.py, server_log.py)
│   │   ├── schemas/             # Pydantic 스키마 (auth.py, chat.py, admin.py, common.py)
│   │   ├── routers/             # auth.py, chat.py, me.py, admin.py
│   │   ├── services/            # auth_service.py, ai_service.py, admin_service.py
│   │   ├── crud/                # user.py, chat_log.py, server_log.py, refresh_token.py
│   │   └── core/                # security.py, dependencies.py, logging.py, responses.py, rate_limit.py, body_limit.py
│   ├── scripts/check_logs.sql
│   └── requirements.txt
├── frontend/
│   ├── .nvmrc
│   ├── tsconfig.app.json        # strict: true, 경로 alias paths(@/* → ./src/*)
│   ├── vite.config.ts           # resolve.alias(@ → ./src) — tsconfig 의 paths 와 함께 수정
│   ├── .env.development.example # 개발 모드 (npm run dev / build:dev)
│   ├── .env.production.example  # 운영 모드 (npm run build)
│   └── src/
│       ├── api/
│       │   ├── instance.ts      # 기본 설정(baseURL·headers·timeout) + 인터셉터 등록만
│       │   ├── interceptors/    # attachToken · normalize · refresh(single-flight)
│       │   ├── auth.ts          # signup·login·refresh·logout·me (chat.ts, logs.ts 동일 구조)
│       │   ├── ApiError.ts      # code·안내 문구·재시도용 config 를 담는 Error 파생
│       │   ├── types.ts         # 요청·응답 타입 (docs/03-api.md 와 1:1)
│       │   └── axios.d.ts       # _retried 플래그 모듈 확장
│       ├── store/
│       │   ├── authContext.ts   # Context 객체 (컴포넌트와 파일을 나눈다)
│       │   ├── AuthProvider.tsx # 토큰 구독·사용자 복원·login/logout·로그인 만료 알림
│       │   ├── toastContext.ts · ToastProvider.tsx # 토스트 목록·show (AuthProvider 바깥)
│       │   └── types.ts         # AuthStatus, AuthContextValue
│       ├── utils/               # tokenStorage.ts (토큰 저장 + 변경 구독·지운 이유, 저장소 차단 시 메모리 대체, 아무것도 import 안 함),
│       │                        # validators.ts (입력 검증 규칙·길이 상한), datetime.ts (시간 표기 규칙), resultLabel.ts
│       ├── hooks/               # useAccessToken(useSyncExternalStore), useAuth, useField(입력 상태), useSubmit(제출 상태),
│       │                        # useAbortableRequest(요청·취소), useChatHistory·usePagedList(목록), useDebouncedValue, useToast, usePageMeta(제목·noindex·canonical)
│       ├── routes/              # paths.ts(경로 상수), types.ts, index.tsx(라우트 정의), guards.tsx
│       ├── layouts/             # AppLayout(본문 바로가기 + 헤더 + 본문·오류 경계), Header(메뉴·토스트 자리)
│       ├── pages/               # Login, Signup, NotFound(404), chat/, logs/, admin/ (화면별 폴더 + *.module.css)
│       ├── components/          # Button(6상태·아이콘 버튼), Field, Alert, Icon, Spinner·LoadingStatus, Toast, Timestamp,
│       │                        # HistoryScroller(위로 스크롤·[새 메시지]), ErrorBoundary + *.module.css
│       ├── mocks/               # 브라우저 MSW — handlers.ts(가짜 백엔드), browser.ts. VITE_ENABLE_MOCK=true 일 때만
│       ├── styles/              # reset.css(브라우저 기본값), global.css(디자인 토큰·공통 기본값),
│       │                        # motion.module.css·text.module.css (composes 로 쓰는 공용 애니메이션·글자)
│       ├── types/               # 여러 화면이 공유하는 타입 (user.ts)
│       ├── test/                # server.ts(MSW), setup.ts — 테스트는 *.test.ts 로 대상 옆에 둔다
│       ├── App.tsx              # 앱 틀 — 레이아웃으로 라우트 전체를 감쌈
│       └── main.tsx             # 진입 — MSW 시작, 마운트, Provider(Router·Auth)
├── .gitignore
└── README.md
```

빌드 때 `vite.config.ts` 의 플러그인이 `robots.txt`·`sitemap.xml`(VITE_SITE_URL 이 있을 때)을 만들고, 운영 빌드에서 MSW 워커 파일을 뺀다 (05-ui-ux.md 9절).

프론트엔드 타입은 구현 파일과 섞지 않고 타입 파일로 분리한다. **여러 페이지·컴포넌트가 공유하는 타입은 `src/types/`** 에, **한 영역에서만 쓰는 타입은 그 폴더의 `types.ts`**(`routes/types.ts`, `api/types.ts`) 에 둔다. 한 컴포넌트 전용 props 는 그 컴포넌트 파일 안에 둔다.

백엔드는 위 `backend/app/` 구조로 구현돼 있다. 초기 골격 `backend/main.py` 는 PR #62 에서 삭제했다 ([11-open-issues.md](11-open-issues.md) A22). 관리자 API(`routers/admin.py`, PR #67)와 `core/logging.py`(PR #65)까지 모두 구현됐다.

### 컴포넌트 역할

| 계층 | 역할 |
|------|------|
| **React SPA** | 화면 렌더링, 토큰 보관, 입력 1차 검증, 라우팅 가드(로그인·관리자) |
| **frontend 서비스** | 빌드 결과(`dist`) 정적 서빙. API 는 거치지 않음 |
| **미들웨어** | CORS 허용 Origin 검사, `request_id` 발급, `request_received` 로그 |
| **라우터** | HTTP 엔드포인트 정의, 인증·관리자 dependency 적용, 스키마 바인딩. **DB 를 직접 건드리지 않음** |
| **서비스 계층** | 비즈니스 로직 — 비밀번호 해싱·검증, JWT 발급, 컨텍스트 구성, AI 호출과 예외 처리, 관리자 집계 |
| **CRUD 계층** | DB 질의 전담 |
| **SQLite (Volume)** | 사용자·대화 로그·서버 로그 영속 저장 |
| **Codyssey AI API** | 외부 AI 응답 생성. **키는 서버 환경변수에만 존재** |

| 파일 | 역할 |
|------|------|
| `app/main.py` | 앱 생성, CORS 미들웨어, 라우터 등록, 예외 핸들러(`RequestValidationError`·`HTTPException`·`Exception` → `{code, data:{message}}`, HTTP 200), 시작 시 서명 키 검사(비었거나 32바이트 미만이면 시작 거부)·관리자 시드, lifespan 에서 **만료 refresh token 정리 스케줄러(하루 1회)** 실행 |
| `app/core/responses.py` | `ok(data, code=200)` / `fail(code, message)` — 공통 봉투 생성 |
| `app/config.py` | `.env` → `Settings`. 비밀값은 코드에 기본값을 두지 않음 |
| `app/database.py` | 엔진/세션 팩토리, `PRAGMA foreign_keys=ON`, `get_db` 의존성. SQLite 파일 DB 는 연결 풀 없이(NullPool) — 동시 챗 요청에서 풀이 바닥나 서버가 멈추던 문제 대응(PR #74) |
| `app/models/` | `User`(role), `ChatLog`(status·error_code·latency_ms·request_id), `ServerLog` |
| `app/schemas/` | 요청 스키마 + 응답 `data` 스키마 |
| `app/core/security.py` | bcrypt 해시·검증, JWT 인코드·디코드 |
| `app/core/dependencies.py` | `get_current_user` (Bearer → 사용자, 실패 401) · `require_admin` (DB role 확인, 실패 403) |
| `app/core/logging.py` | 구조화 로그 포맷, `request_id`, 이벤트를 파일/콘솔 + `server_logs` 에 기록 |
| `app/core/rate_limit.py` | 요청 횟수 제한(429) — 챗 사용자별 · 로그인 실패 이메일/IP 별 · 가입 IP 별 메모리 카운터, 실제 IP 는 X-Forwarded-For 마지막 값(PR #87) |
| `app/core/body_limit.py` | 요청 본문 크기 상한 — 64KB 넘으면 본문을 읽지 않고 413 (chunked 요청은 읽는 중 차단) |
| `app/services/auth_service.py` | 가입/로그인 로직, 이메일 중복 검사, access·refresh token 발급·재발급·폐기 |
| `app/services/ai_service.py` | 컨텍스트 구성, httpx Codyssey AI API 호출, 타임아웃·예외 → 504/502 |
| `app/services/admin_service.py` | 통계, 사용자 목록, 사용자별 대화, 실패 기록, 요청 흐름 |
| `app/routers/auth.py` | signup / login / refresh / logout / me |
| `app/routers/chat.py` | `POST /api/chat` |
| `app/routers/me.py` | `GET /api/me/chats` |
| `app/routers/admin.py` | `GET /api/admin/*` |
| `frontend/src/api/` | axios 인스턴스 + 인터셉터 (Authorization 자동 첨부, `code` 판단, 401 재발급 single-flight, 봉투 없는 응답 처리) |
| `frontend/src/utils/tokenStorage.ts` | 토큰 읽기·쓰기·삭제 + **변경 구독**. 아무것도 import 하지 않는 끝점 |
| `frontend/src/hooks/` | `useAccessToken`(토큰 구독) · `useAuth`(인증 상태 소비) · `useField`(입력 값·검증·터치) · `useSubmit`(제출 중 상태·중복 차단, `{ ok, data \| error }` 반환) |
| `frontend/src/components/` | `Field`(label 연결·`aria-invalid`·`role="alert"`, 오류 시 도움말 숨김) · `Button`(6가지 상태·제출 중 잠금·아이콘 버튼) · `Alert`(문구만, 코드 미표시) · `Toast`(상시 알림 영역) · `HistoryScroller`(아래가 최신·위로 스크롤·[새 메시지]) · `ErrorBoundary`(앱 오류 화면) · `Timestamp`(목록 시각) |
| `frontend/src/utils/validators.ts` | 이메일·비밀번호·닉네임 검증과 입력 길이 상한. 클라이언트 검증은 서버 검증의 보조 |
| `frontend/src/mocks/` | 개발용 가짜 백엔드(브라우저 MSW). 운영 빌드에서 코드와 워커 파일 모두 제거됨 |
| `frontend/src/store/ToastProvider.tsx` | 토스트 목록과 `show()`. AuthProvider 바깥에 둬 로그인 만료 알림을 인증 쪽에서 띄운다 |
| `frontend/src/store/AuthProvider.tsx` | 인증 상태 전역 관리, 앱 로드 시 `/api/auth/me` (role 포함). 사용자를 **확인에 쓴 토큰과 함께** 보관해 토큰이 바뀌면 재확인. 토큰을 직접 지우지 않음(연결 실패 시 이 탭만 비로그인). Context 객체는 `store/authContext.ts` 에 분리 |
| `frontend/src/routes/guards.tsx` | `RequireAuth` · `RequireAdmin` · `GuestOnly` |
| `frontend/src/pages/` | Login · Signup · NotFound · chat/ · logs/ · admin/ — 화면마다 `usePageMeta` 로 제목·noindex |

## 4. 인증 방식 결정: JWT vs 서버 측 세션

### 결론: **JWT Bearer access token (PyJWT, HS256) + DB 저장 refresh token**

- access token 은 짧게, 서버에 저장하지 않음 → 요청마다 DB 조회 없이 검증
- refresh token 은 해시로 DB 에 저장 → 재발급·**로그아웃 시 서버에서 폐기** 가능 ([03-api.md 1-4. 토큰 재발급](03-api.md#1-4-토큰-재발급)·[1-5. 로그아웃](03-api.md#1-5-로그아웃))

### 비교

| 기준 | JWT + Authorization 헤더 (**채택**) | 서버 측 세션 + 쿠키 |
|------|-----------------------------------|--------------------|
| **크로스 도메인** | 헤더 방식이라 도메인이 달라도 문제 없음 | `SameSite=None; Secure` + CORS `credentials` 설정 필요, 서드파티 쿠키 차단 정책에 취약 |
| **무상태** | access token 검증은 DB 조회 없음 (refresh token 만 재발급·로그아웃 때 조회) | 요청마다 세션 조회 |
| **CSRF** | 쿠키 자동 첨부가 없어 CSRF 자체가 성립하지 않음 | 대응 필요(SameSite·Origin 검사) |
| **즉시 무효화** | 만료 전까지 유효 (약점) | DB 행 삭제로 즉시 무효 |
| **XSS 시 탈취** | localStorage 저장 시 노출 (약점) | HttpOnly 로 JS 접근 차단 |
| **구현 복잡도** | 낮음. `PyJWT` 인코드/디코드 + dependency 1개 | 세션 테이블·만료 청소·쿠키 속성 관리 |

### 이 프로젝트에서 JWT 를 택한 이유

1. **프론트와 백엔드가 Railway 에서 서로 다른 도메인이다.** 쿠키 인증은 크로스 사이트 쿠키가 되어 `SameSite=None; Secure` 와 CORS `credentials` 를 모두 맞춰야 하고, 브라우저의 서드파티 쿠키 차단 정책에 영향을 받는다. 헤더 방식은 이 문제가 없다.
2. 구현 범위가 작다. 백엔드·프론트가 병렬로 작업하는 상황에서 **인증 dependency 하나**로 챗·로그·관리자 라우터가 재사용할 수 있다 ([features.md](features.md) B6).
3. CSRF 대응이 불필요해 백엔드 보안 작업량이 줄어든다.

### 채택에 따른 약점과 보완

| 위협 | 보완 |
|------|------|
| 로그아웃 후에도 access token 이 만료 전까지 유효 | access token 수명을 **15분**으로 짧게(`JWT_EXPIRE_MINUTES=15`), 로그아웃 시 **서버가 refresh token 행을 삭제**해 재발급 차단, 프론트는 두 토큰 즉시 삭제 |
| refresh token 탈취 | DB 에는 SHA-256 해시만 저장, 재발급 시 회전으로 이전 토큰 무효화, 만료 **1일**(`REFRESH_TOKEN_EXPIRE_DAYS=1`) |
| XSS 로 localStorage 토큰 탈취 | 저장 위치는 **`localStorage` 확정**(A15). 해시·암호화 저장은 방어가 되지 않으므로 ① XSS 예방 — React 기본 이스케이프 유지(`dangerouslySetInnerHTML` 미사용, AI 답변도 텍스트 렌더링), 외부 스크립트 미삽입, 의존성 최소화 ② 피해 축소 — access 15분·refresh 회전·로그아웃 시 서버 폐기 ([12-decisions.md 4. 토큰을 프론트에 저장하는 위치 — 위험성과 대안](12-decisions.md#4-토큰을-프론트에-저장하는-위치--위험성과-대안)) |
| 관리자 권한 강등 후에도 토큰으로 접근 | 토큰에 role 을 넣지 않고 `require_admin` 이 **매 요청 DB 의 `users.role` 을 확인** |
| `JWT_SECRET_KEY` 유출 시 전체 토큰 위조 | 키는 `.env` 로만 주입, 저장소 커밋 금지, Railway Variables 로 설정 |
| 알고리즘 혼동 공격(`alg:none` 등) | 디코드 시 `algorithms=["HS256"]` 을 **명시적으로 고정** |
| 네트워크 도청 | Railway 도메인 HTTPS 기본 제공 |
| 계정 존재 추측 | 로그인 실패 메시지를 하나로 통일 |

## 5. 내부 처리 절차

모든 응답은 **HTTP 200 + `{code, data}`** 이다 ([03-api.md 0. 공통 규약](03-api.md#0-공통-규약)). 아래 다이어그램의 `code:` 는 body 의 값이다.

### 5-1. 회원가입 `POST /api/auth/signup`

```mermaid
sequenceDiagram
    participant B as Browser (React)
    participant A as FastAPI
    participant D as SQLite
    B->>B: 클라이언트 검증 (이메일 형식, 비번 8자+, 닉네임 1~20)
    B->>A: {email, password, nickname}
    A->>A: Pydantic 검증 실패 → code:422
    A->>D: crud.user.get_by_email(email)
    alt 이미 존재
        A-->>B: code:409 (닉네임은 중복 검사 안 함)
    else 신규
        A->>A: bcrypt 해싱
        A->>D: crud.user.create(..., role="user") — UNIQUE 경합 시 IntegrityError → 409
        A-->>B: code:201 {id, email, nickname, created_at}
    end
    B->>B: 로그인 화면 이동 + "가입 완료" 안내
```

### 5-2. 로그인 `POST /api/auth/login`

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as FastAPI
    participant D as SQLite
    B->>A: {email, password}
    A->>D: crud.user.get_by_email(email)
    A->>A: bcrypt 비교 (사용자 없으면 더미 해시와 비교 → 응답시간 동일)
    alt 불일치
        A-->>B: code:401 "이메일 또는 비밀번호가 올바르지 않습니다."
    else 일치
        A->>A: access = jwt.encode({sub: user.public_id, exp: now + JWT_EXPIRE_MINUTES}, SECRET, HS256)
        A->>A: refresh = secrets.token_urlsafe(48)
        A->>D: refresh_tokens INSERT (user_id, sha256(refresh), expires_at)
        A-->>B: code:200 {access_token, refresh_token, token_type, expires_in, refresh_expires_in}
    end
    B->>B: 두 토큰 저장 → GET /api/auth/me (role) → AuthContext 갱신 → /chat 이동
```

### 5-2b. 재발급 `POST /api/auth/refresh` · 로그아웃 `POST /api/auth/logout`

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as FastAPI
    participant D as SQLite
    B->>A: GET /api/me/chats (만료된 access token)
    A-->>B: code:401
    B->>A: POST /api/auth/refresh {refresh_token}
    A->>D: refresh_tokens WHERE token_hash = sha256(refresh) AND expires_at > now
    alt 없음·만료
        A-->>B: code:401 → 토큰 삭제, /login 이동
    else 유효
        A->>D: 기존 행 DELETE + 새 refresh 행 INSERT (회전)
        A-->>B: code:200 {access_token, refresh_token, ...}
        B->>A: GET /api/me/chats 재시도 (새 access token)
    end
    Note over B,D: 로그아웃
    B->>A: POST /api/auth/logout {refresh_token}
    A->>D: refresh_tokens DELETE WHERE token_hash = sha256(refresh)
    A-->>B: code:200 {} (행이 없어도 200)
    B->>B: 두 토큰 삭제 → /login
```

### 5-3. 인증 확인 `get_current_user` / `require_admin`

1. `Authorization` 헤더 없음 / `Bearer ` 형식 아님 → **code:401**
2. `jwt.decode(token, SECRET, algorithms=["HS256"])` 실패(만료·서명 오류) → **code:401**
3. payload `sub`(public_id)로 사용자 조회, 없으면 **code:401** (이전 형식인 정수 `sub` 토큰도 여기서 401)
4. (`require_admin`) `user.role != "admin"` → **code:403**, 로그 `admin_forbidden`
5. 사용자 반환 → 라우터는 `user.id` 만 사용. **클라이언트가 보낸 user_id 는 절대 사용하지 않는다.**

프론트: axios 인터셉터가 **인증 API(login·refresh·logout)가 아닌 요청**의 `code:401` 을 감지 → `POST /api/auth/refresh` 1회 → 성공 시 원래 요청 재시도 / 실패 시 토큰 삭제 → AuthContext `user=null` → 라우팅 가드가 `/login` 으로 이동.

### 5-4. 챗 파이프라인 `POST /api/chat` (핵심)

```mermaid
sequenceDiagram
    participant B as Browser
    participant R as chat router
    participant S as ai_service
    participant C as crud
    participant D as SQLite
    participant G as Codyssey AI API
    B->>R: POST /api/chat {message} + Bearer 토큰
    R->>R: request_id 발급, log request_received
    R->>R: get_current_user (실패 code:401)
    R->>R: ① 입력 검증 strip → 1~1000자 (실패 code:422)
    R->>S: ask(user_id, message, request_id)
    S->>C: ② recent_success_for_context(user_id, AI_CONTEXT_TURNS)
    C->>D: SELECT ... WHERE status='success' ORDER BY id DESC LIMIT 5
    S->>S: messages = [최근 Q/A ...(오래된 순)] + [현재 질문]
    S->>S: log ai_call_start
    S->>G: ③ await client.post(...) — 전체 30초 상한
    alt 성공
        G-->>S: 응답 텍스트
        S->>S: log ai_call_success latency_ms
        S->>C: ④ chat_log.create(status="success", answer, latency_ms, request_id)
        R-->>B: code:200 {chat_id, question, answer, created_at}
    else 30초 초과 (TimeoutError / httpx.TimeoutException)
        S->>S: log ai_call_failed reason=timeout
        S->>C: ④ chat_log.create(status="error", error_code="AI_TIMEOUT")
        R-->>B: code:504 {message}
    else 그 외 호출 실패 (4xx/5xx/연결 오류/빈 응답)
        S->>S: log ai_call_failed reason=...
        S->>C: ④ chat_log.create(status="error", error_code="AI_CALL_FAILED")
        R-->>B: code:502 {message}
    end
    Note over S,D: ④ 저장 성공 → log db_save_success / 실패 → rollback, log db_save_failed (응답은 유지)
```

**설계 포인트**

| 항목 | 결정 | 이유 |
|------|------|------|
| 검증 위치 | AI 호출 **이전** | 빈 입력으로 외부 API 호출·쿼터 소모 방지 |
| 서버 검증 | 프론트 검증과 **별개로 필수** | API 를 직접 호출하면 프론트 검증을 우회할 수 있음 ([features.md](features.md) B11) |
| 컨텍스트 | 같은 사용자 최근 `AI_CONTEXT_TURNS`(5) **성공** Q/A | 토큰 비용 상한 고정, 실패 기록은 문맥에 의미 없음 |
| 컨텍스트 초과 | **오래된 것부터 잘라냄** | 최근 맥락 우선 유지 |
| 타임아웃 | 호출 전체를 `asyncio.timeout(AI_TIMEOUT_SECONDS)`(30초)로 감싸고 httpx 타임아웃도 설정 | httpx 타임아웃은 연결·읽기 **단계별**로 적용되므로 전체 대기 상한을 따로 둔다 |
| 예외 변환 | `TimeoutException`→504, 나머지→502 | 사용자에게는 두 코드만 노출, 상세 원인은 로그 `reason=` 으로 |
| 실패 저장 | AI 실패도 `chat_logs` 에 `status=error` 로 저장 | 관리자 "AI 실패 기록"·통계 |
| 서버 유지 | 예외를 잡아 봉투 응답으로 변환 | **AI 실패로 서버가 종료되면 안 됨** (mission 4-5절) |
| 재시도 | **서버 자동 재시도 없음.** 실패를 즉시 안내하고 사용자가 [다시 시도] 버튼으로 재요청 | 쿼터 중복 소모·대기시간 누적 방지, 사용자가 상황을 알고 선택 ([12-decisions.md](12-decisions.md)) |
| 비동기 | `httpx.AsyncClient` + `await` | 대기 중 다른 요청 처리 |
| 로그 내용 | 질문 **원문 미기록**, 길이/식별자만 | 로그 파일·`server_logs` 개인정보 노출 방지 |

### 5-5. 내 로그 조회 `GET /api/me/chats`

- `WHERE user_id = 토큰의 사용자 AND status = 'success'` 를 강제 → 타 사용자 기록 조회 불가
- `total` + `items`(최신순, `limit`/`offset`), `limit` 최대 100

### 5-6. 관리자 조회 `GET /api/admin/*`

```mermaid
sequenceDiagram
    participant B as Browser (관리자)
    participant R as admin router
    participant S as admin_service
    participant D as SQLite
    B->>R: GET /api/admin/users/12/chats + Bearer
    R->>R: require_admin (401 / 403 + log admin_forbidden)
    R->>R: log admin_access admin_id path
    R->>S: user_chats(12, limit, offset)
    S->>D: users 조회 (없으면 code:404)
    S->>D: chat_logs WHERE user_id=12 (성공·실패 모두)
    R-->>B: code:200 {user, total, items}
    B->>R: GET /api/admin/requests/{request_id}/logs
    R->>D: server_logs WHERE request_id ORDER BY id
    R-->>B: code:200 {request_id, items}
```

| 화면 요구 | API |
|-----------|-----|
| 요약 통계 | `GET /api/admin/stats` |
| 사용자 목록·검색 | `GET /api/admin/users?q=` |
| 사용자별 대화 | `GET /api/admin/users/{user_id}/chats` |
| AI 실패 기록 | `GET /api/admin/failures` |
| 요청 흐름 로그 | `GET /api/admin/requests/{request_id}/logs` |

## 6. Codyssey AI API 연동 메모

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `POST https://copa.codyssey.kr/v1/chat/completions` (OpenAI 호환 형식, `services/ai_service.py` 의 `AI_API_URL`) |
| 호출 방식 | `httpx.AsyncClient` 로 REST 직접 호출 (`async def` 라우트에서 `await`, 클라이언트는 앱 시작 시 1개 생성해 재사용) |
| 모델 | `gpt-5-mini` (`services/ai_service.py` 의 `AI_MODEL`) |
| 키 전달 | `Authorization: Bearer <COPA_API_KEY>`. **서버에서만 사용**, 응답·프론트 번들에 절대 포함하지 않음 |
| 컨텍스트 형식 | `messages: [{role:"user"|"assistant", content}]` — 이전 Q/A 를 user/assistant 쌍으로 나열한 뒤 현재 질문 |
| 실패 유형 | 타임아웃 / 401·403(키 오류) / 429(호출 제한) / 5xx / 연결 실패 / 빈 응답 |
| 호출 제한 | 교육 환경의 제한값 미확인. 429 는 502 로 처리하고 로그 `reason=rate_limited` 로 구분 |

## 7. 요청 흐름 요약

1. 사용자가 브라우저에서 Railway 프론트 도메인에 접속 → React 화면 로드
2. 질문 입력 → axios 가 **백엔드 도메인**으로 `POST /api/chat` 호출 (`Authorization: Bearer <token>`, CORS preflight)
3. FastAPI 가 `request_id` 발급, 인증 dependency 로 사용자 확인
4. 서비스 계층이 CRUD 를 통해 해당 사용자의 최근 성공 대화 N개 조회
5. httpx 로 Codyssey AI API 호출 (타임아웃 설정)
6. 결과(성공·실패)를 `chat_logs` 에, 각 단계 이벤트를 로그와 `server_logs` 에 저장
7. HTTP 200 + `{code, data}` 반환, React 가 `code` 로 판단해 화면에 렌더링
