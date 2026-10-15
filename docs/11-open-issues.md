# 11. 미확정 · 문서 불일치 목록 (팀 논의용)

> 최초 작성 2026-09-14, 갱신 2026-09-15, 2026-10-01(백엔드 구현 반영 — D7·E9·E10·E11·E12·E17·E18 해결), 2026-10-14(요청 횟수 제한·내부 번호 비노출 결정 추가, E8 재확인). mission.md 와 docs/01~10, features.md, handoff.md, 현재 코드(develop)를 대조한 결과다.
> 논의로 결정되면 해당 행의 **결정** 칸을 채우고, 관련 문서를 수정한 뒤 [0. 확정되어 문서에 반영한 것](#0-확정되어-문서에-반영한-것)로 옮긴다.
> 결정 이유는 [12-decisions.md](12-decisions.md). mission.md 요구사항 자체를 누락·위반한 항목은 발견되지 않았다.

## 0. 확정되어 문서에 반영한 것

| 항목 | 결정 | 반영 위치 |
|------|------|-----------|
| 인증 | **JWT Bearer** (서버 측 세션 폐기) | [02-architecture.md 4. 인증 방식 결정: JWT vs 서버 측 세션](02-architecture.md#4-인증-방식-결정-jwt-vs-서버-측-세션), [features.md 0. 구조 결정 근거](features.md#0-구조-결정-근거) |
| AI API | **Codyssey AI API (COPA)**, 키 이름 `COPA_API_KEY` | 01, [02-architecture.md 1. 기술 스택](02-architecture.md#1-기술-스택)·[6. Codyssey AI API 연동 메모](02-architecture.md#6-codyssey-ai-api-연동-메모), 03, 06, 07, 08, 09 |
| Node 버전 | **24 LTS**, `frontend/.nvmrc` 로 고정 | [06-deployment.md 1. 요구 환경](06-deployment.md#1-요구-환경) |
| 프론트 스타일 | **CSS Modules** (Tailwind 폐기) | [02-architecture.md 1. 기술 스택](02-architecture.md#1-기술-스택), [05-ui-ux.md 1. 디자인 시스템](05-ui-ux.md#1-디자인-시스템), [06-deployment.md 2. 설치](06-deployment.md#2-설치), [09-team.md 3. 역할 분담](09-team.md#3-역할-분담)·[4. 브랜치·커밋 계획 (팀원별 10회 이상 보장)](09-team.md#4-브랜치커밋-계획-팀원별-10회-이상-보장) |
| 문서 수정 방식 | `docs/` 문서만 바꾸는 커밋은 develop 에 직접 push. 코드가 섞이면 PR | [09-team.md 1. mission 이 강제하는 필수 규칙 (위반 시 감점)](09-team.md#1-mission-이-강제하는-필수-규칙-위반-시-감점) R3·[2-1. 브랜치](09-team.md#2-1-브랜치), 10 머리말·[1-2. 대상(base) 브랜치](10-pull-request.md#1-2-대상base-브랜치) |
| 없는 문서 참조 · 깨진 앵커 | 실제 문서로 교체 | 01~06, 08~10 |
| **A1 계정 필드** | **안 1: email + nickname** (username 폐기) | 01, [03-api.md 1. 인증](03-api.md#1-인증), 04 users, 05 화면 1·2 |
| **A2 비밀번호 규칙** | **8자 이상** | [03-api.md 1-1. 회원가입](03-api.md#1-1-회원가입), 05 화면 1, 07 V03 |
| **A3 응답 형식** | **`{code: number, data: object}`**. 실패 `data` = `{message}`. **서버 응답은 성공·실패 모두 HTTP 200**, 판단은 body `code`. 문자열 에러 코드 없음. FastAPI 기본 에러도 봉투 변환. 봉투 없는 응답 = 서버 연결 실패 | [03-api.md 0. 공통 규약](03-api.md#0-공통-규약), [02-architecture.md 5. 내부 처리 절차](02-architecture.md#5-내부-처리-절차), [05-ui-ux.md 4. API 호출 공통 모듈](05-ui-ux.md#4-api-호출-공통-모듈)·[5. 결과 코드별 사용자 메시지](05-ui-ux.md#5-결과-코드별-사용자-메시지), [06-deployment.md 4. 로컬 실행 확인](06-deployment.md#4-로컬-실행-확인), 07, [features.md 4. API 요약](features.md#4-api-요약) |
| **A4 입력 검증 실패** | **`code: 422`** | 03, 05, 07, features.md |
| **A5 AI 실패** | **`code: 504` (AI_TIMEOUT) / `code: 502` (AI_CALL_FAILED)** | [02-architecture.md 5-4. 챗 파이프라인 `POST /api/chat` (핵심)](02-architecture.md#5-4-챗-파이프라인-post-apichat-핵심), [03-api.md 2. 챗봇](03-api.md#2-챗봇), [05-ui-ux.md 5. 결과 코드별 사용자 메시지](05-ui-ux.md#5-결과-코드별-사용자-메시지), 07 |
| **A6 이메일 중복** | **`code: 409`**, 닉네임 중복 허용(검사 안 함) | [03-api.md 1-1. 회원가입](03-api.md#1-1-회원가입), 04 users, 05 화면 1, 07 V02b |
| **A7 로그아웃 · 토큰** | **access token + refresh token**, `POST /api/auth/refresh` · `POST /api/auth/logout`(refresh 행 삭제) | 01 S6, [02-architecture.md 4. 인증 방식 결정: JWT vs 서버 측 세션](02-architecture.md#4-인증-방식-결정-jwt-vs-서버-측-세션)·[5-2b. 재발급 `POST /api/auth/refresh` · 로그아웃 `POST /api/auth/logout`](02-architecture.md#5-2b-재발급-post-apiauthrefresh--로그아웃-post-apiauthlogout), [03-api.md 0. 공통 규약](03-api.md#0-공통-규약)·[1-4. 토큰 재발급](03-api.md#1-4-토큰-재발급)·[1-5. 로그아웃](03-api.md#1-5-로그아웃), 04, 05, [06-deployment.md 3. 환경변수](06-deployment.md#3-환경변수), 07 V05b~f·B16·B17, 08, features.md B4·F3~F5 |
| A7-1 access token 수명 | **15분** (`JWT_EXPIRE_MINUTES=15`) | [03-api.md 0. 공통 규약](03-api.md#0-공통-규약)·[7. 합의된 값](03-api.md#7-합의된-값), [06-deployment.md 3. 환경변수](06-deployment.md#3-환경변수), 01 S6 |
| A7-2 refresh token 수명 | **1일** (`REFRESH_TOKEN_EXPIRE_DAYS=1`), 재발급 시 새 토큰이 다시 1일 | [03-api.md 0. 공통 규약](03-api.md#0-공통-규약)·[7. 합의된 값](03-api.md#7-합의된-값), 04, [06-deployment.md 3. 환경변수](06-deployment.md#3-환경변수) |
| A7-3 refresh token 형식 | **무작위 문자열(`secrets.token_urlsafe`) + SHA-256 해시 저장** | [03-api.md 0. 공통 규약](03-api.md#0-공통-규약), 04 |
| A7-4 재발급 시 회전 | **회전함** (기존 행 삭제 + 새 토큰) | [03-api.md 1-4. 토큰 재발급](03-api.md#1-4-토큰-재발급), 04 |
| A7-5 프론트 저장·전송 | **access·refresh 를 같은 곳(A15)에 저장, refresh 는 요청 body 로 전송** (쿠키 미사용) | [03-api.md 0. 공통 규약](03-api.md#0-공통-규약), 05 화면 2 |
| A7-6 만료 행 정리 | **하루 1회 스케줄러** (앱 lifespan 백그라운드 작업, 시작 시 1회 + 24시간마다 `DELETE ... WHERE expires_at < now`) | [02-architecture.md 3. 디렉터리 구조](02-architecture.md#3-디렉터리-구조), 04 refresh_tokens, [06-deployment.md 6-4. 슬리핑(Serverless)](06-deployment.md#6-4-슬리핑serverless), 07 V05f, features.md B4 |
| A7-7 여러 기기 로그인 | **허용** (기기별 행, 로그아웃은 해당 기기만) | 04 refresh_tokens |
| **A8 관리자 기능** | **필수**. 사용자 목록·검색 / 사용자별 대화 / AI 실패 기록 / 요약 통계 / 요청 흐름 로그 5종 | features.md B15~B19·F10~F14, 01 S7, [02-architecture.md 5-6. 관리자 조회 `GET /api/admin/*`](02-architecture.md#5-6-관리자-조회-get-apiadmin), [03-api.md 4. 관리자](03-api.md#4-관리자-필수--mission-2-2절-관리자내부-로그-확인-화면-4-4절-관리자-조회-api화면), 04, 05 화면 5, 07, 08 |
| A9 chat_logs 컬럼 | `status`·`error_code`·`latency_ms`·`request_id` 추가, **AI 실패도 저장** | 04, [03-api.md 2. 챗봇](03-api.md#2-챗봇) |
| A10 users 테이블 | email·hashed_password·nickname + **role** | 04 |
| **A11 컨텍스트 범위** | **같은 사용자 최근 5건 중 성공 Q/A 만** | [02-architecture.md 5-4. 챗 파이프라인 `POST /api/chat` (핵심)](02-architecture.md#5-4-챗-파이프라인-post-apichat-핵심), [03-api.md 2. 챗봇](03-api.md#2-챗봇), 04, 07 V12 |
| 요청 흐름 로그 저장 | **DB `server_logs` 테이블** (파일/콘솔 로그와 함께) | [03-api.md 6. 서버 로그 이벤트 규약](03-api.md#6-서버-로그-이벤트-규약), 04 |
| A12 부가 API | **항목 삭제** (`/api/health`·`/api/config`·`/api/me/server-logs`·`simulate` 는 스펙 범위 밖으로 유지) | [05-ui-ux.md 8. 참고: 시안에 있으나 스펙 범위 밖인 요소](05-ui-ux.md#8-참고-시안에-있으나-스펙-범위-밖인-요소) |
| A13 내 로그 응답 | `data: {total, items}` + `limit`·`offset` (문서 기준) | [03-api.md 3-1. 내 대화 로그 조회](03-api.md#3-1-내-대화-로그-조회) |
| A14 챗 응답 필드 | `data: {chat_id, question, answer, created_at}` (문서 기준) | [03-api.md 2-1. 질문 전송](03-api.md#2-1-질문-전송) |
| **A16 합의값** | access **15분** · 컨텍스트 **5개** · AI 대기 **30초(호출 전체 상한)** · 질문 **1000자** | [03-api.md 7. 합의된 값](03-api.md#7-합의된-값), [02-architecture.md 5-4. 챗 파이프라인 `POST /api/chat` (핵심)](02-architecture.md#5-4-챗-파이프라인-post-apichat-핵심), [06-deployment.md 3. 환경변수](06-deployment.md#3-환경변수) |
| A17 배포 | **Railway 서비스 2개 (프론트·백엔드 별도 도메인)**, 백엔드 Volume `/data` | 02, 03, 04, 05, 06, 07, 08, 09 |
| A18 CORS | **필수** (`CORS_ORIGINS` = 개발 서버 + Railway 프론트 도메인) | [06-deployment.md 5. CORS 설정](06-deployment.md#5-cors-설정)·[7. 외부 접속 · CORS 검증 (평가 전 필수)](06-deployment.md#7-외부-접속--cors-검증-평가-전-필수), 07 V22·D03·D04 |
| A19 느린 첫 응답 안내 | Railway 슬리핑 사용 시 대응, 평가 전 슬리핑 끄기 | 05 화면 3, [06-deployment.md 6-4. 슬리핑(Serverless)](06-deployment.md#6-4-슬리핑serverless), [08-checklist.md 4. 평가 당일 체크리스트](08-checklist.md#4-평가-당일-체크리스트) |
| **A20 HTTP 클라이언트** | **httpx `AsyncClient`** (`requests` 는 교체 완료·의존성 제거 — PR #62) | [02-architecture.md 1. 기술 스택](02-architecture.md#1-기술-스택)·[6. Codyssey AI API 연동 메모](02-architecture.md#6-codyssey-ai-api-연동-메모), features.md B8 |
| A22 백엔드 구조 | `backend/app/{routers,services,crud,models,schemas,core}` — **구현 완료**. 초기 골격 `backend/main.py` 는 PR #62 에서 삭제 | [02-architecture.md 3. 디렉터리 구조](02-architecture.md#3-디렉터리-구조) |
| A23 프론트 스타일 | CSS Modules | 위 참고 |
| A24 Railway 배포 브랜치 | 백엔드·프론트 모두 `main` (문서 기준) | [06-deployment.md 6-1. 백엔드 서비스](06-deployment.md#6-1-백엔드-서비스) |
| **AI 실패 재시도** | **서버 자동 재시도 없음.** 실패 즉시 안내 → 오류 말풍선 **[다시 시도] 버튼** → 같은 질문으로 `POST /api/chat` 새 요청 | 01 S3, [02-architecture.md 5-4. 챗 파이프라인 `POST /api/chat` (핵심)](02-architecture.md#5-4-챗-파이프라인-post-apichat-핵심), [03-api.md 2-1. 질문 전송](03-api.md#2-1-질문-전송), 05 화면 3·[5. 결과 코드별 사용자 메시지](05-ui-ux.md#5-결과-코드별-사용자-메시지), 07 B12·B12b, features.md B9·F7 |
| **A15 토큰 저장 위치** | **`localStorage`** (access·refresh 같은 곳, refresh 는 body 전송). XSS 위험은 저장 방식이 아니라 **XSS 예방 + 피해 시간 단축**으로 대응 ([12-decisions.md 4. 토큰을 프론트에 저장하는 위치 — 위험성과 대안](12-decisions.md#4-토큰을-프론트에-저장하는-위치--위험성과-대안)) | [03-api.md 0. 공통 규약](03-api.md#0-공통-규약)·[7. 합의된 값](03-api.md#7-합의된-값), 05 화면 2, [12-decisions.md 4. 토큰을 프론트에 저장하는 위치 — 위험성과 대안](12-decisions.md#4-토큰을-프론트에-저장하는-위치--위험성과-대안), [02-architecture.md 4. 인증 방식 결정: JWT vs 서버 측 세션](02-architecture.md#4-인증-방식-결정-jwt-vs-서버-측-세션) |
| **프론트 언어** | **TypeScript (`strict: true`)** — 기존 JS(JSX) 에서 전환. 봉투 응답·결과 코드·관리자 응답 타입 고정 | [02-architecture.md 1. 기술 스택](02-architecture.md#1-기술-스택), 05 머리말, [06-deployment.md 2. 설치](06-deployment.md#2-설치)·[6-2. 프론트 서비스](06-deployment.md#6-2-프론트-서비스), [09-team.md 3. 역할 분담](09-team.md#3-역할-분담), [features.md 0. 구조 결정 근거](features.md#0-구조-결정-근거)·F1, [12-decisions.md 14. 프론트엔드 TypeScript (strict)](12-decisions.md#14-프론트엔드-typescript-strict) |
| E3·E4·E5·E6 | 상태 표시·캡처 목록·슬립 모순 정리 | 07, 08 |
| 요청 횟수 제한 | 챗 사용자별 1분 10회, 로그인 실패 이메일별 10분 5회·IP 별 20회, 가입 IP 별 10분 20회 → `code: 429` (#86·PR #87) | [03-api.md](03-api.md), [06-deployment.md 3. 환경변수](06-deployment.md#3-환경변수), [12-decisions.md](12-decisions.md) 22 |
| 내부 번호 비노출 | 일반 사용자에게 나가는 번호(JWT `sub`·`chat_id`)는 UUID `public_id`, 회원가입·내 정보 응답에 `id` 없음. 관리자 API 는 정수 id 유지 (#99·PR #101, #106·PR #107) | [03-api.md](03-api.md), [04-database.md](04-database.md), [12-decisions.md](12-decisions.md) 23, [13-security-review.md](13-security-review.md) L07 |

---

## A. 스펙 미확정 항목

| # | 항목 | 현재 문서 | 선택지 | 결정 |
|---|------|-----------|--------|------|
| A7-8 | 로그아웃 요청에 필요한 토큰 | body 의 refresh token 만 ([03-api.md 1-5. 로그아웃](03-api.md#1-5-로그아웃)) | 아래 상세 | **① refresh token 만 — 확정**. 여러 기기 로그인 허용(A7-7)과 맞고, access 만료 후에도 로그아웃이 실패하지 않으며, refresh 를 가진 쪽이 할 수 있는 일은 그 토큰 폐기뿐이라 악용 여지가 작다 |

> A15(토큰 저장 위치)는 **localStorage 로 확정**되어 [0. 확정되어 문서에 반영한 것](#0-확정되어-문서에-반영한-것)로 옮겼다.

### A7-8 상세 — 로그아웃 요청에 어떤 토큰을 요구할까

로그아웃 API 가 **"어느 refresh token 행을 지울지"** 알아야 한다. 무엇을 받느냐에 따라 동작이 달라진다.

| 안 | 요청 | 서버 동작 | 장점 | 단점 |
|----|------|-----------|------|------|
| **① refresh 만 (초안)** | body `{refresh_token}` | 해시가 일치하는 행 1개 삭제 | access 가 이미 만료돼도 로그아웃 가능, **이 기기만** 정확히 로그아웃 | refresh token 을 가진 사람은 누구든 그 토큰을 폐기할 수 있음 (폐기는 피해가 아니라 보안상 문제 적음) |
| ② access 만 | 헤더 `Authorization` | access 에는 어느 기기인지 정보가 없음 → **그 사용자의 refresh 행 전부 삭제** (모든 기기 로그아웃) | 인증된 사용자만 호출 | access 만료(15분) 후엔 로그아웃 API 가 401 → refresh 로 재발급한 뒤 로그아웃해야 함, 다른 기기까지 로그아웃됨 (A7-7 기기별과 충돌) |
| ③ 둘 다 | 헤더 access + body refresh | access 로 사용자 확인, refresh 가 **그 사용자 소유인지** 확인 후 삭제 | 가장 엄격 | access 만료 시 먼저 재발급 필요 → 프론트 흐름 복잡 |

- **①** 은 A7-7(기기별 로그아웃)과 맞고, 만료 상황에서도 로그아웃이 실패하지 않는다.
- **②** 는 "모든 기기에서 로그아웃" 기능이 필요할 때 따로 추가하는 API 형태로 더 적합하다.

---

## C. 팀 · 협업 규칙 불일치

| # | 항목 | 위치 A | 위치 B | 결정 |
|---|------|--------|--------|------|
| C1 | 팀원 이름 | "어썸체크(팀장) · 이성준 · 박성현A" (09 0절·[3. 역할 분담](09-team.md#3-역할-분담)·[4. 브랜치·커밋 계획 (팀원별 10회 이상 보장)](09-team.md#4-브랜치커밋-계획-팀원별-10회-이상-보장)·[6. 개인별 작업 요약](09-team.md#6-개인별-작업-요약), 03 예시 닉네임) | 성원모 · 박성현 · 이성준 (`mission.md:7`, [10-pull-request.md 1-4. 리뷰와 머지](10-pull-request.md#1-4-리뷰와-머지), [08-checklist.md 2. 기능 번호 대조](08-checklist.md#2-기능-번호-대조)) | **실명으로 확정** — 성원모(팀장) · 박성현 · 이성준. 09 문서 전체 반영 완료. **2026-09-23 박성현 이탈로 현재 팀원은 성원모(팀장) · 이성준 2명 (C10)**. `03-api.md` 등의 "어썸체크"는 **API 예시 닉네임 값**이라 변경 대상 아님 |
| C2 | 역할 분담 | 성원모 = 인증·DB·인프라, 박성현 = AI, 이성준 = 프론트 전담 ([09-team.md 3. 역할 분담](09-team.md#3-역할-분담)) | ~~handoff.md 버전~~ (파일 삭제됨) | **재확정 (2026-09-23, C10)** — 성원모 = 백엔드 전체(인증·DB·인프라·AI 파이프라인·관리자 API B15~B19), 이성준 = 프론트엔드 전체(F1~F14, 관리자 화면 포함). 이전 결정(박성현 = AI 파이프라인·관리자 API)은 박성현 이탈로 폐기 |
| C4 | 커밋 메시지 형식 | `type(scope): 내용`, 타입 7개, 이슈 번호 없음 ([09-team.md 2-2. 커밋 — "유의미한 커밋" 기준](09-team.md#2-2-커밋--유의미한-커밋-기준)) | `type: 제목 #1`, 타입 8개(hotfix 포함) ([10-pull-request.md 1-1. 제목](10-pull-request.md#1-1-제목)) | **확정** — `type(scope): 내용 #이슈번호`, scope 는 **`be`·`fe` 두 가지만**(해당 없으면 생략), 타입 8종(hotfix 포함), 설명할 내용이 있으면 본문(디스크립션) 작성. [09-team.md 2-2. 커밋 — "유의미한 커밋" 기준](09-team.md#2-2-커밋--유의미한-커밋-기준) · [10-pull-request.md 1-1. 제목](10-pull-request.md#1-1-제목) 반영 완료 |
| C5 | 브랜치 접두어 | feature·fix·docs·chore 4종 ([09-team.md 2-1. 브랜치](09-team.md#2-1-브랜치)) | + refactor·test, hotfix 는 main 분기 ([10-pull-request.md 1-2. 대상(base) 브랜치](10-pull-request.md#1-2-대상base-브랜치)) | **7종 모두 사용 확정** — feature·fix·refactor·test·docs·chore(develop 분기) + hotfix(main 분기). [09-team.md 2-1. 브랜치](09-team.md#2-1-브랜치)에 누락분 반영 완료 |
| C6 | 기능 번호 체계 | B1~B16 · A1~A12 · F1~F18 · C1~C5 ([09-team.md 3. 역할 분담](09-team.md#3-역할-분담)·[4. 브랜치·커밋 계획 (팀원별 10회 이상 보장)](09-team.md#4-브랜치커밋-계획-팀원별-10회-이상-보장)) | B1~B19 · F1~F14 · C1~C4 (features.md, [08-checklist.md 2. 기능 번호 대조](08-checklist.md#2-기능-번호-대조)) | |
| C8 | 리뷰 순환 순서 | 어썸체크 → 박성현A → 이성준 ([09-team.md 3. 역할 분담](09-team.md#3-역할-분담)) | 성원모 → 박성현 → 이성준 ([10-pull-request.md 1-4. 리뷰와 머지](10-pull-request.md#1-4-리뷰와-머지)) | **재확정 (2026-09-23, C10)** — 2인 상호 리뷰: 성원모 PR 은 이성준이, 이성준 PR 은 성원모가 리뷰한다. 09 · 10 문서 반영 완료 |
| C10 | 팀원 이탈 | 3인 팀 — 성원모 · 박성현 · 이성준 | 2026-09-23 박성현 이탈 | **확정** — 2인 팀(성원모 · 이성준). 박성현 담당(AI 파이프라인 A1~A12, 관리자 API B15~B19)은 성원모가 모두 인수해 **백엔드 전체를 성원모가 담당**. 리뷰는 2인 상호 리뷰(C8). 09 · 10 · 08 · features.md · `backend/README.md` 반영 완료. GitHub 저장소 협업자·브랜치 보호 bypass 대상에서 박성현 제외 필요 |
| C9 | 브랜치 보호 설정 | 승인 1명 필수 ([09-team.md 2-1. 브랜치](09-team.md#2-1-브랜치)) | docs 직접 push 허용하려면 develop 보호 규칙 bypass 필요 | **확정** — `main`·`develop` 모두 PR 필수 + 승인 1명, `docs/` 문서만 수정하는 커밋은 develop 직접 push(보호 규칙 bypass 지정). [09-team.md 2-1. 브랜치](09-team.md#2-1-브랜치) 반영 완료, **GitHub 설정은 저장소 관리자가 적용 필요** / **실제 설정(2026-10-08 확인)**: `main` 만 보호 규칙(PR 리뷰 필수) 적용, `develop` 은 보호 없음 — 결정과 다름(F7) |

---

## D. 없는 파일 · 경로를 가리키는 참조

| # | 참조 | 위치 | 상태 |
|---|------|------|------|
| D3 | 프로젝트 README 가 루트에 없었음 — `3c64683` 에서 `README.md` 를 `backend/README.md` 로 옮긴 뒤 루트에 다시 만들지 않았고, `main` 에만 옛 README(세션 쿠키·Claude·Nginx·3인 기준)가 남아 있었음 | 루트 / `backend/README.md` | **해결** — 2026-10-08 루트 `README.md` 새로 작성(미션 2-2 항목: 개요·구조·API·DB·실행/배포·환경변수·민감정보·팀 역할) |
| D4 | README 의 문서 링크가 루트 기준 → `backend/` 에서는 깨짐 | `backend/README.md` | **해결** — 루트 README 는 루트 기준 링크(`docs/…`), `backend/README.md` 는 `../docs/…` 사용 |
| D5 | `.github/pull_request_template.md` | [09-team.md 2-3. PR](09-team.md#2-3-pr), 10 머리말 | **해결** — PR 템플릿 추가(v1.5), 이슈 템플릿 `.github/ISSUE_TEMPLATE/issue_template.md` 도 추가(v1.6) |
| D7 | `backend/scripts/check_logs.sql` | 04 DB 확인, [08-checklist.md 1. mission 요구사항 대조](08-checklist.md#1-mission-요구사항-대조) | **해결** — 추가됨 (#11·PR #17) |
| D8 | `plan.md`, `theory.md`, 이전 경로 `chatbot/` | (이전 `handoff.md`) | **해결** — `handoff.md` 삭제됨(v1.5). E15 도 함께 해소 |

---

## E. 사실 오류 · 코드와 문서 차이

| # | 문제 | 위치 |
|---|------|------|
| E7 | **해결** — README 저장소 링크·서비스 URL 은 루트 README 맨 위에 기입 | 루트 README (D3) — backend/README 는 백엔드 안내라 저장소 링크 불필요 |
| E8 | **해결** — `backend/README.md` 는 JWT·Codyssey·Railway 기준으로 갱신됨(2026-10-08 확인, 2026-10-14 테스트 수·PR 번호·public_id·별도 스레드 반영). 남은 옛 내용은 `main` 의 루트 README(D3) | `backend/README.md` (D3 과 함께 처리) |
| E9 | **해결** — `requirements.txt` 에 `python-dotenv` 포함, 2026-10-01 Railway 백엔드 기동 확인. (기록: `python-dotenv` 를 import 하지만 `requirements.txt` 에 없어 2026-09-14 Railway 백엔드가 `ModuleNotFoundError: No module named 'dotenv'` 로 기동 실패) | `backend/main.py:3` / `backend/requirements.txt` |
| E10 | **해결** — `requirements.txt` 가 문서 구성(fastapi·uvicorn·sqlalchemy·pydantic·pydantic-settings·python-dotenv·bcrypt·pyjwt·httpx)과 일치, `requests` 제거 (#10·PR #15, PR #62) | `backend/requirements.txt` / [06-deployment.md 2. 설치](06-deployment.md#2-설치) |
| E11 | **해결** — `POST /api/chat` 구현(인증·입력 검증·호출 전체 30초 상한·504/502·성공/실패 DB 저장·봉투 응답, httpx 비동기), 골격 `backend/main.py` 삭제 (#61·PR #62). 단계별 서버 로그는 B13 에서 진행 | `backend/main.py` |
| E12 | **해결** — 루트 `.gitignore` 에 `.env.*`·`*.db`·`node_modules/`·`dist/` 추가 (#10) | `.gitignore` / [06-deployment.md 9. 민감정보 관리 체크](06-deployment.md#9-민감정보-관리-체크) |
| E14 | **해결(결정)** — `mission.md` 는 과제 안내 원문이라 저장소에 올리지 않는다(코드·문서 모두 미추적, 팀 결정 2026-10-08) | 루트 |
| E15 | handoff.md 전체가 세션·Claude·username·400/503 기준 — 현재 결정과 다름 | **해결** — `handoff.md` 삭제(v1.5) |
| E17 | **해결(코드)** — `app/main.py` 에 `CORSMiddleware`(`CORS_ORIGINS`) 추가(#10·PR #15), preflight 테스트 V22 통과. Railway 실배포 CORS 허용·차단 확인 완료(2026-10-06 배포 A2·A3, 2026-10-08 특수 Origin 차단 — 13-security-review P09). (기록: **백엔드에 `CORSMiddleware` 가 없음** → Railway 두 도메인 구성에서 브라우저 API 호출이 CORS 로 차단됨. **2026-09-15 로컬 재현 확인**: develop `backend/main.py` 에 preflight `OPTIONS /chat` (Origin: 프론트 도메인) → `405 Method Not Allowed`, `access-control-allow-origin` 헤더 없음. Railway 실배포 확인은 백엔드 기동(E9) 후) | `backend/main.py` / [06-deployment.md 5. CORS 설정](06-deployment.md#5-cors-설정)·[7. 외부 접속 · CORS 검증 (평가 전 필수)](06-deployment.md#7-외부-접속--cors-검증-평가-전-필수) |
| E18 | **해결** — 모든 응답이 `{code, data}` 봉투(`core/responses.py`, #10·PR #15), 챗 API 도 봉투로 응답(PR #62). V23 통과 | `backend/main.py` / [03-api.md 0. 공통 규약](03-api.md#0-공통-규약) |

---

## F. 확인이 필요한 사항 (질문)

| # | 질문 | 영향 |
|---|------|------|
| F1 | Codyssey AI API 의 **호출 제한**(분당/일일), 에러 응답 형식, 타임아웃 권장값 | [02-architecture.md 6. Codyssey AI API 연동 메모](02-architecture.md#6-codyssey-ai-api-연동-메모), [06-deployment.md 8. 트러블슈팅](06-deployment.md#8-트러블슈팅), [07-verification.md 3. 실제 Codyssey AI API 연동 검증 (키 설정 후)](07-verification.md#3-실제-codyssey-ai-api-연동-검증-키-설정-후), [12-decisions.md 3. AI 응답 대기 30초](12-decisions.md#3-ai-응답-대기-30초) |
| F2 | 모델 `gpt-5-mini` 로 확정인가? (현재 `services/ai_service.py` 의 `AI_MODEL` 상수 값) | [02-architecture.md 6. Codyssey AI API 연동 메모](02-architecture.md#6-codyssey-ai-api-연동-메모), 환경변수 `AI_MODEL` 추가 여부 |
| F5 | ~~팀원 이름·역할(C1·C2) 통일~~ → **해결**: C10 재확정(2인, 성원모 백엔드 전체·이성준 프론트 전체) | [09-team.md 3. 역할 분담](09-team.md#3-역할-분담)·[4. 브랜치·커밋 계획 (팀원별 10회 이상 보장)](09-team.md#4-브랜치커밋-계획-팀원별-10회-이상-보장)·[6. 개인별 작업 요약](09-team.md#6-개인별-작업-요약), README |
| F6 | ~~커밋·브랜치 규칙(C4·C5) 통일~~ → **해결**: C4·C5 확정 | [09-team.md 2. 팀 운영 규칙](09-team.md#2-팀-운영-규칙) |
| F7 | ~~develop 보호 규칙에서 docs 직접 push 를 어떻게 허용할 것인가~~ → **bypass 대상 지정으로 확정(C9)**. 남은 것은 GitHub 에 실제 설정 적용 | GitHub 설정, [09-team.md 2-1. 브랜치](09-team.md#2-1-브랜치) |
| F8 | ~~README 위치(D3)~~ → **해결**: 루트에 새로 작성(2026-10-08) | 평가자가 처음 보는 문서 |
| F9 | ~~`mission.md` 를 저장소에 올릴 것인가 (E14)~~ → **해결**: 올리지 않음(E14) | 문서 이력 |
| F13 | ~~HTTP 항상 200 의 결과를 팀이 인지했는가~~ → **해결**: 13-security-review L04 에 대가·근거 기록, 배포 확인 때 Railway 로그·응답 본문 `code` 로 판정 | [06-deployment.md 8. 트러블슈팅](06-deployment.md#8-트러블슈팅), 07 판정 |

---

## G. 관리자 기능 — 함께 정해야 할 것

| # | 항목 | 현재 문서 초안 | 결정 |
|---|------|----------------|------|
| G1 | 관리자 권한 판별 | `users.role` + `require_admin` 이 **매 요청 DB role 확인** (토큰에 role 미포함), 실패 `code: 403` ([02-architecture.md 5-3. 인증 확인 `get_current_user` / `require_admin`](02-architecture.md#5-3-인증-확인-get_current_user--require_admin), [03-api.md 4-0. 공통](03-api.md#4-0-공통)) | |
| G2 | 관리자 계정 생성 | 가입으로 불가. 서버 시작 시 `.env` `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NICKNAME` 으로 생성, 이미 있으면 `role=admin` 승격, 그 외 관리자는 `user` 로 강등(관리자 1명), 비밀번호는 `ADMIN_PASSWORD` 로 맞춤 ([03-api.md 4-0. 공통](03-api.md#4-0-공통), [06-deployment.md 3. 환경변수](06-deployment.md#3-환경변수)). 관리자 여러 명 필요 여부 | |
| G3 | 조회 전용 | 수정·삭제 API 없음 ([03-api.md 4-0. 공통](03-api.md#4-0-공통)) | |
| G4 | `server_logs` 보관·정리 | 무기한 보관 (초안). refresh token 과 같은 하루 1회 스케줄러로 보관 기간(예 30일) 지난 행을 지울지 | |
| G5 | 내 대화 로그에 AI 실패 기록 노출 | 성공만 노출 ([03-api.md 3-1. 내 대화 로그 조회](03-api.md#3-1-내-대화-로그-조회)). 사용자가 자기 실패 이력을 봐야 하는지 | **성공만 노출로 확정** — 실패 기록은 관리자 화면(F13 AI 실패 기록)에서 추적한다 |
| G6 | 개인정보 | 관리자는 다른 사용자의 질문·응답 원문을 본다. 서비스 안내 문구·문서 명시 여부 | |
| G7 | **담당자** | 미정 — 백엔드 B15~B19, 프론트 F10~F14 (C2 와 함께 결정) | **프론트 F10~F14 = 이성준 (확정)** · **백엔드 B15~B19 = 성원모 (재확정 2026-09-23, C10)** — 관리자 API 5종 + 관리자 조회 CRUD. 박성현 이탈로 이관. `require_admin`·관리자 시드는 인증 작업에서 구현 완료 |
| G8 | 감사 로그 범위 | `admin_access`(모든 관리자 API), `admin_forbidden`(403) 기록 ([03-api.md 6. 서버 로그 이벤트 규약](03-api.md#6-서버-로그-이벤트-규약)) | **구현됨** — `require_admin` 에서 `admin_access`·`admin_forbidden` 기록(#66·PR #67, V38, 배포 A6) |
| G9 | 노출 금지 필드 | `hashed_password`·API 키·토큰 미포함 ([03-api.md 4-0. 공통](03-api.md#4-0-공통)) | **구현됨** — 응답에 필요한 필드만 골라 `hashed_password`·토큰 미포함(V34) |
| G10 | Railway 에서 SQL 확인 | Volume 안 SQLite 는 평가자가 직접 `sqlite3` 로 열기 어렵다. 관리자 화면·API 를 주 확인 수단으로 안내할지 | **확정** — 배포 환경은 관리자 화면·관리자 API 를 주 확인 수단으로 안내, `check_logs.sql` 은 로컬 DB 용(08-checklist 3) |
