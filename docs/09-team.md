# 09. 팀 규칙 · 역할 분담

> 기준 문서: [features.md](features.md) · 팀원 이름·역할·규칙 불일치: [11-open-issues.md C. 팀 · 협업 규칙 불일치](11-open-issues.md#c-팀--협업-규칙-불일치)
> 팀: **성원모(팀장) · 이성준** (2인, 120시간 Term Project)
> 2026-09-23 박성현 팀 이탈 → 박성현 담당이던 AI 파이프라인·관리자 API 를 성원모가 맡아 **백엔드 전체를 성원모가 담당**한다 ([11-open-issues.md](11-open-issues.md) C10)

## 1. mission 이 강제하는 필수 규칙 (위반 시 감점)

| # | 규칙 | 근거 | 확인 방법 |
|---|------|------|-----------|
| R1 | **브랜치 전략 적용**: `main` / `develop` 분리 | 4-7절 | `git branch -a` |
| R2 | **기능 단위 작업 브랜치**에서 작업 (`feature/*`) | 4-7절 | `git log --graph --all` |
| R3 | **PR 기반 Merge** — 코드 병합은 GitHub PR 로만. **예외: `docs/` 문서만 바꾸는 커밋은 develop 에 직접 push** (팀 합의, [2-1. 브랜치](#2-1-브랜치)) | 4-7절, 6절 | `git log --merges`, GitHub PR 목록 |
| R4 | **팀원별 유의미한 커밋 10회 이상** | 4-7절, 6절 | `git shortlog -sn` |
| R5 | 문서에 **팀 역할 / 개인별 작업 요약** 포함, **Git 이력과 모순 없게** | 2-2절, 4-7절 | README 6절 ↔ shortlog |
| R6 | API 키·비밀번호 등 **민감정보를 코드/문서에 직접 작성 금지** | 6절 | `grep`, PR 리뷰 |
| R7 | 모든 민감정보는 **환경변수(.env)** 로 관리, `.env` 는 **.gitignore** | 6절 | `git ls-files` |
| R8 | README 에 **환경변수 키 목록(이름)과 설정 방법** | 6절 | README 5절 |
| R9 | AI 호출 **타임아웃** 설정 + 실패 시 **오류 안내** 반환 | 6절 | `AI_TIMEOUT_SECONDS`, `code` 504/502 응답 |
| R10 | 요청 수신 · AI 호출/응답 · DB 저장 성공/실패 **로그** 유지 | 6절 | `app.log` 이벤트 확인 |
| R11 | 평가 시점 **외부 네트워크 접속 가능** 상태 유지 | 4-6절 | 외부망에서 배포 URL 접속 |

## 2. 팀 운영 규칙

### 2-1. 브랜치

```
main       ← 배포 브랜치. 직접 push 금지. develop → main PR 로만 병합 (긴급 수정은 hotfix/ 가 main 에서 분기)
 └ develop ← 통합 브랜치. 코드는 직접 push 금지(작업 브랜치 → develop PR). docs/ 문서 수정만 직접 push 허용
    ├ feature/be-auth-jwt
    ├ feature/be-ai-chat
    ├ feature/fe-chat-ui
    └ refactor/fe-typescript
```

| 접두어 | 용도 | 분기 기준 → 병합 대상 | 예 |
|--------|------|----------------------|----|
| `feature/` | 기능 추가 | develop → develop | `feature/ai-context` |
| `fix/` | 버그 수정 | develop → develop | `fix/token-refresh-redirect` |
| `refactor/` | 동작 변경 없는 구조 개선 · UI/CSS 변경 · 파일 이름 변경/삭제 | develop → develop | `refactor/fe-typescript` |
| `test/` | 테스트 추가·수정 | develop → develop | `test/auth-flow` |
| `docs/` | 문서만 (브랜치를 쓸 경우) | develop → develop | `docs/api-spec` |
| `chore/` | 설정·빌드·배포 | develop → develop | `chore/railway-deploy` |
| `hotfix/` | 배포 환경 긴급 수정 | **main → main** (머지 후 develop 에도 반영) | `hotfix/cors-origin` |

브랜치 이름은 `<접두어>/<작업-요약>` 형식이며, 요약은 영문 소문자 + 하이픈(kebab-case)으로 쓴다.
접두어는 커밋 타입과 맞춘다 (`feature/` ↔ `feat`, `refactor/` ↔ `refactor`).

**GitHub 보호 규칙 (팀 합의)**

| 브랜치 | 설정 |
|--------|------|
| `main` | Require a pull request before merging + **Require approvals: 1**. 직접 push 금지 (예외 없음) |
| `develop` | Require a pull request before merging + **Require approvals: 1**. 단 **`docs/` 문서만 수정하는 커밋은 직접 push 허용** → 보호 규칙에 팀원 bypass 를 지정한다 |

Settings → Branches (또는 Rulesets) 에서 위와 같이 설정하고, develop 규칙에는 bypass 대상으로 팀원을 추가한다.

**docs 직접 push 규칙 (팀 합의)**

| 항목 | 규칙 |
|------|------|
| 대상 | `docs/` 아래 문서만 바뀌는 커밋. 코드·설정 파일이 하나라도 섞이면 브랜치 + PR |
| 브랜치 | `develop` 에서 작업 → `git pull origin develop` 후 수정 → `origin develop` 에 push |
| 커밋 메시지 | `docs: 요약` (커밋 컨벤션 동일) |
| `main` | 예외 없음. develop → main PR 로만 병합 |
| 보호 규칙 | `develop` 보호 규칙에 팀원 bypass 허용이 필요 (bypass 없으면 직접 push 가 거부됨) |

### 2-2. 커밋 — "유의미한 커밋" 기준

mission 이 "유의미한" 커밋을 요구하므로 아래는 **커밋으로 세지 않는다**고 팀 내 합의한다.
- 오타 1글자, 공백/포맷만, 빈 커밋, 같은 내용 되돌리기 반복, 파일 1개를 쪼개 올리기

**좋은 커밋 = 하나의 논리적 변경 + 동작하는 상태 + 설명 가능한 메시지**

**메시지 형식 (확정 — [11-open-issues.md](11-open-issues.md) C4)**

```
<type>(<scope>): <내용> #<이슈번호>

<본문(선택): 무엇을 왜 바꿨는지. 설명할 내용이 있으면 반드시 적는다>
```

| 요소 | 규칙 |
|------|------|
| `type` | `feat` `fix` `hotfix` `refactor` `docs` `test` `style` `chore` |
| `scope` | **`be`(백엔드) · `fe`(프론트) 두 가지만 사용**. 문서 등 어느 쪽도 아닌 작업은 scope 없이 `docs: 내용` 처럼 쓴다 |
| 내용 | 한국어, 50자 이내, 마침표 없음 |
| `#이슈번호` | 연결된 이슈가 있으면 **끝에 `#5` 형식**(앞자리 0 없음). 이슈 없는 문서·설정 작업은 생략 |
| 본문 | 제목만으로 이유가 드러나지 않으면 빈 줄 뒤에 작성. 무엇을·왜 중심으로 |

예시:
```
feat(be): 로그인 시 JWT 발급과 만료 시간 적용 #12
feat(be): 최근 N턴 컨텍스트를 AI 요청에 포함 #9
fix(fe): 401 수신 시 토큰 삭제 후 로그인 화면으로 이동 #6
refactor(fe): TypeScript 전환과 strict 설정 #5
docs: v1.7 update
```

본문(디스크립션)이 있는 경우:
```
fix(fe): 한글 입력 중 Enter 중복 전송 수정 #14

IME 조합 중에는 keydown 이 두 번 발생해 마지막 글자가 중복 전송되던 문제.
composition 상태를 확인해 조합 중 Enter 는 무시하도록 변경.
```

- 커밋 author 이메일은 **본인 GitHub 계정 이메일**로 설정 (`git config user.email`) → shortlog 집계 정확성
- 페어 작업 시 `Co-authored-by:` 트레일러 사용

### 2-3. PR

- 제목: 커밋 규칙과 동일 형식 (`<type>(<scope>): <내용> #<이슈번호>`)
- 본문: `.github/pull_request_template.md` 가 PR 생성 시 자동으로 채워진다 (작업 내용 · 관련 Issue · 관련 요구사항 · 변경 유형 · 주요 변경 사항 · 스크린샷 · 테스트 · 확인 방법 · API 변경 사항 · 체크리스트 · Reviewer 참고 사항)
- 이슈 생성 시에는 `.github/ISSUE_TEMPLATE/issue_template.md` 를 사용하고, 제목은 `[FEAT]` · `[FIX]` · `[REFACTOR]` 로 시작한다
- 작성 규칙 상세: [10-pull-request.md](10-pull-request.md)
- **리뷰어 1명 승인** 후 작성자가 머지. 머지 방식은 **Merge commit** (Squash 금지 → 개인 커밋 수와 머지 기록이 모두 남도록)
- PR 크기: 변경 400줄 이하 권장, 1 PR = 1 기능

### 2-4. 기타

- 매일 짧은 스탠드업(어제/오늘/막힘), 이슈는 GitHub Issues 로 관리
- `.env` 값 공유는 저장소/채팅 평문 금지 → 직접 전달
- 충돌 방지: 작업 시작 전 `git pull origin develop`, 공용 파일(`main.py`, `config.py`) 수정 시 채널에 공지
- **인터페이스 우선 합의**: 백엔드와 프론트가 병렬로 진행하므로 [03-api.md](03-api.md) 를 먼저 확정하고, API 가 바뀌면 03-api.md 를 함께 수정한다

## 3. 역할 분담

백엔드(성원모)·프론트엔드(이성준) 2트랙으로 나눈다. (아래 담당 번호는 [features.md](features.md) 번호 체계와 다르다 — [11-open-issues.md](11-open-issues.md) C6)

| 팀원 | 역할 | 담당 범위 (features.md #) | 주요 산출물 |
|------|------|---------------------------|-------------|
| **성원모** (팀장) | 백엔드 전체 — 인증 · DB · 인프라 · AI 파이프라인 · 관리자 API | B1~B16, C1~C5, A1~A12, 관리자 API(features.md B15~B19) | `core/security.py`, `core/dependencies.py`, `routers/auth.py`, `routers/me.py`, `models/`, `crud/`, `database.py`, `config.py`, `main.py`(CORS), `.gitignore`, `scripts/check_logs.sql`, `routers/chat.py`, `services/ai_service.py`, `schemas/chat.py`, `core/logging.py`, 에러 코드·안내 문구, `services/chat_service.py`, `routers/admin.py`, 관리자 조회 CRUD, `core/rate_limit.py`, `core/body_limit.py`, Railway 배포, README |
| **이성준** | 프론트엔드 (React + TypeScript) | **F1~F14 전체** ([features.md](features.md) 기준, **관리자 화면 F10~F14 포함**) | `tsconfig.app.json`(strict)·`vite.config.ts`(alias·test), `src/api/`(인스턴스·인터셉터·엔드포인트·응답 타입), `src/utils/tokenStorage.ts`, `src/hooks/`, `src/store/`(AuthProvider·AuthStatus), `src/routes/`(경로 상수·가드), `src/pages/{Login,Signup,Chat,Logs,Admin}`, `src/components/`, `src/styles/`(reset·global), `src/test/`(vitest·MSW), CSS Modules·디자인 토큰 |

**의존 관계 / 순서**

1. 백엔드는 **인증·DB(B1~B4, B12) → AI 챗 파이프라인 → 관리자 API** 순서로 진행한다. 챗·관리자 API 가 인증 dependency 와 `chat_logs`·`server_logs` 기록에 기대기 때문이다.
2. 백엔드 담당이 한 명이 되었으므로 트랙 간 mock 사용자 단계는 두지 않고, 인증 dependency 를 그대로 붙여 `POST /api/chat` 을 만든다.
> 관리자 기능 담당 ([11-open-issues.md](11-open-issues.md) G7): **프론트 F10~F14 는 이성준**, **백엔드 B15~B19(관리자 API 5종 + 관리자 조회 CRUD)는 성원모** (2026-09-23 박성현 이탈로 이관). 권한 검사 `require_admin` 과 관리자 계정 시드는 이미 인증 작업에서 구현되어 있다.

3. 이성준은 백엔드보다 먼저 시작할 수 있다 — [03-api.md](03-api.md) 기준으로 **목 응답(msw 또는 로컬 stub)** 으로 화면을 만들고 나중에 실 API 로 교체한다.

공통: 코드 리뷰는 **상호 리뷰**(성원모 PR → 이성준 리뷰, 이성준 PR → 성원모 리뷰), 최종 통합 확인·평가 리허설은 2명 함께.

## 4. 브랜치·커밋 계획 (팀원별 10회 이상 보장)

### 성원모 — 백엔드 전체: 인증 / DB / 인프라 / AI 파이프라인 / 관리자 API (계획 33 커밋)

| 브랜치 | 커밋 |
|--------|------|
| `chore/init` | 1 `chore: 저장소 구조·.gitignore·.env.example` · 2 `chore(be): FastAPI 앱 골격과 라우터 등록` · 3 `chore(be): CORS 설정과 환경변수 로딩` |
| `feature/be-db` | 4 `feat(be): SQLAlchemy 엔진·세션과 get_db 의존성` · 5 `feat(be): users·chat_logs 모델` · 6 `feat(be): user·chat_log 리포지토리 계층 분리` |
| `feature/be-auth-jwt` | 7 `feat(be): bcrypt 해시·검증 유틸` · 8 `feat(be): 회원가입 API 와 이메일 중복 409` · 9 `feat(be): 로그인 JWT 발급` · 10 `feat(be): get_current_user 인증 dependency` · 11 `feat(be): /api/auth/me 로 상태 복원 지원` |
| `feature/be-logs` | 12 `feat(be): /api/me/chats 사용자 스코프 조회와 페이지네이션` · 13 `feat(be): DB 저장 성공/실패 로깅` |
| `feature/ai-client` | 14 `feat(be): httpx Codyssey AI API 클라이언트 모듈 분리` · 15 `feat(be): API 키 환경변수 로드` · 16 `feat(be): 호출 타임아웃 설정` |
| `feature/ai-chat` | 17 `feat(be): /api/chat 엔드포인트와 인증 적용` · 18 `feat(be): 요청·응답 Pydantic 스키마` · 19 `feat(be): 서버 측 입력 검증 422` · 20 `feat(be): 최근 N턴 컨텍스트 구성` · 21 `feat(be): 컨텍스트 길이 초과 시 오래된 턴 제거` |
| `feature/ai-errors` | 22 `feat(be): 타임아웃 시 AI_TIMEOUT 504 반환` · 23 `feat(be): 호출 실패 시 AI_CALL_FAILED 502 반환` |
| `feature/ai-logging` | 24 `feat(be): request_id 와 AI 호출 이벤트 로그 4종` |
| `feature/be-admin` | 25 `feat(be): 관리자 조회 CRUD 계층` · 26 `feat(be): 관리자 요약 통계 API` · 27 `feat(be): 관리자 사용자 목록·검색과 사용자별 대화 API` · 28 `feat(be): 관리자 AI 실패 기록 API` · 29 `feat(be): request_id 요청 흐름 로그 API` · 30 `test(be): 관리자 API 권한·응답 테스트` |
| `chore/deploy` | 31 `chore(be): Railway 서비스 2개 배포 설정과 CORS 도메인` |
| `docs/*` | 32 `docs: 챗 엔드포인트 명세·에러 코드 정리` · 33 `docs: README 총괄 작성` |

### 이성준 — 프론트엔드 (계획 19 커밋)

| 브랜치 | 커밋 |
|--------|------|
| `refactor/fe-typescript` | 0-1 `refactor(fe): TypeScript 전환과 strict 설정 #5` · 0-2 `refactor(fe): 타입 검사 스크립트와 환경변수 타입 선언 #5` |
| `feature/fe-routing` | 1 `chore(fe): Vite 템플릿 데모 화면과 에셋 제거 #7` · 2 `feat(fe): React Router 라우팅 골격과 페이지 구조 추가 #7` |
| `refactor/fe-css-reset` | 3 `refactor(fe): 전역 CSS 를 reset.css 와 global.css 로 분리 #13` |
| `chore/fe-path-alias` | 4 `chore(fe): import 경로 alias(@/) 설정 #20` |
| `feature/fe-api-layer` | 5 `chore(fe): vitest·msw·happy-dom 테스트 환경 구성` · 6 `feat(fe): 응답 형식·엔드포인트 타입과 ApiError 정의` · 7 `feat(fe): 토큰 저장소와 변경 구독` · 8 `test(fe): 토큰 저장소 테스트` · 9 `feat(fe): axios 인스턴스와 응답 정규화 인터셉터` · 10 `test(fe): 응답 정규화·네트워크 오류·요청 취소 테스트` · 11 `feat(fe): 토큰 재발급 인터셉터와 single-flight` · 12 `test(fe): 재발급 single-flight 와 원요청 재시도 테스트` · 13 `feat(fe): 엔드포인트 함수(auth·chat·logs)` · 14 `test(fe): 엔드포인트 함수 테스트` |
| `feature/fe-auth-context` | 15 `feat(fe): AuthContext 와 인증 상태(AuthStatus) 관리` · 16 `feat(fe): 라우팅 가드(RequireAuth·RequireAdmin)` · 17 `test(fe): 인증 상태·가드 테스트` |
| `feature/fe-auth` | 18 `feat(fe): 회원가입 화면과 에러 코드 분기` · 19 `feat(fe): 로그인 화면` |
| `feature/fe-chat` | 10 `feat(fe): 질문 입력과 대화 말풍선 UI` · 11 `feat(fe): 로딩 상태와 클라이언트 입력 검증` · 12 `feat(fe): 에러 코드별 안내 말풍선` |
| `feature/fe-logs` | 13 `feat(fe): 내 대화 로그 화면과 더 보기` |
| `fix/*` | 14 `fix(fe): 한글 IME 조합 중 Enter 전송 방지` |
| `feature/fe-admin` | 15 `feat(fe): 관리자 가드와 전용 메뉴 노출` · 16 `feat(fe): 관리자 요약 통계 카드` · 17 `feat(fe): 사용자 목록·검색과 사용자별 대화 조회` · 18 `feat(fe): AI 실패 기록과 요청 흐름 타임라인` |
| `refactor/fe-responsive` | 19 `refactor(fe): 반응형·접근성 마감` |

## 5. 일정 (120시간 기준)

| 주차 | 목표 | 완료 기준 |
|------|------|-----------|
| 1 | 저장소·브랜치·골격, `03-api.md` 확정, DB 모델, 인증 API | develop 에서 가입→로그인→`/auth/me` curl 성공 |
| 2 | 챗 파이프라인(컨텍스트·검증·타임아웃·로그), 프론트 4화면 | 로컬에서 가입→로그인→질문→응답→로그 전 흐름 동작 |
| 3 | Railway 배포(서비스 2개·Volume), CORS 정리, 관리자 화면, 실제 Codyssey AI API 연동 | 외부망에서 배포 URL 로 전 흐름 재현 |
| 4 | 문서 마감, 역할 요약·커밋 수 반영, 평가 리허설 | docs/08 체크리스트 전부 체크 |

## 6. 개인별 작업 요약

2026-10-14 main 기준. 커밋 수는 머지 커밋 제외(`git shortlog -sn --no-merges`), PR 은 본인이 올려 머지된 것. 마감 직전에 숫자만 다시 확인한다.

| 팀원 | 역할 | 주요 작업 | 커밋 수 | PR |
|------|------|-----------|:------:|----|
| 성원모 (팀장) | 백엔드 전체 (인증·DB·인프라·AI 파이프라인·관리자 API) | 백엔드 기본 구성 · DB 모델/CRUD · JWT 인증(재발급 회전·관리자 시드) · 내 대화 로그 API · 챗 API(Codyssey AI 호출·컨텍스트·실패 처리) · 서버 로그 · 관리자 API 5종과 감사 로그 · 동시 챗 요청 시 서버 멈춤 수정 · 관리자 시드 보강(이전 관리자 강등 · 비밀번호 동기화) · 요청 횟수 제한(429) · 운영에서 API 문서 화면 끄기 · 요청 본문 64KB 상한 · 서명 키 길이 검사 · 챗 DB 작업 별도 스레드(이벤트 루프 멈춤 수정) · 일반 사용자에게 내부 번호 비노출(UUID public_id) · Railway 배포 설정 · 설계 문서 | 69 | 17건 — #15 · #17 · #25 · #33 · #59 · #62 · #65 · #67 · #74 · #85 · #87 · #91 · #93 · #95 · #98 · #101 · #107 |
| 이성준 | 프론트엔드 전체 (F1~F14) | React·TypeScript(strict)·Vite 구성 · 가입/로그인/챗/내 대화 로그/관리자 화면 · 인증 상태·자동 재발급·탭 간 로그아웃 · 공통 응답 봉투·오류 안내(429 포함) · 디자인 시스템·반응형·접근성·SEO · 첫 화면 성능(Lighthouse 모바일 99) · 정적 서버 보안 헤더(CSP 등) · 배포 통합 테스트·보안 점검·침투 테스트 · 링크 미리보기(오픈그래프) · 내부 번호 UUID 전환에 맞춘 화면·타입 정리 · 루트 README·문서 정리 | 111 | 32건 — #4 · #6 · #12 · #14 · #21 · #24 · #27 · #29 · #31 · #35 · #36 · #37 · #39 · #41 · #43 · #45 · #47 · #49 · #51 · #53 · #55 · #60 · #69 · #71 · #75 · #78 · #79 · #81 · #83 · #89 · #104 · #109 |

> develop → main 반영 PR(#96 · #102 · #105 · #110)은 개인 작업이 아니라 위 PR 수에 넣지 않았다.

> 박성현은 2026-09-23 팀에서 이탈했다. 담당이던 AI 파이프라인·관리자 API 는 성원모가 인수했고, 루트 README 팀 표에 "중도 이탈"로 적었다.

```bash
git shortlog -sn --no-merges          # 커밋 수 (머지 커밋 제외)
git log --merges --oneline            # PR 머지 기록
gh pr list --state merged --json number,title,author --limit 100
```
