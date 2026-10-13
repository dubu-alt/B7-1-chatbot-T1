"""내 대화 로그 API — /api/me/* (03-api)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import crud
from app.core.dependencies import get_current_user
from app.core.responses import ok
from app.core.timeutil import to_kst_iso
from app.database import get_db
from app.models import User

# 이 파일의 모든 경로 앞에 /api/me 가 붙는다 (로그인한 '나' 기준 API)
router = APIRouter(prefix="/api/me", tags=["me"])

# 한 번에 조회할 수 있는 최대 개수 (03-api) — 큰 값으로 DB·응답이 무거워지는 것을 막는다
MAX_LIMIT = 100


@router.get("/chats")
def my_chats(
    limit: int = Query(20, ge=1),  # ?limit= 기본 20, 1 미만이면 자동 422
    offset: int = Query(0, ge=0),  # ?offset= 기본 0, 음수면 자동 422
    user: User = Depends(get_current_user),  # 토큰 검증 → 실패 시 401, 성공 시 현재 사용자
    db: Session = Depends(get_db),
):
    """토큰의 사용자 기준 **성공** 기록만 최신순으로 반환한다. 다른 사용자 기록은 조회할 방법이 없다."""
    limit = min(limit, MAX_LIMIT)  # 100 초과 요청은 오류 대신 100 으로 제한
    # user.id(토큰의 사용자)로만 조회 → 쿼리 파라미터 등으로 다른 사용자 id 를 넘길 방법 자체가 없다
    items = crud.chat_log.list_success_for_user(db, user.id, limit=limit, offset=offset)
    return ok(
        {
            "total": crud.chat_log.count_success_for_user(db, user.id),  # 페이지와 무관한 전체 성공 기록 수 (더 보기 판단용)
            "items": [
                {
                    "chat_id": c.public_id,  # 정수 id 는 서비스 전체 대화 수를 드러내므로 UUID 로 내보냄
                    "question": c.question,
                    "answer": c.answer,
                    "created_at": to_kst_iso(c.created_at),  # +09:00 ISO 문자열
                }
                for c in items
            ],
        }
    )
