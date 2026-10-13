"""SQLAlchemy 엔진·세션·Base 와 get_db 의존성."""

from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings


class Base(DeclarativeBase):
    """모든 모델(User, ChatLog …)이 상속하는 부모 클래스. Base.metadata 에 테이블 정의가 모인다."""

    pass


def _ensure_sqlite_dir(url: str) -> None:
    """sqlite 파일 경로의 상위 폴더(./data, Railway /data)가 없으면 만든다."""
    parsed = make_url(url)  # 문자열 URL 을 드라이버·DB 경로 등으로 분해
    # 파일 DB 일 때만 폴더를 만든다 (메모리 DB ':memory:' 는 파일이 없으므로 제외)
    if parsed.get_backend_name() == "sqlite" and parsed.database not in (None, "", ":memory:"):
        Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)  # 이미 있으면 그냥 넘어감


def build_engine(url: str):
    """DB URL 로 SQLAlchemy 엔진(연결 관리자)을 만든다. SQLite 일 때만 필요한 설정을 추가한다."""
    connect_args = {}
    if url.startswith("sqlite"):
        _ensure_sqlite_dir(url)
        # FastAPI 는 요청을 여러 스레드에서 처리하므로 같은 연결 공유를 허용
        connect_args["check_same_thread"] = False
    engine_options = {}
    if url.startswith("sqlite") and make_url(url).database not in (None, "", ":memory:"):
        # 파일 DB 는 연결을 모아 두는 풀 없이 필요할 때마다 열고 닫는다 (NullPool).
        # 기본 풀은 연결을 최대 15개까지만 만든다. 챗 요청은 AI 응답을 기다리는 동안 연결을 잡고 있어서
        # 동시 요청 15건이면 풀이 바닥나고, 이어서 서버 로그 저장이 연결을 기다리며 이벤트 루프를 막아
        # 서버 전체가 멈췄다. SQLite 는 파일을 여는 것이라 연결 비용이 작아 풀 없이도 충분하다.
        # (메모리 DB 는 연결마다 다른 DB 가 되므로 제외. PostgreSQL 등으로 바꾸면 풀을 다시 쓴다)
        engine_options["poolclass"] = NullPool
    eng = create_engine(url, connect_args=connect_args, **engine_options)

    if url.startswith("sqlite"):
        # SQLite 는 FK 제약이 기본 비활성 → 연결마다 활성화 (04-database)
        # 새 DB 연결이 만들어질 때마다 아래 함수가 자동 실행된다
        @event.listens_for(eng, "connect")
        def _fk_on(dbapi_conn, _):
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

    return eng


def add_public_id(eng: Engine, table: str) -> None:
    """public_id 가 없던 기존 DB 의 테이블(users, chat_logs)을 맞춘다. 서버 시작 때마다 실행해도 결과가 같다.

    create_all 은 이미 있는 테이블에 컬럼을 추가하지 않으므로 Railway 의 기존 app.db 는 직접 고쳐야 한다.
    ① 컬럼이 없으면 추가 ② 비어 있는 행마다 UUID 채우기 ③ UNIQUE INDEX 생성 (모델과 같은 이름 → 새 DB 에서는 아무 일도 안 함)
    SQLite 는 기존 테이블에 NOT NULL 컬럼을 기본값 없이 추가할 수 없어 컬럼 자체는 NULL 허용으로 남지만,
    ②에서 모두 채우고 새 행은 모델 기본값(uuid4)으로 항상 채워진다.
    table 은 코드에 적힌 테이블 이름만 받는다 (SQL 에 그대로 들어가므로 사용자 입력을 넘기지 않는다).
    """
    with eng.begin() as conn:
        if "public_id" not in {col["name"] for col in inspect(conn).get_columns(table)}:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN public_id TEXT"))
        for row_id in conn.scalars(text(f"SELECT id FROM {table} WHERE public_id IS NULL")).all():
            conn.execute(text(f"UPDATE {table} SET public_id = :p WHERE id = :i"), {"p": str(uuid4()), "i": row_id})
        conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS ix_{table}_public_id ON {table} (public_id)"))


# 앱 전체에서 공유하는 엔진 1개 (import 시점에 DATABASE_URL 로 생성)
engine = build_engine(settings.database_url)

# 세션(=DB 작업 단위)을 찍어내는 공장
# - autoflush=False: 조회할 때마다 변경사항을 자동으로 DB 에 보내지 않음 (commit·flush 시점을 코드에서 명확히)
# - expire_on_commit=False: commit 후에도 객체 속성을 다시 조회하지 않고 바로 읽을 수 있게 함 (응답 만들 때 편의)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """요청마다 세션을 하나 열어 라우터에 넘기고, 응답이 끝나면 반드시 닫는다.

    사용 예) def signup(body: SignupRequest, db: Session = Depends(get_db)): ...
    """
    db = SessionLocal()
    try:
        yield db  # 라우터 함수가 실행되는 동안 이 세션을 사용
    finally:
        db.close()  # 오류가 나도 연결을 닫는다(풀을 쓰는 DB 면 풀에 돌려준다)
