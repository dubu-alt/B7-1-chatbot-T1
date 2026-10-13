"""내 대화 로그 API 테스트 — 07-verification V09, V18, V19."""

from app import crud
from tests.conftest import auth_header, login, signup


def _user(client, db, email):
    """가입·로그인까지 마친 사용자 객체와 Authorization 헤더를 반환하는 헬퍼."""
    signup(client, email=email)
    token = login(client, email=email)["data"]["access_token"]
    return crud.user.get_by_email(db, email), auth_header(token)


def _chat(db, user_id, n, status="success"):
    """AI 호출 없이 CRUD 로 대화 기록을 직접 넣는 헬퍼. n 으로 질문을 구분하고, 실패면 answer 없이 AI_TIMEOUT."""
    return crud.chat_log.create(
        db,
        user_id=user_id,
        question=f"질문 {n}",
        answer=f"답변 {n}" if status == "success" else None,
        status=status,
        error_code=None if status == "success" else "AI_TIMEOUT",
        latency_ms=100,
        request_id=f"req{n}",
    )


def test_v09_requires_login(client):
    """토큰 없이 조회 → 401"""
    assert client.get("/api/me/chats").json()["code"] == 401


def test_v18_only_my_success_chats(client, db):
    """내 성공 기록만 보이고, 다른 사용자 기록과 내 실패 기록은 보이지 않는다"""
    alice, alice_h = _user(client, db, "alice@example.com")
    bob, bob_h = _user(client, db, "bob@example.com")
    _chat(db, alice.id, 1)
    _chat(db, bob.id, 2)
    _chat(db, alice.id, 3, status="error")

    body = client.get("/api/me/chats", headers=alice_h).json()
    assert body["code"] == 200
    assert body["data"]["total"] == 1
    assert [i["question"] for i in body["data"]["items"]] == ["질문 1"]
    assert set(body["data"]["items"][0]) == {"chat_id", "question", "answer", "created_at"}

    # chat_id 는 정수 DB id 가 아니라 그 대화의 public_id(UUID)
    assert body["data"]["items"][0]["chat_id"] == crud.chat_log.list_success_for_user(db, alice.id, 1, 0)[0].public_id

    bob_items = client.get("/api/me/chats", headers=bob_h).json()["data"]["items"]
    assert [i["question"] for i in bob_items] == ["질문 2"]


def test_v19_pagination_and_order(client, db):
    """최신순 정렬, limit·offset 페이지 이동, 기본 20개, 101 요청 시 100개로 제한, 범위 오류 422"""
    user, h = _user(client, db, "user@example.com")
    for n in range(1, 106):
        _chat(db, user.id, n)
    _chat(db, user.id, 999, status="error")

    first = client.get("/api/me/chats?limit=2&offset=0", headers=h).json()["data"]
    assert first["total"] == 105
    assert [i["question"] for i in first["items"]] == ["질문 105", "질문 104"]

    second = client.get("/api/me/chats?limit=2&offset=2", headers=h).json()["data"]
    assert [i["question"] for i in second["items"]] == ["질문 103", "질문 102"]

    default = client.get("/api/me/chats", headers=h).json()["data"]
    assert len(default["items"]) == 20

    capped = client.get("/api/me/chats?limit=101", headers=h).json()["data"]
    assert len(capped["items"]) == 100

    assert client.get("/api/me/chats?limit=0", headers=h).json()["code"] == 422
    assert client.get("/api/me/chats?offset=-1", headers=h).json()["code"] == 422


def test_context_query_oldest_first(client, db):
    """챗 트랙용 컨텍스트 조회: 최근 성공 5개를 오래된 순으로 반환, 실패 기록 제외"""
    user, _ = _user(client, db, "user@example.com")
    for n in range(1, 8):
        _chat(db, user.id, n)
    _chat(db, user.id, 8, status="error")
    rows = crud.chat_log.recent_success_for_context(db, user.id, 5)
    assert [r.question for r in rows] == ["질문 3", "질문 4", "질문 5", "질문 6", "질문 7"]
