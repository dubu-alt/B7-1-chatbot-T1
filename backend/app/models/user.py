from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.timeutil import utcnow
from app.database import Base


class User(Base):
    """사용자 계정 (04-database users)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # 내부 전용. 다른 테이블의 FK 가 이 값을 가리킨다
    # JWT payload 의 sub 에 담기는 바깥용 식별자. 순차 정수 id 를 내보내면 가입 순서·전체 가입자 수를 유추할 수 있어 무작위 UUID 를 쓴다
    # unique+index → UNIQUE INDEX ix_users_public_id (기존 DB 는 database.add_user_public_id 가 같은 이름으로 만든다)
    public_id: Mapped[str] = mapped_column(Text, unique=True, index=True, default=lambda: str(uuid4()))
    # 로그인 ID. unique+index → UNIQUE INDEX ix_users_email (중복 가입 방지 + 로그인 조회 속도)
    email: Mapped[str] = mapped_column(Text, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(Text)  # bcrypt 해시 ($2b$..., 60자). 평문 저장 금지
    nickname: Mapped[str] = mapped_column(Text)  # 화면 표시용 이름. 중복 허용이라 UNIQUE 없음
    # 권한. DB 가 'user'/'admin' 외 값을 거부(CHECK)하고, 값을 안 주면 'user'
    # server_default: DB 레벨 기본값(DDL 에 DEFAULT 'user') / default: 파이썬에서 객체를 만들 때 기본값
    role: Mapped[str] = mapped_column(
        Text, CheckConstraint("role IN ('user', 'admin')"), server_default=text("'user'"), default="user"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)  # 가입 시각 (naive UTC)
