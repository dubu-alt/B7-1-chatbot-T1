# 05. UI / UX 설계

> 담당: **이성준 (프론트엔드)** — [09-team.md 3. 역할 분담](09-team.md#3-역할-분담) (관리자 화면 담당은 [11-open-issues.md](11-open-issues.md) G7)
> 스택: React · **TypeScript(strict)** · Vite · React Router · axios · Context API · **CSS Modules**
> 디자인 기준 시안: `docs/design/AI Chat Service.html` (다크 톤 · 청록 포인트 · 기술 정보는 모노 폰트)

## 1. 디자인 시스템

### 폰트

| 용도 | 폰트 | 사용처 |
|------|------|--------|
| 본문 | **IBM Plex Sans KR** (400/500/600) | 제목, 버튼, 말풍선, 폼 |
| 보조/기술 정보 | **IBM Plex Mono** (400/500) | 시각, 결과 코드, 엔드포인트 표기, 글자수, request_id |

Google Fonts 로드 + `system-ui` 폴백.

### 디자인 토큰

**기준은 [`docs/design/prototype.html`](design/prototype.html) 의 [디자인 토큰] 화면**이다. 토큰 이름·값·쓰는 곳·모바일 값이 표로 있고, 페이지의 CSS 변수를 직접 읽어 그리므로 파일과 표가 어긋나지 않는다.
구현은 `frontend/src/styles/global.css` 의 `:root` 에 두고, 컴포넌트별 `*.module.css` 는 **의미 토큰만** 쓴다 (`import styles from './Chat.module.css'` → `className={styles.bubble}`).
전역 CSS 는 `styles/` 두 파일뿐이다 — 브라우저 기본값 정리는 `reset.css`, 프로젝트 고유 값은 `global.css` 이며 `main.tsx` 에서 이 순서로 로드한다.

| 분류 | 내용 |
|------|------|
| 색 | 원시 팔레트(`--gray-*`·`--teal-*`·`--orange-500`) → 의미 토큰(텍스트·배경·테두리·포커스 링·주/보조 버튼 상태별·상태 색·로딩·토스트). 컴포넌트는 의미 토큰만 |
| 텍스트 색 | 기본 `--text-primary` · **보조 `--text-secondary` 한 단계**(설명·라벨·시각·코드, 대비 6:1) · 비활성 · placeholder · 링크 · 오류/성공. 시안의 3차 글자색은 대비 3.2:1 로 부족했고, 올리면 보조 글자와 거의 같아져 하나로 합쳤다 |
| 버튼 | 6가지 상태 — 기본 · hover(마우스 기기만) · 누름 · 포커스(키보드) · 비활성(투명도 대신 전용 색) · 로딩(스피너 + 문구) |
| 글자 | IBM Plex Sans KR / Mono, 크기 12단계(본문 15px), 굵기 3, 줄 간격 3 |
| 간격·모서리·크기 | 4px 그리드, 모서리 8단계, 버튼·입력 높이 40px(모바일 44px) |
| 움직임 | hover 120ms · 전환 200ms · 등장 280ms(모바일 220ms) · 대기 점 1.2s · 스피너 0.8s |
| 모바일 ≤560px | 제목 22px, **입력 글자 16px**(iOS 입력 시 확대 방지), 버튼·입력 **44px**(터치 최소), 말풍선 90% |
| 동작 줄이기 | `prefers-reduced-motion` — 전환·등장·누름 0, 대기 점 정지, 스피너는 멈추지 않고 느리게 |

### 지원 브라우저

**Chrome·Edge 90 · Safari 14.1 (macOS·iOS) · Firefox 90 · Samsung Internet 15 이상** (2021년 이후).

- 색은 **hex·rgba 로 미리 계산**해 둔다. `oklch()`·`color-mix()` 는 2023년 이후 브라우저만 지원해 쓰지 않는다
- Safari 14.1 이 하한인 이유는 flex `gap`. `:focus-visible` 은 Safari 15.4 부터라 그 전에는 마우스로 눌러도 포커스 링이 보인다 (기능 문제 없음)
- 없어도 되는 기능: 얇은 스크롤바 색, 헤더 흐림(`backdrop-filter`, Safari 는 `-webkit-` 접두어), 제목 줄바꿈 균형. 지원하지 않으면 기본 모양으로 보인다

### 토스트

화면 흐름을 막지 않는 짧은 알림. **쓰는 곳**: 로그아웃 완료 · 로그인 만료로 로그인 화면 이동 · 이전 기록/더 보기 불러오기 실패(보던 목록은 그대로 두고 다시 불러오기 아이콘 제공).

| 항목 | 규칙 |
|------|------|
| 위치 | **화면 위쪽, 헤더 바로 아래 가로 가운데** (PC·태블릿·모바일 같음). 헤더와 16px 띄운다. 헤더(sticky) 기준이라 스크롤해도 따라오고, 모바일 2줄 헤더에서도 그 아래에 뜬다. 위에서 살짝 내려오며 나타난다. 아래 가운데는 태블릿·모바일에서 챗 입력칸·[전송]·키보드와 겹쳐 쓰지 않는다 (2026-10-07 변경, 이전: PC 헤더 아래 오른쪽) |
| 폭 | 최대 420px, 모바일은 좌우 여백만 남기고 꽉 채움 |
| 시간 | 정보 4초 · 오류 6초 뒤 사라짐. 마우스를 올리거나 포커스가 있으면 멈춤. 닫기 버튼 항상 |
| 개수 | 최대 3개, 새 것이 위 |
| 접근성 | 정보 `role="status"`, 오류 `role="alert"` |
| 쓰지 않는 곳 | 가입 완료(이메일이 채워진 로그인 폼과 짝이라 계속 보여야 함) · 폼 오류(고칠 칸 옆) · 첫 화면 불러오기 실패(자리에 크게 안내) · 챗 AI 오류(대화 흐름 안의 말풍선) |

### 형태

- 모서리: 카드 14px · 입력/버튼 10px · 말풍선 14px(꼬리 쪽 4px)
- 등장 애니메이션 `rise`(6px 위로 페이드) 280ms, 로딩 점 `blink` 1.2s — 동작 줄이기 설정에서 비활성
- 최대 폭 1180px, 좌우 여백 `clamp(16px, 4vw, 32px)`
- **새로고침·다시 시도·다시 불러오기는 글자 대신 새로고침 아이콘 버튼** (이름은 `aria-label`·툴팁). 챗 [다시 시도] 는 오류 말풍선 아래에 간격을 두고 **오른쪽 끝**에 배경 없는 아이콘으로 (왼쪽은 시각)
- 헤더 브랜드는 "Chatlog" 만 (시안의 "FastAPI · SQLite" 태그 없음)

### 로딩 · 오류 화면

| 상황 | 표시 |
|------|------|
| 영역을 불러오는 중 | **스피너 + 문구**(`LoadingStatus`, 예: "이전 대화를 불러오는 중…") 로 통일. 인증 확인 중(새로고침 직후)은 판정 전 화면을 가리지 않도록 빈 상태. **화면 코드를 받는 중**("화면을 불러오는 중…")은 화면마다 본문 위치가 달라 어긋나 보이지 않게 **화면 정가운데**에 둔다 |
| 첫 불러오기 실패 | 자리에 안내 박스 + 다시 불러오기 아이콘 (문구만) |
| 추가 불러오기 실패 (이전 기록·더 보기) | 토스트 — 보던 목록은 그대로 |
| **앱 오류 화면** | 화면 코드에서 예외가 나면 흰 화면 대신 "문제가 생겼습니다" + 새로고침 아이콘 (`ErrorBoundary`). 본문만 바뀌고 헤더·메뉴는 남는다. 다른 화면으로 옮기면 풀린다 |

### 시간 표기

기준은 **보는 사람의 오늘**, 24시간제. "3분 전" 같은 상대 표기는 쓰지 않는다 — 기록을 추적하는 서비스라 정확한 시각이 필요하고, 켜 둔 동안 값이 낡는다 (`utils/datetime.ts`).

| 언제 | 챗 말풍선 | 챗 날짜 구분선 | 목록(로그·관리자) |
|------|-----------|----------------|-------------------|
| 오늘 | 14:05 | 오늘 | 오늘 14:05 |
| 어제 | 14:05 | 어제 | 어제 14:05 |
| 올해 그 전 | 14:05 | 9월 21일 (월) | 9월 21일 14:05 |
| 작년 이전 | 14:05 | 2025년 12월 3일 (수) | 2025-12-03 14:05 |

- 목록 시각에 마우스를 올리면 전체 시각(`2026-09-28 14:05:12`)이 툴팁으로 보인다
- 요청 흐름(관리자)은 한 요청 안의 순서라 초까지(`14:05:30`)
- 날짜 차이는 24시간이 아니라 **달력 날짜**로 센다 (자정을 넘긴 23:50 은 "어제")

## 2. 라우팅

| 경로 | 화면 | 접근 |
|------|------|------|
| `/` | (이동) | `/chat` 으로 보낸다. 비로그인이면 챗의 가드가 다시 로그인으로 보낸다 — 경로가 없으면 배포 주소를 열자마자 404 가 뜬다 |
| `/login` | 로그인 | 게스트 전용 (로그인 상태면 `/chat` 으로) |
| `/signup` | 회원가입 | 게스트 전용 |
| `/chat` | 챗 | **로그인 필수** |
| `/logs` | 내 대화 로그 | **로그인 필수** |
| `<관리자 주소>` | 관리자 | **관리자 필수** (`role=admin`). 관리자가 아니면 비로그인·일반 사용자 모두 **없는 주소와 같은 404 화면** |
| `*` | **404 Not Found** 화면 | 다른 화면으로 보내지 않는다 (사용자가 주소를 잘못 쳤음을 알 수 있게) |

라우팅 가드는 `AuthContext` 가 계산한 **`AuthStatus` 한 값**으로 판정한다. 토큰 유무와 사용자 정보 유무를 가드가 각각 검사하지 않는다.

| `AuthStatus` | 조건 | 가드 동작 |
|--------------|------|-----------|
| `anonymous` | localStorage 에 access token 이 없음 | **즉시** 로그인으로 이동 (서버에 묻지 않음) |
| `checking` | 토큰은 있고 `GET /api/auth/me` 응답 대기 중 | **판정 보류** (화면을 가리지 않고 아무것도 렌더하지 않음) |
| `authenticated` | 토큰이 있고 사용자 정보를 받아옴 | 통과. `RequireAdmin` 은 여기에 `role === 'admin'` 을 더한다 |

- `anonymous` 를 **토큰 유무로 동기 판정**하는 이유: 토큰이 없는데도 화면을 먼저 그리면, 첫 API 호출이 401 로 실패한 뒤에야 로그인으로 튕겨 **화면이 깜빡인다.**
- `checking` 에서 판정을 미루는 이유: `user` 초기값이 `null` 이라 응답 전에 판정하면 **새로고침할 때마다 로그인 화면이 한 번 번쩍인다.**
- 이 상태는 앱이 전체 로드될 때(새로고침·주소 직접 입력·탭 재실행) 한 번만 거치며, SPA 내부 화면 이동에서는 다시 발생하지 않는다.

프론트 가드는 화면 이동용이며, **권한 검사는 서버 `require_admin` 이 최종**이다. 사용자가 `AuthContext` 값을 직접 조작해도 관리자 메뉴만 보일 뿐 관리자 API 는 서버가 403 으로 막는다.

## 3. 화면 구성

> 일반 사용자 화면에는 API 경로·내부 구현(JWT·bcrypt 등) 표기를 두지 않는다. 사용자에게 필요 없고 서버 구조를 드러내기 때문이다 (2026-10-08, #82). 관리자 화면은 추적용이라 요청 번호(request_id)·결과 코드를 보여 준다.

### 공통 헤더 / 푸터

```
┌──────────────────────────────────────────────────────────────────────┐
│ [C] Chatlog  [챗|내 대화 로그|관리자]               <닉네임> [로그아웃] │  ← 관리자
│ [C] Chatlog  [챗|내 대화 로그]                      <닉네임> [로그아웃] │  ← 로그인
│ [C] Chatlog                                                  [로그인]  │  ← 비로그인
│ [C] Chatlog  [챗|내 대화 로그]                      (빈 자리, 높이 유지) │  ← 확인 중
└──────────────────────────────────────────────────────────────────────┘
```

- 헤더 sticky + blur. **인증 상태·권한에 따라 메뉴가 다르게 표시** (평가 항목 "로그인/비로그인에 따라 보이는 메뉴 구분")
- **새로고침 직후 로그인 확인 중에도 메뉴와 계정 영역의 틀을 먼저 그린다.** 확인 중은 저장된 토큰이 있을 때뿐이라 대부분 로그인 상태다. 계정 영역은 버튼 높이만큼 최소 높이를 잡아 두고, 확인 뒤 닉네임·[로그아웃] 또는 [로그인]·관리자 탭만 채운다 — 헤더 높이가 바뀌어 화면이 흔들리지 않게. [로그인]을 먼저 그렸다 바꾸지는 않는다(깜빡임)
- 비로그인 메뉴는 **[로그인]만** 둔다. 회원가입은 로그인 화면 아래 안내 문장으로 이동한다
- 사용자 표시는 **닉네임** (이메일은 노출하지 않음)
- 로그아웃: `POST /api/auth/logout` `{refresh_token}` → **응답과 관계없이** 저장된 access·refresh token 삭제 → `AuthContext` 초기화 → `/login` (네트워크 오류여도 로그아웃 처리)

### 화면 1: 회원가입 (`/signup`)

```
        회원가입
        ┌──────────────────────────────────┐
        │ 이메일     [user@example.com   ] │
        │ 비밀번호   [••••••••           ] │  8자 이상
        │ 닉네임     [어썸체크            ] │  1~20자 (중복 가능)
        │ 이미 가입된 이메일입니다.  (주황, 이메일 칸 아래) │
        │ [            가입하기           ] │
        │   이미 계정이 있나요? 로그인  (문장 전체가 링크) │
        └──────────────────────────────────┘
```

| 상호작용 | 동작 |
|----------|------|
| 클라이언트 검증 | 이메일 형식 / 비밀번호 8자 이상 / 닉네임 1~20자 → 실패 시 요청을 보내지 않음 |
| `code: 409` | `data.message` 표시 + 이메일 필드 포커스 |
| `code: 422` | `data.message` 그대로 표시 |
| `code: 201` | `/login` 이동 + "가입이 완료되었습니다" 안내 + **이메일 자동 입력** |
| 제출 중 | 버튼 "처리 중…" + disabled (중복 제출 방지) |

### 화면 2: 로그인 (`/login`)

```
        로그인
        챗봇 질문·응답 기능은 로그인한 사용자만 사용할 수 있습니다.
        ┌──────────────────────────────────┐
        │ (가입 완료 안내 — 청록 박스)          │
        │ 이메일     [user@example.com   ] │
        │ 비밀번호   [••••••••           ] │
        │ 이메일 또는 비밀번호가 올바르지 …  (주황) │
        │ [             로그인            ] │
        │  아직 계정이 없나요? 회원가입 (문장 전체가 링크) │
        └──────────────────────────────────┘
```

| 상호작용 | 동작 |
|----------|------|
| `code: 200` | `access_token`·`refresh_token` 저장 → `GET /api/auth/me` → `AuthContext` 갱신 → 원래 가려던 경로(`state.from`) 또는 `/chat` |
| `code: 401` | `data.message` (코드 표시 없음), **비밀번호 필드만 비움**. 로그인 API 의 401 은 전역 로그아웃 처리하지 않음 |
| 접근성 | `label` 연결, `autocomplete=email / current-password / new-password`, 오류 `role="alert"` |

**토큰 저장 위치 — `localStorage` 확정** (access·refresh 모두 같은 곳, refresh 는 요청 body 로 전송).
"새로고침 시 로그인 상태 복원" 요구가 있어 메모리(Context) 저장으로는 충족할 수 없기 때문이다. 근거·대안 비교는 [12-decisions.md 4. 토큰을 프론트에 저장하는 위치 — 위험성과 대안](12-decisions.md#4-토큰을-프론트에-저장하는-위치--위험성과-대안).

| 키 | 값 |
|----|----|
| `auth:access_token` | access token (JWT, 15분) |
| `auth:refresh_token` | refresh token (1일, 재발급 시 회전) |

키 접두어는 **관심사(`auth:`)** 로 나눈다. `localStorage` 는 이미 도메인 단위로 격리되므로 서비스명을 접두어로 붙이지 않는다. 이후 키가 늘어나면 `ui:` 등으로 같은 규칙을 따른다.

토큰 읽기·쓰기·삭제는 `src/utils/tokenStorage.ts` 한 곳에서만 한다. 이 모듈은 **토큰이 바뀌면 구독자에게 알리고**, React 쪽은 `useSyncExternalStore` 기반 `useAccessToken` 훅으로 그 변화를 받는다. 덕분에 인터셉터가 재발급 실패로 토큰을 지우면 **`clearTokens()` 호출만으로** 화면이 로그인 상태에서 빠져나온다 (인터셉터는 `AuthContext` 를 알지 못한다).

**XSS 대응 — 저장 방식이 아니라 아래 두 축으로 막는다.** (해시·암호화 저장은 방어가 되지 않는다: 해시는 되돌릴 수 없어 서버에 보낼 수 없고, 암호화는 복호화 키도 브라우저에 있어야 하며, 스크립트를 실행할 수 있는 공격자는 저장된 토큰 없이도 로그인된 상태로 요청을 보낼 수 있다.)

| 축 | 조치 |
|----|------|
| XSS 를 만들지 않기 | `dangerouslySetInnerHTML` 사용 금지 — **AI 답변도 텍스트로만 렌더링** · 외부 스크립트(CDN·분석 태그) 미삽입 · 의존성 최소화 · 사용자 입력을 `href`/`src` 에 그대로 넣지 않기 |
| 터졌을 때 피해 줄이기 | access **15분** · refresh **회전**(재발급 시 이전 토큰 무효 → 탈취된 토큰의 수명이 "다음 재발급까지"로 줄고, 공격자와 사용자 중 한쪽이 튕겨 **탈취가 드러남**) · 로그아웃 시 서버에서 refresh 폐기 — 회전 이유 상세: [12-decisions.md 9. access + refresh token · 로그아웃 API](12-decisions.md#9-access--refresh-token--로그아웃-api) |

> refresh token 을 HttpOnly 쿠키로 옮기면 XSS 노출은 줄지만, 프론트·백엔드가 다른 도메인이라 CORS `credentials`·`SameSite=None` 설정과 서드파티 쿠키 정책 문제가 생긴다 ([11-open-issues.md](11-open-issues.md) A7 세부, [12-decisions.md 4. 토큰을 프론트에 저장하는 위치 — 위험성과 대안](12-decisions.md#4-토큰을-프론트에-저장하는-위치--위험성과-대안) 대안).

### 화면 3: 챗 (`/chat`) — 로그인 필수

```
┌─ 새 대화 · 최근 대화 5개를 기억해요 ──────────────────────┐
│ ┌────────────────────────┐                                │
│ │안녕하세요. 무엇을 도와…    │  14:02                        │
│ └────────────────────────┘                                │
│                          ┌──────────────────────────────┐ │
│                          │ FastAPI에서 CORS 설정은…      │ 14:03
│                          └──────────────────────────────┘ │
│ ┌──────────────────────────────┐                          │
│ │ 현재 응답이 지연되고 있어요…     │ ← 주황 오류 말풍선 (문구만)   │
│ └──────────────────────────────┘                          │
│  14:22                         ↻  ← 다시 시도 아이콘 (504·502 만) │
│ ● ● ●  (응답 대기)                                          │
├────────────────────────────────────────────────────────────┤
│ [질문을 입력하세요 — Enter 전송, Shift+Enter 줄바꿈 ] [전송]   │
│                                                 14 / 1000  │
└────────────────────────────────────────────────────────────┘
```

| 요소 | 동작 / 이유 |
|------|-------------|
| 진입 시 | `GET /api/me/chats?limit=20` 으로 **이전 대화 복원** → 새로고침해도 대화가 사라지지 않음. **아래가 최신**, 맨 아래에서 시작 |
| 이전 대화 | **맨 위로 스크롤하면 이전 20건을 위에 붙인다**(`offset` = 받은 개수). 보던 위치는 유지. 더 없으면 추가 요청·표시 없음. 내 대화 로그와 같은 방식 |
| 말풍선 3종 | 사용자(우측·청록) / 봇(좌측·회색) / 오류(좌측·주황, **문구만** — 코드 표시 없음) |
| 응답 표시 | **같은 화면에서** 대화 흐름 형태로 누적 (페이지 전환 없음) |
| 전송 | Enter 전송, Shift+Enter 줄바꿈, **한글 IME 조합 중 Enter 무시**(`isComposing` — 마지막 글자 중복 방지) |
| 낙관적 표시 | 사용자 말풍선을 즉시 추가 → 로딩 점 3개 → 응답/오류 말풍선 |
| 클라이언트 검증 | 공백만 / 로딩 중 → 전송 버튼 비활성, 1000자에서 입력 차단 + 카운터 주황 |
| textarea | **높이 고정(3줄)**, 넘치는 내용은 입력칸 안에서 스크롤. 사용자 크기 조절 불가(`resize: none`). 내용에 따라 늘고 줄면 대화 영역이 밀려 읽던 위치를 잃는다 |
| 오류 후 | 입력창 포커스 복귀 → 새 질문도 바로 가능 (서비스가 살아 있음을 체감) |
| **다시 시도 (아이콘)** | `code` 504·502 오류 말풍선 **아래에 간격을 두고 새로고침 아이콘**으로 표시 (`aria-label="다시 시도"`). 누르면 **같은 질문으로 `POST /api/chat` 재호출** → 오류 말풍선을 로딩 점으로 바꾸고 결과로 교체. 요청 중에는 버튼·전송 비활성. **자동 재시도는 하지 않는다** ([03-api.md 2-1. 질문 전송](03-api.md#2-1-질문-전송)) |
| 자동 스크롤 | 방금 보낸 질문은 어디를 보고 있든 하단으로. 답변 도착은 **맨 아래를 보고 있을 때만** 따라간다 — 위로 올려 읽는 중이면 화면을 움직이지 않고 아래 가운데 **[↓ 새 메시지]** 버튼을 띄운다(누르거나 직접 내리면 사라짐). 이전 대화가 위에 붙을 때는 따라가지 않음 |
| 날짜 구분선 | 날짜가 바뀌는 곳에 "오늘"·"어제"·"9월 21일 (월)"·"2025년 12월 3일 (수)". 말풍선에는 시각(`14:05`)만 — 시간 표기 규칙은 1절 |
| 이전 기록 실패 | 이미 받은 대화는 그대로 두고 **토스트**(다시 불러오기 아이콘)로 알린다 |
| `aria-live="polite"` | 스크린리더가 새 응답을 읽어줌 |
| 느린 응답 안내 | 첫 요청이 5초 이상 걸리면 "서버를 깨우는 중입니다" 보조 문구 (Railway 슬리핑 사용 시 대응) |

### 화면 4: 내 대화 로그 (`/logs`) — 로그인 필수

```
내 대화 로그                                    ┌ 총 기록 ┐   [↻]
로그인한 사용자 본인의 기록만 보입니다.               │   42   │
┌────────────────────────────────────────────────────┐ ↑ 맨 위로 스크롤하면
│ 40번째                              2026-09-14 09:58 │   이전 20건을 위에 붙임
│ QUESTION  …                                          │   (offset += 받은 개수)
│ ANSWER    …                                          │
├────────────────────────────────────────────────────┤
│ 41번째                              2026-09-14 10:03 │
│ QUESTION  배포 방법 알려줘                              │
│ ANSWER    Railway 에 배포하려면…                         │
├────────────────────────────────────────────────────┤
│ 42번째                              2026-09-14 10:05 │ ← 가장 최신, 처음엔 여기
│ QUESTION  FastAPI에서 CORS…                           │
│ ANSWER    FastAPI에서는 CORS…                          │
└────────────────────────────────────────────────────┘
```

- **챗 화면과 같은 방향: 아래가 최신, 위가 오래된 기록.** 1열 목록, 처음엔 맨 아래에서 시작
- 상단에 `total` 표시. **맨 위로 스크롤하면** 이전 20건을 불러와 위에 붙이고(`limit=20`, `offset` = 이미 받은 개수), **보던 카드는 제자리 유지**
- 더 불러올 기록이 없으면 추가 요청을 하지 않고, "처음 대화입니다" 같은 표시도 하지 않는다
- 서버는 최신순으로 주고 화면에서 뒤집는다. 보는 도중 새 대화가 생겨 페이지가 밀려도 `chat_id` 로 중복 제거
- **카드 번호는 내 기록 안의 순번("N번째")** — 가장 오래된 대화가 1번째, 최신이 총 기록 수. 서버 `chat_id`(UUID)는 읽을 수 없고, 순차 DB 번호는 서비스 전체 대화 수를 드러내 보여 주지 않는다 (#106·#108). 순번은 첫 페이지의 `total` 로 세어, 보는 도중 새 대화가 생겨도 보이던 카드의 순번이 바뀌지 않는다
- 비어 있으면 점선 박스 "아직 저장된 대화가 없습니다."
- 카드 시각은 목록 규칙("오늘 14:05"·"9월 21일 14:05"), 마우스를 올리면 전체 시각. 새로고침은 아이콘 버튼

### 화면 5: 관리자 (`<관리자 주소>`) — 관리자 필수

**관리자 화면 주소는 환경변수 `VITE_ADMIN_PATH` 로 정하고 문서·코드에 적지 않는다.** `/admin` 처럼 짐작하기 쉬운 주소는 찔러보기 좋은 표적이 된다.
관리자가 아닌 사람이 그 주소로 오면 비로그인·일반 사용자 모두 **없는 주소와 똑같은 404 화면**을 보여주고 주소도 바꾸지 않는다. 404 화면에는 로그인 상태나 권한을 짐작하게 하는 문구를 넣지 않는다. 반응이 다르면 "이 주소에 무언가 있다"는 것이 드러난다. 관리자는 먼저 로그인한 뒤 주소로 들어온다.
헤더의 **"관리자" 탭은 관리자에게만** 보이고 이 주소로 연결된다.
한계: 프론트 번들을 뒤지면 주소는 보인다. 무작위 탐색을 줄이는 장치이고, 권한 검사는 서버 `require_admin` 이 최종이다.

```
관리자                                                         [↻]
┌ 사용자 ┐ ┌ 대화 성공 ┐ ┌ 대화 실패 ┐ ┌ AI_TIMEOUT ┐ ┌ AI_CALL_FAILED ┐ ┌ 평균 응답 ┐
│  12   │ │   228    │ │    12    │ │     7      │ │       5        │ │ 1,320ms  │
└───────┘ └──────────┘ └──────────┘ └────────────┘ └────────────────┘ └──────────┘
[ 사용자 ]  [ AI 실패 기록 ]                                  ← 탭
┌─ 사용자 목록 ─────────────────┐ ┌─ user@example.com 의 대화 (44) ───────────┐
│ [이메일 검색          ]    [↻] │ │ #988 10:06  ERROR 504 · AI_TIMEOUT        │
│ ▸ user@example.com  44건 10:06 │ │   Q 긴 글 요약해줘          request 351990… │
│   other@example.com  3건 09:12 │ │ #987 10:05  SUCCESS 1,240ms               │
│              [ 더 보기 ]        │ │   Q FastAPI에서 CORS…  A FastAPI에서는…     │
└──────────────────────────────┘ └───────────────────────────────────────────┘
┌─ 요청 흐름  request_id 351990af2cf2 ───────────────────────────────────┐
│ 10:05:30 INFO  request_received  path=/api/chat                      │
│ 10:05:30 INFO  ai_call_start     context_turns=2                     │
│ 10:06:00 ERROR ai_call_failed    reason=timeout latency_ms=30000     │
│ 10:06:00 INFO  db_save_success   chat_id=988 status=error            │
└──────────────────────────────────────────────────────────────────────┘
```

| 영역 | API | 동작 |
|------|-----|------|
| 요약 카드 | `GET /api/admin/stats` | 진입 시 로드, 새로고침 아이콘으로 재조회 |
| 사용자 목록 | `GET /api/admin/users?q=` | **최근 활동 순**(대화 없는 사용자는 뒤), 이메일 검색(입력 후 300ms 디바운스), 더 보기 — **한 번에 PC 10명, 태블릿·모바일 5명**(처음 화면 폭 기준). 목록 안에서만 스크롤(높이 상한 60vh). 활동 순은 누가 대화할 때마다 바뀌므로 자동으로 따라가지 않고 **목록 새로고침 아이콘**으로 직접 다시 불러온다(검색어 유지) |
| 사용자별 대화 | `GET /api/admin/users/{id}/chats` | 목록에서 선택 시 오른쪽 패널, 성공(청록)/실패(주황) 배지, URL `?user=12` 유지. 이력 안에서만 스크롤(높이 상한 70vh) — 대화가 많아도 페이지 전체가 길어지지 않는다 |
| AI 실패 기록 | `GET /api/admin/failures` | 탭 전환, 시각·사용자·`code · 구분`·request_id |
| 요청 흐름 | `GET /api/admin/requests/{request_id}/logs` | request_id 클릭 시 하단 타임라인, `code: 404` 면 "로그가 없습니다" |
| 권한 | – | 관리자가 아니면 **없는 주소와 같은 404 화면**(위 설명), API 가 `code: 403` 이면 서버 문구 "관리자만 접근할 수 있습니다" 표시 |
| 태블릿·모바일 | – | ≤ 900px 에서 목록/대화 패널을 세로로 쌓음, 카드 2열. 사용자 목록 제목 옆 **[목록 접기]/[목록 펼치기]**(접어도 검색어·받은 목록 유지). **사용자를 고르면 목록을 자동으로 접고** 대화 제목으로 이동·초점 — 긴 목록을 지나 내려가지 않게. 사용자를 고른 주소로 들어오면 접힌 채로 시작 |
| 화면 폭 | – | 그리드 칸은 `minmax(0, 1fr)` — 긴 이메일·요청 번호·답변이 칸을 화면보다 넓히지 않게. 그냥 `1fr` 이면 모바일에서 페이지가 넓어져 헤더 오른쪽에 빈 띠가 생긴다 (2026-10-07 수정) |

- 비밀번호 해시·토큰은 표시하지 않는다. 질문·응답 원문은 관리자에게 표시된다 ([11-open-issues.md](11-open-issues.md) G6).

## 4. API 호출 공통 모듈

Authorization 헤더 자동 첨부와 `{code, data}` 판단을 한 계층에서 처리한다. 서버 응답은 **항상 HTTP 200** 이므로 axios 는 에러를 던지지 않고, 인터셉터가 `code` 를 보고 실패로 바꾼다.

파일은 역할별로 나눈다. `instance.ts` 는 **기본 설정과 인터셉터 등록만** 담고, 호출 함수는 두지 않는다.

```
src/
├── api/
│   ├── instance.ts          # axios.create + 인터셉터 등록
│   ├── interceptors/        # attachToken · normalize · refresh
│   ├── auth.ts / chat.ts / logs.ts   # 엔드포인트 함수
│   ├── ApiError.ts          # code · 안내 문구 · 재시도용 config
│   ├── types.ts             # 요청·응답 타입 (03-api.md 와 1:1)
│   └── axios.d.ts           # _retried 플래그 모듈 확장
├── utils/tokenStorage.ts    # 토큰 읽기·쓰기·삭제 + 변경 구독 (아무것도 import 하지 않음)
├── hooks/useAccessToken.ts  # useSyncExternalStore 로 토큰 구독
├── store/AuthContext.tsx
└── test/                    # server.ts(MSW) · setup.ts
```

### 인스턴스

```ts
// src/api/instance.ts
import axios from 'axios'

import { attachToken } from './interceptors/attachToken'
import { normalizeError, normalizeResponse } from './interceptors/normalize'
import { createRefreshInterceptor } from './interceptors/refresh'

export const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 35_000,   // 서버 AI 상한 30초보다 넉넉히. 짧으면 정상 응답을 클라이언트가 먼저 끊는다
})

instance.interceptors.request.use(attachToken)

// 응답 인터셉터는 등록 순서대로 실행된다.
// 정규화가 먼저 code 를 해석해야 재발급이 401 을 알아본다.
instance.interceptors.response.use(normalizeResponse, normalizeError)

// 재발급은 실패 경로에서만 동작하므로 성공 핸들러를 넘기지 않는다.
// 인스턴스를 인자로 넘기는 이유는 refresh.ts 가 이 파일을 import 하면 순환 참조가 되기 때문이다.
instance.interceptors.response.use(undefined, createRefreshInterceptor(instance))
```

### 요청 — 토큰 첨부

```ts
// src/api/interceptors/attachToken.ts
export function attachToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = getAccessToken()   // 매 요청마다 읽는다. 한 번 읽어두면 회전 후 옛 토큰을 보낸다
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}
```

### 응답 — 형식 정규화

```ts
// src/api/interceptors/normalize.ts
function unreachable(): ApiError {
  // 상수로 재사용하지 않는다. 매번 만들어야 스택 추적이 실제 발생 지점을 가리킨다
  return new ApiError(RESULT_CODE.unreachable, UNREACHABLE_MESSAGE)
}

export function normalizeResponse(response: AxiosResponse): AxiosResponse {
  const body: unknown = response.data

  // body 에 code 가 없음 = 서버가 준 응답이 아님 (Railway 앞단 502/503 등)
  if (!isEnvelope(body)) throw unreachable()

  if (body.code < 400) {
    response.data = body.data      // 봉투를 벗겨 안쪽 data 로 교체하고 AxiosResponse 형태는 유지
    return response
  }

  const message = (body.data as ApiFailureData | undefined)?.message ?? FALLBACK_MESSAGE
  // config 를 함께 싣는다. 오류로 바꾸는 순간 요청 정보가 사라져 재시도할 수 없기 때문이다
  throw new ApiError(body.code, message, response.config)
}

export function normalizeError(error: unknown): never {
  if (axios.isCancel(error)) throw error        // 요청 취소는 오류로 바꾸지 않는다
  if (error instanceof ApiError) throw error
  throw unreachable()                           // 네트워크 끊김, 타임아웃
}
```

### 응답 — 토큰 재발급 (single-flight)

```ts
// src/api/interceptors/refresh.ts
const AUTH_PATHS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout']

let refreshing: Promise<TokenPair> | null = null   // 진행 중인 재발급 (single-flight)

// instance 를 import 하지 않고 인자로 받는다. import 하면 instance -> refresh -> instance 순환이 된다
export function createRefreshInterceptor(client: AxiosInstance) {
  async function requestNewTokens(): Promise<TokenPair> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new Error('refresh token 이 없어 재발급할 수 없습니다.')

    const response = await client.post<TokenPair>('/api/auth/refresh', {
      refresh_token: refreshToken,
    })
    return response.data
  }

  return async function refreshInterceptor(error: unknown): Promise<AxiosResponse> {
    if (!isApiError(error) || error.code !== RESULT_CODE.unauthorized) throw error

    const config = error.config
    if (!config || isAuthPath(config.url) || config._retried) throw error

    try {
      refreshing ??= requestNewTokens()          // 이미 진행 중이면 그 결과를 함께 기다린다
      const tokens = await refreshing
      saveTokens(tokens.access_token, tokens.refresh_token)   // 회전된 토큰 2개 저장
    } catch {
      clearTokens()   // 저장소가 구독자에게 알림 → AuthContext 가 로그아웃 상태로 전환
      throw error
    } finally {
      refreshing = null
    }

    // client(config) 가 아니라 client.request(config) 를 쓴다 (아래 주의 참고)
    return client.request<unknown, AxiosResponse>({ ...config, _retried: true })
  }
}
```

**실패는 모두 `ApiError`(= `Error` 파생) 로 던진다.** 화면은 `catch (err)` 에서 `err.code` 로 분기한다.
인터셉터는 **형식 변환과 재발급까지만** 하고, "어떤 화면을 띄울지" 같은 비즈니스 분기는 하지 않는다.

**성공 응답은 `AxiosResponse` 형태를 유지한다.** `data` 만 꺼내 반환하면 axios 의 선언 타입
(`post<T>(): Promise<AxiosResponse<T>>`)과 실제 반환값이 어긋나, **타입 검사를 통과한 코드가 실행에서 깨지고**
올바른 코드가 타입 오류로 막힌다. 피하려면 호출마다 캐스팅을 넣어야 한다.
그래서 봉투만 벗기고 형태는 그대로 두며, 엔드포인트 함수가 `.data` 로 꺼내 화면에 넘긴다.

```ts
// src/api/auth.ts — 화면은 instance 를 직접 쓰지 않고 이 함수만 쓴다
export async function login(body: LoginRequest, signal?: AbortSignal): Promise<TokenPair> {
  const response = await instance.post<TokenPair>('/api/auth/login', body, { signal })
  return response.data
}
```

화면에서 쓰는 모습은 `const tokens = await login(...)` 로 동일하다. 차이는 통신 계층 안에만 있다.

**`_retried` 플래그는 axios 모듈 확장이 필요하다.** `InternalAxiosRequestConfig`(인터셉터가 받는 타입)와
`AxiosRequestConfig`(`client.request()` 에 넘기는 타입) **두 곳 모두**에 선언해야 한다 (`src/api/axios.d.ts`).
재시도에 `client(config)` 대신 `client.request(config)` 를 쓰는 이유는, 인스턴스 호출 시그니처가
`(url, config)` 와 `(config)` 두 가지라 객체 리터럴이 `url` 쪽 오버로드와 대조되어 타입 오류가 나기 때문이다.

**재발급 실패 시 로그아웃 전달 방식.** 인터셉터는 `clearTokens()` 만 호출한다. `tokenStorage` 가 변경을 구독자에게 알리고, `useAccessToken`(`useSyncExternalStore`)이 이를 받아 `AuthContext` 의 `AuthStatus` 를 `anonymous` 로 바꿔 가드가 `/login` 으로 보낸다.
이 방식을 쓰는 이유는 **`api/` 가 `store/AuthContext` 를 import 하면 순환 참조가 생기기 때문**이다(`AuthContext → api/auth → instance → interceptors → AuthContext`). `tokenStorage` 는 아무것도 import 하지 않는 끝점이라 양쪽이 안전하게 참조할 수 있다.

로그인 API 의 401 은 폼에서 처리하고, 재발급 API 의 401 은 위 `catch` 에서 로그아웃으로 처리된다.

**요청 취소.** 엔드포인트 함수는 선택적 `signal?: AbortSignal` 을 받아 axios 에 넘긴다. 화면을 벗어나면 진행 중인 요청을 취소하고, 취소는 정규화 단계에서 오류로 바꾸지 않아 사용자에게 에러가 보이지 않는다. 화면에서는 `useAbortableRequest` 훅으로 감싸 쓴다.

**`refreshing` 변수 = 재발급 single-flight (중요).** refresh token 은 재발급마다 **회전**(이전 토큰 즉시 폐기)하므로,
동시에 401 을 받은 요청들이 각자 재발급하면 뒤늦은 쪽이 이미 폐기된 토큰을 써서 **사용자가 로그아웃된다.**
`refreshing` 에 진행 중인 Promise 를 담아 **재발급은 1회만 호출하고 나머지 요청은 그 결과를 함께 기다린다.**
챗 화면 진입(`/auth/me` + `/me/chats`)이나 관리자 화면(stats + users)처럼 한 화면에서 API 를 2개 이상 호출할 때 실제로 발생한다.
근거·대안·한계: [12-decisions.md 15. 토큰 재발급 동시성 — single-flight](12-decisions.md#15-토큰-재발급-동시성--single-flight) · 검증: [07-verification.md](07-verification.md) B17c

## 5. 결과 코드별 사용자 메시지

화면 문구는 서버의 `data.message` 를 그대로 쓴다. **사용자 화면에는 결과 코드·구분 이름을 표시하지 않는다** (2026-09-29 결정 — 사용자에게 필요 없는 정보). 아래 구분 이름은 개발·테스트용 표기이며, 관리자 화면의 기록(원인 추적용)에만 `504 · AI_TIMEOUT` 처럼 보인다.

| code | 구분(표기용) | 화면 표시 | 위치 |
|------|--------------|-----------|------|
| 422 | `VALIDATION_ERROR` | `data.message` (예: "질문은 1~1000자로 입력해 주세요.") | 폼 알림 / 오류 말풍선 |
| 409 | `EMAIL_ALREADY_EXISTS` | "이미 가입된 이메일입니다." | 회원가입 폼 |
| 401 (로그인 API) | `INVALID_CREDENTIALS` | "이메일 또는 비밀번호가 올바르지 않습니다." | 로그인 폼 |
| 401 (그 외) | `UNAUTHORIZED` | 먼저 refresh 로 재발급 후 재시도(사용자에게 안 보임). 재발급도 401 이면 로그인 화면으로 이동 (+ "다시 로그인해 주세요") | 전역 |
| 403 | `FORBIDDEN` | "관리자만 접근할 수 있습니다." | 관리자 화면 안내 박스 (주소 접근은 404 화면 — 화면 5) |
| 404 | `NOT_FOUND` | "요청한 정보를 찾을 수 없습니다." | 관리자 화면 |
| 504 | `AI_TIMEOUT` | "현재 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요." | 오류 말풍선 + [다시 시도] |
| 502 | `AI_CALL_FAILED` | "AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." | 오류 말풍선 + [다시 시도] |
| 500 | `INTERNAL_ERROR` | "서버 내부 오류가 발생했습니다." | 오류 말풍선 |
| (봉투 없음) | `NETWORK_ERROR` | "서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요." | 오류 말풍선 |

## 6. 오류 메시지 원칙

1. **무슨 일이 일어났는지 + 사용자가 할 일**을 한 문장으로 ("지연되고 있어요. 잠시 후 다시 시도해 주세요.")
2. **사용자 화면은 문장만.** 기술 코드는 표시하지 않는다. 평가자·운영자는 관리자 화면의 기록과 서버 로그에서 코드로 추적한다
3. 로그인 실패는 이메일/비밀번호 중 무엇이 틀렸는지 알리지 않음 (보안)
4. 빨강 대신 채도 낮은 주황 → 다크 톤 분위기 유지, 공포감 완화

## 7. 반응형

| 폭 | 레이아웃 |
|----|----------|
| ≥ 900px | 본문 최대 폭 안에서 2단(챗 + 보조 영역 / 관리자 목록 + 대화) 배치 |
| < 900px | 단일 열, 보조 영역은 아래로 |
| ≤ 560px | 헤더: 브랜드 1줄, 탭/사용자 2줄. 챗 높이 = 화면 - 220px. **가로 스크롤 0** |

## 8. 참고: 시안에 있으나 스펙 범위 밖인 요소

`docs/design/*.html`(시안)에는 아래 요소가 보인다. **현재 [features.md](features.md) / [03-api.md](03-api.md) 범위에는 없다.** 구현하려면 별도 API 가 필요하므로 팀 합의 후 추가한다.

| 요소 | 필요한 것 |
|------|-----------|
| "응답 시뮬레이션" 패널 (AI_TIMEOUT / AI_CALL_FAILED 강제 발생) | `POST /api/chat` 에 데모 전용 파라미터 + 서버 플래그 |
| 챗 화면 "서버 로그" 패널 (본인 요청 이벤트 실시간 표시) | `GET /api/me/server-logs` 같은 조회 API (관리자 요청 흐름 화면으로 대체 가능) |
| 헤더 연결 상태 점 (`/api/health`) | `GET /api/health` 엔드포인트 |

## 9. SEO · 접근성

### SEO

| 항목 | 규칙 |
|------|------|
| 화면 제목 | `로그인 · Chatlog` 형식 (`usePageMeta`). SPA 는 `<title>` 하나를 공유해 화면마다 바꿔야 탭·방문 기록·검색 결과에서 구분된다 |
| 검색 허용 | 로그인 · 회원가입 |
| 검색 제외 | 챗 · 내 대화 로그 · 관리자 · 404 — 화면마다 `<meta name="robots" content="noindex, nofollow">` |
| robots.txt | 빌드 때 생성. `User-agent: *` · `Allow: /`. **관리자 주소를 `Disallow` 로 적지 않는다** — robots.txt 는 누구나 읽어 숨긴 주소가 드러난다. 막는 것은 화면별 noindex 가 맡는다 |
| sitemap.xml | 빌드 때 `VITE_SITE_URL` 이 있으면 생성 (공개 화면만). robots.txt 에 `Sitemap:` 줄 추가 |
| canonical · og:url | 공개 화면에만, `VITE_SITE_URL` + 경로 (쿼리는 뺀다). 화면이 뜬 뒤 `usePageMeta` 가 바꾼다 |
| 메타데이터 | description, Open Graph(type·site_name·title·description·locale), Twitter 카드(`summary_large_image`) — 검색 결과 설명과 메신저 링크 미리보기 |
| 링크 미리보기 이미지 | `public/og-image.png`(1200×630). 미리보기 로봇은 JavaScript 를 실행하지 않고 절대 주소만 읽으므로, 빌드 때 `VITE_SITE_URL` 로 `og:url`(첫 화면)·`og:image`·`og:image:type/width/height/alt` 를 index.html 에 넣는다. 주소가 없으면 넣지 않는다 (#89) |
| JS 꺼짐 | `<noscript>` 안내 |

### 접근성

| 항목 | 규칙 |
|------|------|
| 본문 바로가기 | 화면 맨 앞 링크, Tab 으로 초점을 받으면 나타난다. `main#main` 으로 이동 |
| 제목 구조 | 화면마다 `h1` 하나(챗은 스크린리더용으로 숨김), 영역 제목은 `h2` |
| 랜드마크 | `header`(헤더) · `nav`(주 메뉴·계정 메뉴) · `main` |
| 알림 | 토스트 알림 영역(`aria-live=polite`)은 비어 있어도 늘 둔다. 정보 토스트는 그 영역이 읽고, 오류만 `role="alert"` |
| 탭 | 관리자 탭은 WAI-ARIA 탭 패턴 — 탭·패널 연결, 선택된 탭만 Tab 순서, 방향키·Home·End 이동 |
| 아이콘 버튼 | 글자 없이 아이콘만, 이름은 `aria-label`·툴팁. 아이콘은 `aria-hidden` |
| 포커스 | 키보드 이동 시 청록 링 (1절), 입력칸은 클릭해도 표시 |

