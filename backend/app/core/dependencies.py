"""인증·권한 의존성 (02-architecture).

라우터는 Depends(get_current_user) 로 받은 user.id 만 사용하고, 클라이언트가 보낸 user_id 는 쓰지 않는다.
"""

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import crud
from app.core.logging import log_event, new_request_id
from app.core.responses import AppError
from app.core.security import decode_access_token
from app.database import get_db
from app.models import User

# auto_error=False: 헤더가 없을 때 FastAPI 기본 403 대신 우리 봉투 401 을 준다. Swagger Authorize 버튼도 생긴다.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    # bearer_scheme 이 Authorization 헤더를 읽어 scheme('Bearer')과 credentials(토큰)로 나눠 준다
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Authorization: Bearer <access_token> 을 검증해 현재 사용자를 반환한다. 실패는 모두 code:401.

    사용 예) def my_chats(user: User = Depends(get_current_user)): ... user.id 만 사용
    """
    # ① 헤더 없음 / Bearer 방식이 아님
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(401)
    # ② 토큰 만료·위조·형식 오류
    public_id = decode_access_token(credentials.credentials)
    if public_id is None:
        raise AppError(401)
    # ③ 토큰은 유효하지만 사용자가 DB 에 없음 (삭제된 계정, 이전 형식인 정수 sub 토큰 등)
    user = crud.user.get_by_public_id(db, public_id)
    if user is None:
        raise AppError(401)
    return user


# 관리자 API 에 사용: Depends(require_admin) → 먼저 get_current_user 로 로그인(401)을, 그다음 role(403)을 검사
def require_admin(request: Request, user: User = Depends(get_current_user)) -> User:
    """토큰에 role 을 넣지 않고 매 요청 DB 의 role 로 확인한다 → 권한 회수가 즉시 반영된다.

    관리자 API 는 모든 사용자의 대화를 볼 수 있으므로, 호출할 때마다 감사 로그를 남긴다 (03-api 6절):
    누가 어느 주소를 봤는지(admin_access), 일반 사용자가 들어오려 했는지(admin_forbidden).
    """
    request_id = new_request_id()
    path = request.url.path
    if user.role != "admin":
        log_event(request_id, "admin_forbidden", "WARN", user.id, path=path)
        raise AppError(403)
    log_event(request_id, "admin_access", user_id=user.id, admin_id=user.id, path=path)
    return user
