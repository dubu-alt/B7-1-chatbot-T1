"""비밀번호 해시와 토큰 유틸 (02-architecture, 12-decisions)."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings

# bcrypt 는 앞 72바이트만 사용한다. bcrypt 5.x 는 초과 입력에 예외를 내므로 해시·검증 모두 같은 규칙으로 자른다.
_BCRYPT_MAX_BYTES = 72


def _pw_bytes(password: str) -> bytes:
    """비밀번호 문자열을 UTF-8 바이트로 바꾸고 bcrypt 한도(72바이트)까지만 자른다. 한글은 1자=3바이트."""
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """비밀번호 → bcrypt 해시 문자열. gensalt() 가 매번 새 salt 를 만들어 같은 비밀번호도 해시가 달라진다."""
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, hashed_password: str) -> bool:
    """입력 비밀번호가 저장된 해시와 일치하는지 확인한다. 해시 형식이 깨져 있으면 예외 대신 False."""
    try:
        return bcrypt.checkpw(_pw_bytes(password), hashed_password.encode("ascii"))
    except ValueError:
        return False


# 없는 이메일로 로그인할 때도 bcrypt 비교를 한 번 수행해 응답 시간으로 계정 존재를 추측하지 못하게 한다.
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def create_access_token(public_id: str) -> str:
    """사용자의 public_id 로 access token(JWT) 을 만든다. 서버는 이 토큰을 저장하지 않는다.

    토큰은 브라우저에 저장돼 누구나 디코드할 수 있으므로 정수 users.id 대신 public_id(UUID)를 넣는다.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": public_id,  # role 은 넣지 않는다 — 권한은 매 요청 DB 로 확인
        "iat": now,  # 발급 시각
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),  # 만료 시각 — 지나면 decode 가 실패한다
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """유효하면 사용자의 public_id, 만료·서명 오류·형식 오류면 None."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],  # alg 혼동 공격 방지 — 허용 알고리즘 고정
            options={"require": ["exp", "sub"]},  # 만료 시각·사용자 식별자(public_id)가 없는 토큰은 거부
        )
        return payload["sub"]
    except jwt.PyJWTError:
        # 만료(ExpiredSignatureError)·서명 불일치·형식 오류·sub 가 문자열이 아님 → 모두 '인증 실패' 로 동일 처리
        return None


def new_refresh_token() -> str:
    """384비트 무작위 문자열. 원문은 클라이언트에만 주고 DB 에는 해시만 저장한다."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """refresh token 원문 → SHA-256 16진 문자열(64자).

    비밀번호와 달리 384비트 무작위 값이라 추측이 불가능해 느린 bcrypt 가 필요 없고,
    같은 입력이면 같은 해시가 나와 DB 에서 인덱스로 바로 찾을 수 있다.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
