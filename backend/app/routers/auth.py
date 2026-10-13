"""인증 API — /api/auth/* (03-api)."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.logging import log_event, new_request_id
from app.core.rate_limit import client_ip, login_fail_by_email, login_fail_by_ip, signup_limiter
from app.core.responses import AppError, ok
from app.core.timeutil import to_kst_iso
from app.database import get_db
from app.models import User
from app.schemas.auth import LoginRequest, RefreshTokenRequest, SignupRequest
from app.services import auth_service

# 이 파일의 모든 경로 앞에 /api/auth 가 붙는다. tags 는 Swagger(/docs) 화면의 그룹 이름
router = APIRouter(prefix="/api/auth", tags=["auth"])

# 라우터 함수는 ① 스키마로 요청 검증(실패 시 자동 422) ② 서비스 호출 ③ ok() 로 봉투 응답만 담당한다.
# 서비스가 raise 한 AppError(401·409 등)는 예외 핸들러가 봉투로 바꿔준다.


@router.post("/signup")
def signup(body: SignupRequest, request: Request, db: Session = Depends(get_db)):
    """회원가입. 성공 code:201 / 이메일 중복 409 / 입력 오류 422 / 횟수 초과 429"""
    # 409 로 가입 여부를 대량 확인하거나 계정을 대량으로 만드는 것을 막는다 (S09). 성공·실패 모두 센다
    if not signup_limiter.try_acquire(client_ip(request)):
        log_event(new_request_id(), "signup_rate_limited", "WARN", path="/api/auth/signup")
        raise AppError(429)
    user = auth_service.signup(db, body.email, body.password, body.nickname)
    # 응답에 hashed_password·id 는 넣지 않는다 (id 는 가입 순서·가입자 수를 드러냄). created_at 은 +09:00 문자열로 변환
    return ok({"email": user.email, "nickname": user.nickname, "created_at": to_kst_iso(user.created_at)}, code=201)


@router.post("/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """로그인. 성공 시 access·refresh token 발급 / 실패 401 / 실패가 많으면 429"""
    # 비밀번호를 바꿔 가며 계속 시도하는 공격을 막는다 (S02). 실패만 센다.
    # 이메일별: 한 계정 집중 공격 / IP 별: 한 곳에서 여러 계정을 돌아가며 시도. 둘 중 하나라도 넘으면 비밀번호가 맞아도 429
    ip = client_ip(request)
    by = "email" if login_fail_by_email.is_limited(body.email) else "ip" if login_fail_by_ip.is_limited(ip) else None
    if by:
        log_event(new_request_id(), "login_rate_limited", "WARN", path="/api/auth/login", by=by)
        raise AppError(429)
    try:
        tokens = auth_service.login(db, body.email, body.password)
    except AppError as exc:
        if exc.code == 401:
            login_fail_by_email.hit(body.email)
            login_fail_by_ip.hit(ip)
        raise
    login_fail_by_email.reset(body.email)  # 성공하면 그 이메일의 실패 횟수 초기화 (IP 횟수는 유지 — 다른 계정 공격과 섞이지 않게)
    return ok(tokens)


@router.post("/refresh")
def refresh(body: RefreshTokenRequest, db: Session = Depends(get_db)):
    """토큰 재발급(회전). 인증 헤더 없이 body 의 refresh token 으로만 처리 / 무효 401"""
    return ok(auth_service.refresh(db, body.refresh_token))


@router.post("/logout")
def logout(body: RefreshTokenRequest, db: Session = Depends(get_db)):
    """로그아웃. body 의 refresh token 행만 삭제(이 기기만). 이미 폐기된 토큰이어도 200"""
    auth_service.logout(db, body.refresh_token)
    return ok({})


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    """현재 로그인 사용자. 프론트가 새로고침 후 상태 복원·관리자 메뉴 표시 여부(role)에 사용 / 토큰 문제 401"""
    # id 는 내보내지 않는다 — 일반 사용자가 자기 DB id 를 알 수 없어야 한다
    return ok({"email": user.email, "nickname": user.nickname, "role": user.role})
