"""FastAPI 앱 진입점.

실행: uvicorn app.main:app --reload  (backend/ 에서)
"""

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (Base.metadata 에 테이블 등록)
from app.config import settings
from app.core.body_limit import BodySizeLimitMiddleware
from app.core.logging import setup_logging
from app.core.responses import register_exception_handlers
from app.database import Base, SessionLocal, add_public_id, engine
from app.routers import admin, auth, chat, me
from app.services import ai_service, auth_service

logger = logging.getLogger("app")

# JWT 서명 키 최소 길이(바이트) — 이보다 짧으면 서버 시작 거부 (S05)
JWT_SECRET_KEY_MIN_BYTES = 32

# 만료 refresh token 정리 주기: 24시간(초 단위) — A7-6 '하루 1회'
REFRESH_TOKEN_CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60


def _cleanup_expired_refresh_tokens() -> None:
    """만료 행 1회 삭제. 요청과 무관한 백그라운드 작업이라 get_db 대신 세션을 직접 열고 닫는다."""
    with SessionLocal() as db:
        deleted = auth_service.delete_expired_refresh_tokens(db)
    logger.info("refresh_token_cleanup deleted=%s", deleted)


async def _refresh_token_cleanup_loop() -> None:
    """시작 시 1회 + 이후 24시간마다 만료 refresh token 행 삭제 (A7-6)."""
    while True:
        try:
            # DB 작업은 동기 코드라 별도 스레드에서 실행 → 이벤트 루프(다른 요청 처리)를 막지 않는다
            await asyncio.to_thread(_cleanup_expired_refresh_tokens)
        except Exception:
            # 정리에 실패해도 서버는 계속 동작해야 하므로 로그만 남기고 다음 주기에 다시 시도
            logger.exception("refresh_token_cleanup_failed")
        await asyncio.sleep(REFRESH_TOKEN_CLEANUP_INTERVAL_SECONDS)  # 24시간 대기 (대기 중에는 CPU 를 쓰지 않음)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """서버 시작 시 yield 앞부분, 종료 시 yield 뒷부분이 한 번씩 실행된다."""
    # 콘솔·파일(logs/app.log) 로그 출력 설정 — 아래 시작 작업의 로그부터 적용된다
    setup_logging()
    # 서명 키 없이 뜨면 빈 키로 토큰이 발급되는 보안 사고가 나므로 기동 자체를 막는다
    if not settings.jwt_secret_key:
        raise RuntimeError("JWT_SECRET_KEY 가 설정되지 않았습니다. backend/.env 또는 Railway Variables 를 확인하세요.")
    # 짧은 키는 추측·대입으로 알아낼 수 있고, 키를 알면 관리자 id 로 토큰을 위조할 수 있으므로 기동을 막는다 (S05).
    # 32바이트(256비트)는 서명 알고리즘 HS256 의 해시 길이와 같아 권장되는 최소 길이다
    if len(settings.jwt_secret_key.encode()) < JWT_SECRET_KEY_MIN_BYTES:
        raise RuntimeError(
            f"JWT_SECRET_KEY 가 {JWT_SECRET_KEY_MIN_BYTES}바이트보다 짧습니다. "
            'python -c "import secrets;print(secrets.token_urlsafe(48))" 로 만든 값을 넣으세요.'
        )
    # 모델 정의대로 테이블 생성 (이미 있는 테이블은 건드리지 않음)
    Base.metadata.create_all(bind=engine)
    # 기존 DB 에 public_id 추가·채우기 — JWT sub(users)와 일반 사용자 API 의 chat_id(chat_logs)를 정수 id 대신 UUID 로
    add_public_id(engine, "users")
    add_public_id(engine, "chat_logs")
    # ADMIN_EMAIL 관리자 계정 생성 또는 승격
    with SessionLocal() as db:
        auth_service.ensure_admin(db)
    # 만료 토큰 정리 루프를 백그라운드로 시작 (시작 직후 1회 실행 후 24시간마다)
    cleanup_task = asyncio.create_task(_refresh_token_cleanup_loop())
    yield  # ── 여기서부터 서버가 요청을 받는다 ──
    # 서버 종료: 정리 루프를 취소하고 끝날 때까지 기다린다 (취소 예외는 정상 종료라 무시)
    cleanup_task.cancel()
    with suppress(asyncio.CancelledError):
        await cleanup_task
    # AI 호출용 공용 클라이언트의 열린 연결을 닫는다
    await ai_service.close_client()


# 앱 생성. title·version 은 Swagger(/docs) 화면에 표시된다.
# API 문서 화면은 ENABLE_DOCS=true 일 때만 연다 — 운영에서 관리자 API 를 포함한 전체 목록이 보이지 않게 (S03).
# 끄면 세 경로 모두 404 이고, 제출용 API 명세는 docs/03-api.md 다.
_docs_off = {} if settings.enable_docs else {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(title="Chatlog API", version="0.1.0", lifespan=lifespan, **_docs_off)

# 모든 오류 응답을 {code, data:{message}} 봉투 형식으로 바꾸는 예외 핸들러 등록 (app/core/responses.py)
register_exception_handlers(app)

# 요청 본문이 MAX_BODY_BYTES(기본 64KB)를 넘으면 더 읽지 않고 413 (S04)
app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)

# 프론트·백엔드가 Railway 에서 서로 다른 도메인이므로 CORS 필수
# JWT 를 Authorization 헤더로 보내므로 쿠키(credentials)는 쓰지 않는다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # CORS_ORIGINS 에 등록된 Origin 만 허용 ("*" 전체 허용은 쓰지 않음)
    allow_credentials=False,  # 쿠키·인증정보 자동 전송 안 함
    allow_methods=["GET", "POST", "OPTIONS"],  # 우리 API 가 쓰는 메서드 + preflight(OPTIONS)
    allow_headers=["Authorization", "Content-Type"],  # 토큰 헤더와 JSON 본문 헤더만 허용
)

# 라우터 등록 — 각 파일의 경로(/api/auth/*, /api/chat, /api/me/*, /api/admin/*)를 앱에 연결
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(me.router)
app.include_router(admin.router)
