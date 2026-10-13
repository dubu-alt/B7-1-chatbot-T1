from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.timeutil import utcnow
from app.database import Base


class ChatLog(Base):
    """질문·AI 응답 기록 (04-database chat_logs). AI 실패 요청도 status='error' 로 저장한다."""

    __tablename__ = "chat_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # 내부·관리자 API 용 대화 번호 (관리자 응답의 chat_id)
    # 일반 사용자 API 의 chat_id. 전체 공통 순차 id 를 내보내면 서비스 전체 대화 수·이용량을 유추할 수 있어 무작위 UUID 를 쓴다
    # unique+index → UNIQUE INDEX ix_chat_logs_public_id (기존 DB 는 database.add_public_id 가 같은 이름으로 만든다)
    public_id: Mapped[str] = mapped_column(Text, unique=True, index=True, default=lambda: str(uuid4()))
    # 사용자 식별 (필수 추적 필드). 사용자가 삭제되면 대화도 함께 삭제(CASCADE)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question: Mapped[str] = mapped_column(Text)  # 질문 (필수 추적 필드), 앞뒤 공백 제거 후 저장
    answer: Mapped[str | None] = mapped_column(Text)  # AI 응답 (필수 추적 필드). 실패면 NULL → str | None 이 NULL 허용을 뜻함
    # 처리 결과 'success' / 'error'. 내 로그·컨텍스트 조회가 status 로 거르므로 인덱스
    status: Mapped[str] = mapped_column(Text, CheckConstraint("status IN ('success', 'error')"), index=True)
    error_code: Mapped[str | None] = mapped_column(Text)  # 'AI_TIMEOUT' / 'AI_CALL_FAILED', 성공이면 NULL
    latency_ms: Mapped[int | None] = mapped_column(Integer)  # AI 호출 소요 시간(ms), 관리자 평균 응답시간 통계용
    request_id: Mapped[str] = mapped_column(Text, index=True)  # 요청 추적 ID — server_logs 와 연결
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)  # 생성 시각 (필수 추적 필드)
