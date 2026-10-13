from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ChatLog, User


def get(db: Session, user_id: int) -> User | None:
    """PK 로 사용자 1명 조회. 없으면 None."""
    return db.get(User, user_id)


def get_by_public_id(db: Session, public_id: str) -> User | None:
    """public_id 로 사용자 1명 조회. 없으면 None (토큰의 sub → 사용자)."""
    return db.scalar(select(User).where(User.public_id == public_id))


def get_by_email(db: Session, email: str) -> User | None:
    """이메일로 사용자 조회. 로그인·가입 중복 검사·관리자 시드에서 사용."""
    return db.scalar(select(User).where(User.email == email))


def create(
    db: Session, email: str, hashed_password: str, nickname: str, role: str = "user", commit: bool = True
) -> User:
    """사용자 생성. 비밀번호는 호출하는 쪽에서 해시한 값을 넘긴다 (CRUD 는 평문을 다루지 않음)."""
    user = User(email=email, hashed_password=hashed_password, nickname=nickname, role=role)
    db.add(user)
    if commit:
        db.commit()
        db.refresh(user)  # DB 가 채운 id·created_at 을 객체에 반영
    else:
        db.flush()  # commit 없이 INSERT 만 보내 id 를 받아 둔다 (호출한 쪽이 나중에 commit)
    return user


# ---------- 관리자 조회 (03-api 4-2) ----------
def _email_filter(q: str | None):
    """이메일 부분 검색 조건. 가입 시 이메일을 소문자로 저장하므로 검색어도 소문자로 맞춘다.

    autoescape=True: 검색어의 % _ 를 SQL 와일드카드가 아닌 글자 그대로 찾는다.
    """
    q = (q or "").strip().lower()
    return User.email.contains(q, autoescape=True) if q else True


def count(db: Session, q: str | None = None) -> int:
    """관리자 사용자 목록 total — 검색 조건에 맞는 사용자 수."""
    return db.scalar(select(func.count()).select_from(User).where(_email_filter(q))) or 0


def list_with_stats(db: Session, q: str | None, limit: int, offset: int) -> list[tuple[User, int, object]]:
    """사용자와 (전체 대화 수, 마지막 대화 시각)을 최근 활동 순으로 반환한다.

    - 대화 수는 성공 + 실패 전체 (사용자별 대화 기록의 total 과 같은 기준)
    - 대화가 없는 사용자도 보이도록 outer join, 이때 마지막 대화 시각은 NULL
    - 정렬: 마지막 대화 최신순 → 대화가 없는 사용자는 뒤에서 최근 가입 순
      (SQLite 는 내림차순에서 NULL 을 맨 뒤에 둔다)
    """
    last_chat_at = func.max(ChatLog.created_at)
    rows = db.execute(
        select(User, func.count(ChatLog.id), last_chat_at)
        .outerjoin(ChatLog, ChatLog.user_id == User.id)
        .where(_email_filter(q))
        .group_by(User.id)
        .order_by(last_chat_at.desc(), User.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [tuple(row) for row in rows]
