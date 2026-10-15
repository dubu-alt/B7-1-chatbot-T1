# 06. 설치 · 실행 · 배포

> 관련 문서: [02-architecture.md](02-architecture.md) · [03-api.md](03-api.md)
> 배포 플랫폼: **Railway** — 한 프로젝트에 서비스 2개(백엔드·프론트), 서비스마다 별도 도메인

## 1. 요구 환경

- Python 3.11+
- Node.js 24 LTS (`frontend/.nvmrc` 로 고정 — `nvm use`)
- sqlite3 CLI (DB 확인용)

## 2. 설치

### 백엔드

`backend/requirements.txt` (목표 구성 — 현재 파일과의 차이는 [11-open-issues.md](11-open-issues.md) E9·E10)

```
fastapi
uvicorn[standard]
sqlalchemy
pydantic[email]
pydantic-settings
python-dotenv
bcrypt
pyjwt
httpx
```

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# backend/.env 를 만들고 3절 키를 입력 (예시 파일은 두지 않음)
uvicorn app.main:app --reload
# → http://localhost:8000  ·  Swagger: http://localhost:8000/docs (backend/.env 에 ENABLE_DOCS=true 일 때만)
```

### 프론트엔드

```bash
cd frontend
nvm use                     # Node 24
npm install                 # react · react-router-dom · axios · typescript (스타일은 CSS Modules, 설치 없음)
cp .env.development.example .env.development
cp .env.production.example  .env.production   # 배포용 값은 보통 Railway Variables 로 대체
npm run dev
# → http://localhost:5173  (development 모드)

npm run typecheck           # tsc -b (타입 검사)
npm run lint                # oxlint
npm run test                # vitest run (단위 테스트)
npm run test:watch          # vitest (변경 감지)
npm run build               # 타입 검사 + production 모드 빌드 → dist
npm run build:dev           # 타입 검사 + development 모드 빌드 (개발용 값으로 확인할 때)
```

## 3. 환경변수

### `backend/.env` (아래 키 목록으로 직접 작성)

**`.env` 는 절대 커밋하지 않는다.** 백엔드는 예시 파일을 두지 않고 **이 절의 키 목록이 기준**이다 (팀 결정).

```
COPA_API_KEY=
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=1
DATABASE_URL=sqlite:///./data/app.db
AI_TIMEOUT_SECONDS=30
AI_CONTEXT_TURNS=5
MAX_MESSAGE_LENGTH=1000
CORS_ORIGINS=
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NICKNAME=
LOG_FILE=logs/app.log
CHAT_RATE_LIMIT_PER_MINUTE=10
LOGIN_FAIL_LIMIT_PER_EMAIL=5
LOGIN_FAIL_LIMIT_PER_IP=20
SIGNUP_RATE_LIMIT=20
TRUST_FORWARDED_FOR=false
ENABLE_DOCS=true
```

| 키 | 기본값 | 설명 | 민감 |
|----|--------|------|:----:|
| `COPA_API_KEY` | (없음) | Codyssey AI API 키 — **서버에서만 사용** | ✅ |
| `JWT_SECRET_KEY` | (없음) | JWT 서명 키. **32바이트 이상이어야 서버가 시작된다** — `python -c "import secrets;print(secrets.token_urlsafe(48))"` 로 만든 값(64자)을 넣는다. 키를 바꾸면 기존 로그인 토큰이 모두 무효가 되어 사용자는 다시 로그인해야 한다 | ✅ |
| `JWT_ALGORITHM` | `HS256` | 서명 알고리즘. 디코드 시에도 이 값으로 **고정** | |
| `JWT_EXPIRE_MINUTES` | `15` | access token 만료(분). 응답 `expires_in` = ×60 | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `1` | refresh token 만료(일). 응답 `refresh_expires_in` = ×86400 | |
| `DATABASE_URL` | `sqlite:///./data/app.db` | SQLAlchemy URL. Railway 는 `sqlite:////data/app.db` ([6-1. 백엔드 서비스](#6-1-백엔드-서비스)) | |
| `AI_TIMEOUT_SECONDS` | `30` | AI API 호출 전체 대기 상한(초) | |
| `AI_CONTEXT_TURNS` | `5` | 프롬프트에 포함할 최근 성공 Q/A 수 | |
| `MAX_MESSAGE_LENGTH` | `1000` | 질문 최대 글자수 | |
| `CORS_ORIGINS` | (없음) | 허용 Origin, 쉼표 구분. 예: `http://localhost:5173,https://<프론트>.up.railway.app` | |
| `ADMIN_EMAIL` | (없음) | 서버 시작 시 생성(또는 `role=admin` 승격)할 관리자 이메일. **관리자는 이 이메일 한 명뿐** — 관리자 교체는 이 값을 바꾸고 재배포하면 되고, 이전 관리자는 시작 시 일반 사용자로 내려간다(로그 `admin_seed_demoted`) | |
| `ADMIN_PASSWORD` | (없음) | 관리자 비밀번호 (8자 이상). 서버 시작 시 관리자 계정 비밀번호를 이 값으로 맞춘다 — 바꾸고 재배포하면 새 비밀번호가 적용되고 관리자의 기존 로그인 세션은 끊긴다(로그 `admin_seed_password_reset`) | ✅ |
| `ADMIN_NICKNAME` | (없음) | 관리자 닉네임 | |
| `CHAT_RATE_LIMIT_PER_MINUTE` | `10` | 사용자별 챗 요청, 1분에 이 횟수까지. 넘으면 `code: 429` | |
| `LOGIN_FAIL_LIMIT_PER_EMAIL` | `5` | 로그인 실패, 이메일별 10분에 이 횟수까지. 넘으면 비밀번호가 맞아도 `code: 429` | |
| `LOGIN_FAIL_LIMIT_PER_IP` | `20` | 로그인 실패, IP 별 10분에 이 횟수까지. 같은 공인 IP 를 여럿이 쓰는 환경을 고려해 이메일별보다 넉넉하게 | |
| `SIGNUP_RATE_LIMIT` | `20` | 가입 요청, IP 별 10분에 이 횟수까지 | |
| `TRUST_FORWARDED_FOR` | `false` | **Railway 는 `true`**. 프록시 뒤에서 X-Forwarded-For 의 마지막 값(프록시가 덧붙인 실제 접속 IP)으로 IP 별 제한을 센다. 끄면 모든 사용자가 프록시 IP 하나로 묶인다. 로컬은 false(헤더를 사용자가 꾸밀 수 있음) | |
| `ENABLE_DOCS` | `false` | API 문서 화면(`/docs` · `/redoc` · `/openapi.json`)을 열지. **로컬 개발만 `true`, Railway 는 넣지 않음**(기본 false → 세 경로 404). 운영에 관리자 API 를 포함한 전체 목록이 공개되지 않게 하기 위해서다 | |
| `MAX_BODY_BYTES` | `65536` | 요청 본문 크기 상한(바이트, 64KB). 넘으면 본문을 읽지 않고 `code: 413`. 보통 바꿀 일 없음 | |
| `LOG_FILE` | `logs/app.log` | 이벤트 로그 파일 경로(`backend/` 기준). 비우면 콘솔에만 기록. 로컬은 설정하지 않아도 됨. **Railway 는 `/data/logs/app.log`** — 컨테이너 안의 파일은 재배포·재시작 때 사라지므로 DB 와 같은 Volume 에 둔다 ([6-1. 백엔드 서비스](#6-1-백엔드-서비스)) | |

### `frontend/.env.development` · `frontend/.env.production`

프론트는 **Vite 모드(mode)** 에 따라 다른 파일을 읽는다. 저장소에는 값 예시 파일 두 개(`*.example`)만 두고, 실제 파일은 커밋하지 않는다.

| 모드 | 사용 명령 | 읽는 파일 | 용도 |
|------|-----------|-----------|------|
| development | `npm run dev` · `npm run build:dev` | `.env.development` | 로컬 백엔드(`http://localhost:8000`) 연결 |
| production | `npm run build` | `.env.production` | 배포용 백엔드 도메인 연결 |

```
# .env.development
VITE_API_BASE_URL=http://localhost:8000

# .env.production
VITE_API_BASE_URL=https://<backend>.up.railway.app
```

| 키 | 설명 |
|----|------|
| `VITE_API_BASE_URL` | 백엔드 Base URL. axios `baseURL` 로 사용 |
| `VITE_ADMIN_PATH` | 관리자 화면 주소. 짐작하기 어려운 무작위 값을 쓰고 **문서·코드에 적지 않는다**. 비우면 관리자 화면 미등록 (05-ui-ux.md 화면 5) |
| `VITE_SITE_URL` | 배포된 프론트 주소(끝에 `/` 없이). canonical·`sitemap.xml`, 링크 미리보기의 `og:url`·`og:image`(절대 주소)에 쓴다. 비우면 모두 만들지 않는다 (05-ui-ux.md 9절) |

코드에서는 `import.meta.env.VITE_API_BASE_URL` 로 읽고, 현재 모드는 `import.meta.env.MODE`(`development` / `production`)로 확인한다. Node 생태계의 `NODE_ENV` 와 같은 역할이다.

> **프론트 `.env` 에는 비밀값을 절대 넣지 않는다.** `VITE_` 접두어 변수는 빌드 결과물에 그대로 포함되어 브라우저에서 볼 수 있다. AI API 키(`COPA_API_KEY`)는 백엔드에만 둔다.
> `VITE_` 변수는 **빌드 시점**에 박히므로, 값을 바꾸면 프론트를 다시 빌드·배포해야 한다.

## 4. 로컬 실행 확인

응답은 항상 HTTP 200 + `{code, data}` 이므로 **body 의 `code` 를 확인**한다 ([03-api.md 0. 공통 규약](03-api.md#0-공통-규약)).

```bash
# 1) 백엔드
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# 2) 프론트 (새 터미널)
cd frontend && npm run dev

# 3) API 확인
curl -s -X POST http://localhost:8000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password1234","nickname":"어썸체크"}'
# {"code":201,"data":{...}}

TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password1234"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["access_token"])')

curl -s -X POST http://localhost:8000/api/chat \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"FastAPI에서 CORS 설정은 어떻게 해?"}'

curl -s -H "Authorization: Bearer $TOKEN" 'http://localhost:8000/api/me/chats?limit=20&offset=0'
```

## 5. CORS 설정

프론트와 백엔드가 **Railway 에서 서로 다른 도메인**으로 배포되므로 CORS 가 필수다. 설정이 없으면 브라우저가 API 응답을 차단한다 (curl 은 CORS 와 무관하게 성공하므로 브라우저로 확인해야 한다).

```python
# app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,   # 개발 서버 + Railway 프론트 도메인
    allow_credentials=False,                    # JWT 헤더 방식이라 쿠키 불필요
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
```

- 개발: `http://localhost:5173`, `http://127.0.0.1:5173`
- 배포: `https://<프론트 서비스>.up.railway.app` (커스텀 도메인을 붙이면 그 도메인도 추가)
- `allow_origins=["*"]` 는 쓰지 않는다.
- Origin 값은 **끝에 `/` 없이** 정확히 일치해야 한다.

## 6. 배포 — Railway

한 Railway 프로젝트에 GitHub 저장소(`b7-1-chatbot-team/B7-1-chatbot`)를 연결하고, **Root Directory 가 다른 서비스 2개**를 만든다.

```
Railway Project
 ├─ backend  (Root /backend)   → https://<backend>.up.railway.app   + Volume /data
 └─ frontend (Root /frontend)  → https://<frontend>.up.railway.app
```

> GitHub 조직 저장소는 **조직에 Railway GitHub App 을 설치**해야 레포 목록에 나타난다 (조직 설정 → GitHub Apps).

### 6-1. 백엔드 서비스

| 항목 | 값 |
|------|-----|
| Root Directory | `/backend` |
| Build | Railpack 자동 감지 (`requirements.txt` 로 설치) |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (**비워 두면 안 됨** — Railpack 자동 감지는 Root Directory 바로 아래의 `main.py`·`app.py` 만 찾는데, 진입점은 `app/main.py` 라 직접 지정해야 한다) |
| Volume | 마운트 경로 `/data` |
| 도메인 | Settings → Networking → **Generate Domain** (프론트가 브라우저에서 직접 호출하므로 공개 도메인 필요) |
| 배포 브랜치 | `main` (평가 배포 기준. 개발 확인용으로 develop 을 연결할지는 팀 결정) |

**Variables**: [3. 환경변수](#3-환경변수)의 키를 모두 등록 (`.env` 파일 업로드 금지). 배포 시 달라지는 값:

| 키 | 값 |
|----|-----|
| `DATABASE_URL` | `sqlite:////data/app.db` |
| `LOG_FILE` | `/data/logs/app.log` (로그 파일도 Volume 에 저장 — 재배포해도 유지) |
| `CORS_ORIGINS` | `https://<frontend>.up.railway.app` |
| `TRUST_FORWARDED_FOR` | `true` (요청 횟수 제한이 프록시 IP 하나로 묶이지 않고 실제 접속 IP 로 세도록) |

`ENABLE_DOCS` 는 넣지 않는다(기본 false → `/docs`·`/redoc`·`/openapi.json` 404).

이미 데이터가 있는 Volume DB 는 서버가 시작할 때 `users`·`chat_logs` 에 `public_id`(UUID) 컬럼을 자동으로 추가하고 기존 행을 채운다(#99·#106). 따로 실행할 마이그레이션 명령은 없다. 이전 형식(정수 `sub`) access 토큰은 401 이 되지만 프론트가 refresh 로 새 토큰을 받아 이어서 쓰므로 사용자가 다시 로그인할 필요는 없다.

### 6-2. 프론트 서비스

| 항목 | 값 |
|------|-----|
| Root Directory | `/frontend` |
| Build | Railpack 자동 감지 (Node 버전은 `.nvmrc`·`engines`, `npm run build` → `dist`). `build` 는 `tsc -b` 로 **타입 검사를 먼저** 수행하므로 타입 오류가 있으면 배포 빌드가 실패한다 |
| 도메인 | **Generate Domain** |
| 정적 서버 | `frontend/Caddyfile` — Railpack 기본 Caddy 설정에 **보안 응답 헤더**(CSP·HSTS·X-Frame-Options·nosniff·Referrer-Policy)를 더한 것. 빌드 로그에 `Using custom Caddyfile` 이 보이면 적용된 것 ([13-security-review.md](13-security-review.md) S07) |
| Variables | `VITE_API_BASE_URL=https://<backend>.up.railway.app`, `VITE_ADMIN_PATH=<무작위 주소>`, `VITE_SITE_URL=https://<frontend>.up.railway.app` (Generate Domain 으로 받은 주소) |

체크 포인트
- `VITE_API_BASE_URL` 은 **빌드(axios 주소)와 실행 중(Caddy 가 CSP `connect-src` 에 넣음) 모두** 쓴다. 틀리면 API 요청이 브라우저 CSP 에 막힌다(콘솔 `Refused to connect`). 백엔드 주소를 바꾸면 이 값을 바꾸고 다시 배포한다
- 보안 헤더: `curl -sI https://<frontend>.up.railway.app/` 에 `content-security-policy`·`strict-transport-security`·`x-frame-options`·`x-content-type-options`·`referrer-policy` 가 있는지
- 검색용 파일: `https://<frontend>.up.railway.app/robots.txt`·`/sitemap.xml` 이 열리는지, 두 파일에 관리자 주소가 없는지 확인
- SPA 라우팅: `/chat`, 관리자 주소에서 **새로고침했을 때 404 가 나지 않는지** 확인. 404 가 나면 정적 서빙에 `index.html` fallback 설정을 추가한다 (첫 배포 빌드 로그로 서빙 방식 확인).

### 6-3. 배포 순서

1. 백엔드 서비스 배포 → Volume 연결 → Generate Domain → 백엔드 URL 확보
2. 프론트 서비스 Variables 에 `VITE_API_BASE_URL` = 백엔드 URL → 배포 → Generate Domain → 프론트 URL 확보
3. 백엔드 Variables `CORS_ORIGINS` 에 프론트 URL 추가 → **백엔드 재배포**
4. 브라우저로 프론트 URL 접속 → 개발자도구 Console 에 CORS 오류가 없는지 확인 ([7. 외부 접속 · CORS 검증 (평가 전 필수)](#7-외부-접속--cors-검증-평가-전-필수))
5. README 의 서비스 URL 칸에 프론트 URL 기입

### 6-4. 슬리핑(Serverless)

- Railway 의 Serverless(슬리핑)를 켜면 트래픽이 없을 때 서비스가 잠들고, **첫 요청이 늦거나 실패(502)** 할 수 있다.
- 개발 중에는 비용 절감용으로 켜도 되지만, **평가 전에는 끈다.**
- 잠든 동안에는 만료 refresh token 정리 스케줄러(하루 1회)도 멈춘다. 깨어나면 시작 시 정리가 실행된다.

## 7. 외부 접속 · CORS 검증 (평가 전 필수)

```bash
# 서버 밖(다른 네트워크, 휴대폰 핫스팟 등)에서
curl -s https://<backend>.up.railway.app/docs -o /dev/null -w '%{http_code}\n'      # 200

# CORS preflight — 허용 Origin
curl -si -X OPTIONS https://<backend>.up.railway.app/api/auth/login \
  -H 'Origin: https://<frontend>.up.railway.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,authorization' | grep -i '^access-control-allow'
# access-control-allow-origin: https://<frontend>.up.railway.app 가 보여야 함

# CORS preflight — 허용되지 않은 Origin
curl -si -X OPTIONS https://<backend>.up.railway.app/api/auth/login \
  -H 'Origin: https://evil.example.com' \
  -H 'Access-Control-Request-Method: POST' | grep -i '^access-control-allow-origin'
# 출력 없어야 함
```

브라우저로 `https://<frontend>.up.railway.app` 접속 → 가입 → 로그인 → 질문 → 응답 → 로그 조회 → (관리자) 관리자 화면까지 전 흐름 재현, Console 에 CORS 오류 없음.

## 8. 트러블슈팅

| 증상 | 원인 / 해결 |
|------|-------------|
| 배포 직후 서버가 시작하지 않음, 로그에 `JWT_SECRET_KEY 가 32바이트보다 짧습니다` | 서명 키가 짧다. 위 생성 명령으로 새 키를 만들어 Variables 에 넣고 재배포 (기존 로그인은 모두 풀림) |
| 백엔드 배포 후 `ModuleNotFoundError` | `requirements.txt` 에 패키지 누락 (예: `python-dotenv`) → 추가 후 재배포 |
| 브라우저 콘솔에 CORS 오류 | 백엔드에 `CORSMiddleware` 없음 / `CORS_ORIGINS` 에 실제 프론트 도메인 누락·끝 `/` 포함 → 수정 후 백엔드 재배포 |
| 프론트가 `localhost:8000` 을 호출함 | `VITE_API_BASE_URL` 미설정 상태로 빌드됨 → 프론트 Variables 설정 후 **재빌드** |
| 첫 요청이 느리거나 502 | Serverless 슬리핑에서 깨어나는 중. 평가 전 슬리핑 끄기 |
| 재배포 후 계정이 사라짐 | SQLite 가 Volume 밖에 있음 → Volume `/data` 연결 + `DATABASE_URL=sqlite:////data/app.db` |
| 재배포 후 `logs/app.log` 가 비어 있음 | 로그 파일이 Volume 밖(컨테이너 안)에 있음 → `LOG_FILE=/data/logs/app.log`. 이전 기록은 Logs 탭(콘솔)과 `server_logs` 테이블에서 확인 |
| 백엔드 빌드가 `railpack prepare exited with an error` 로 실패 | Start Command 미설정 — Railpack 이 실행할 파일(`backend/main.py`·`backend/app.py`)을 찾지 못함. Settings → Deploy → Custom Start Command 에 `uvicorn app.main:app --host 0.0.0.0 --port $PORT` 입력 후 **변경 적용(Deploy)** 으로 새로 배포 (실패한 배포의 `Redeploy` 는 당시 설정 그대로라 다시 실패) |
| 서비스가 뜨지만 접속 안 됨 | Start Command 에 `--host 0.0.0.0 --port $PORT` 누락 |
| 로그인은 되는데 이후 요청이 `code: 401` | axios 인터셉터가 `Authorization` 헤더를 붙이지 않음 / 토큰 저장 키 불일치 |
| 하루 넘게 쓰지 않은 뒤 로그인 화면으로 이동 | 정상 (refresh token 1일 만료) |
| 15분마다 로그인 화면으로 튕김 | refresh 재발급 실패 — 인터셉터가 refresh 를 호출하는지, `refresh_tokens` 에 행이 있는지, 서버 재배포로 DB 가 초기화됐는지(Volume) 확인 |
| 로그아웃 후에도 잠시 API 호출이 됨 | 정상. access token 은 `exp` 까지 유효하고, refresh 재발급만 차단된다 |
| 관리자 화면이 `code: 403` | `ADMIN_EMAIL` 이 로그인 계정과 다름 / 시드 후 재시작 안 함 / `ADMIN_EMAIL` 을 바꾼 뒤라면 이전 관리자 계정은 일반 사용자로 내려간 것이 정상 |
| 모든 질문이 `code: 502` | `COPA_API_KEY` 미설정·오류. 로그 `ai_call_failed reason=` 확인 (`auth_failed` / `rate_limited` / `status_5xx`) |
| 가끔 `code: 502` (429) | AI API 호출 제한(rate limit) 초과. 잠시 후 재시도 |
| 응답이 계속 `code: 504` | `AI_TIMEOUT_SECONDS` 가 너무 짧거나 네트워크 지연. 값 조정 후 재배포 |
| `/chat` 새로고침 시 404 | 프론트 정적 서빙 SPA fallback 누락 ([6-2. 프론트 서비스](#6-2-프론트-서비스)) |

## 9. 민감정보 관리 체크

- `.gitignore` 에 `.env`, `.env.*`(단 `*.example` 은 예외), `*.db`, `__pycache__`, `node_modules`, `.venv`, `dist`
- 저장소에는 `frontend/.env.development.example`, `frontend/.env.production.example` 만 (키 이름 수준, 값은 예시). 백엔드는 예시 파일 없이 [3. 환경변수](#3-환경변수)의 키 목록이 기준
- API 키·JWT 비밀키·관리자 비밀번호는 Railway Variables 에만 입력

```bash
git ls-files | grep -E '(^|/)\.env$'                 # 출력 없어야 함
git grep -n "COPA_API_KEY=."                         # 출력 없어야 함 (추적 파일에 키 값 없음)
```
