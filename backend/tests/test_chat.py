"""챗 API 테스트 — 07-verification V09~V17, 서버 로그 V20·V21.

실제 AI 서버는 부르지 않는다. httpx.MockTransport 로 AI 서버 역할을 하는 가짜 응답을 끼워 넣고,
우리 서버가 AI 에게 무엇을 보냈는지(payload)도 함께 검사한다.
"""

import asyncio
import json
import sqlite3
import threading
import time
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app import crud
from app.config import settings
from app.database import engine
from app.models import ChatLog, ServerLog
from app.services import ai_service
from app.core.rate_limit import chat_limiter
from tests.conftest import PASSWORD, auth_header, login, signup


class FakeAI:
    """가짜 AI 서버. mode 로 성공·타임아웃·오류를 바꾸고, 받은 요청 body 를 requests 에 쌓는다."""

    def __init__(self):
        self.mode = "ok"
        self.requests: list[dict] = []

    async def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append({"body": body, "auth": request.headers.get("Authorization")})
        if self.mode == "timeout":
            raise httpx.ReadTimeout("timeout", request=request)
        if self.mode == "slow":
            await asyncio.sleep(1)  # 테스트에서는 상한을 0.1초로 줄여 둔다
        if self.mode == "connect_error":
            raise httpx.ConnectError("refused", request=request)
        if self.mode.startswith("http_"):
            return httpx.Response(int(self.mode[5:]), json={"error": "x"})
        if self.mode == "empty":
            return httpx.Response(200, json={"choices": [{"message": {"content": "  "}}]})
        question = body["messages"][-1]["content"]
        return httpx.Response(200, json={"choices": [{"message": {"content": f"답변: {question}"}}]})

    @property
    def last_messages(self) -> list[dict]:
        return self.requests[-1]["body"]["messages"]


@pytest.fixture()
def fake_ai(monkeypatch):
    """AI 클라이언트를 가짜 서버에 연결된 것으로 바꾸고, 테스트용 API 키를 넣는다."""
    fake = FakeAI()
    monkeypatch.setattr(settings, "copa_api_key", "test-ai-key")
    monkeypatch.setattr(ai_service, "_client", httpx.AsyncClient(transport=httpx.MockTransport(fake.handler)))
    return fake


@pytest.fixture()
def user_h(client):
    """가입·로그인을 마친 사용자의 Authorization 헤더."""
    signup(client)
    return auth_header(login(client)["data"]["access_token"])


def _ask(client, headers, message):
    return client.post("/api/chat", json={"message": message}, headers=headers).json()


def _all_logs(db):
    """저장된 대화 기록 전체를 id 순으로. API 가 다른 세션에서 저장한 값을 다시 읽도록 캐시를 먼저 비운다."""
    db.expire_all()
    return list(db.scalars(select(ChatLog).order_by(ChatLog.id)).all())


# ---------- 인증 ----------
def test_v09_requires_login(client, fake_ai):
    """토큰 없이 질문 → 401, AI 는 불리지 않는다"""
    assert client.post("/api/chat", json={"message": "안녕"}).json()["code"] == 401
    assert fake_ai.requests == []


# ---------- 성공 ----------
def test_v10_success_saved(client, db, fake_ai, user_h):
    """성공 응답 형식과 chat_logs 저장(status=success), 앞뒤 공백 제거, API 키는 서버에서만 사용"""
    res = _ask(client, user_h, "  FastAPI CORS 설정?  ")
    assert res["code"] == 200
    data = res["data"]
    assert set(data) == {"chat_id", "question", "answer", "created_at"}
    assert data["question"] == "FastAPI CORS 설정?"
    assert data["answer"] == "답변: FastAPI CORS 설정?"
    assert data["created_at"].endswith("+09:00")
    assert fake_ai.requests[-1]["auth"] == "Bearer test-ai-key"
    assert "test-ai-key" not in json.dumps(res)

    (log,) = _all_logs(db)
    assert (log.id, log.status, log.error_code) == (data["chat_id"], "success", None)
    assert len(log.request_id) == 12 and log.latency_ms is not None


# ---------- 컨텍스트 ----------
def test_v11_previous_turn_in_context(client, fake_ai, user_h):
    """두 번째 질문에는 직전 Q/A 가 user·assistant 순서로 함께 간다"""
    _ask(client, user_h, "첫 질문")
    _ask(client, user_h, "두 번째 질문")
    assert fake_ai.last_messages == [
        {"role": "user", "content": "첫 질문"},
        {"role": "assistant", "content": "답변: 첫 질문"},
        {"role": "user", "content": "두 번째 질문"},
    ]


def test_v12_context_limited_and_failures_excluded(client, fake_ai, user_h):
    """7번째 질문 → 최근 성공 5턴만 오래된 순으로, 실패 기록은 빠진다"""
    for i in range(1, 7):
        _ask(client, user_h, f"q{i}")
    fake_ai.mode = "http_500"
    _ask(client, user_h, "실패한 질문")
    fake_ai.mode = "ok"
    _ask(client, user_h, "q7")

    sent = [m["content"] for m in fake_ai.last_messages if m["role"] == "user"]
    assert sent == ["q2", "q3", "q4", "q5", "q6", "q7"]  # 5턴 + 현재 질문


def test_context_is_per_user(client, db, fake_ai, user_h):
    """다른 사용자의 대화는 내 컨텍스트에 들어가지 않는다"""
    signup(client, email="other@example.com")
    other_h = auth_header(login(client, email="other@example.com")["data"]["access_token"])
    _ask(client, other_h, "다른 사람 질문")
    _ask(client, user_h, "내 질문")
    assert fake_ai.last_messages == [{"role": "user", "content": "내 질문"}]


# ---------- 입력 검증 ----------
@pytest.mark.parametrize("message", ["", "   ", "\n\t "])
def test_v13_empty_message_422(client, fake_ai, user_h, message):
    """빈 문자열·공백만 → 422, AI 호출 없음, 저장 없음"""
    res = _ask(client, user_h, message)
    assert res == {"code": 422, "data": {"message": "질문은 1~1000자로 입력해 주세요."}}
    assert fake_ai.requests == []


def test_v14_length_boundary(client, fake_ai, user_h):
    """1000자 → 200, 1001자 → 422"""
    assert _ask(client, user_h, "가" * 1000)["code"] == 200
    assert _ask(client, user_h, "가" * 1001)["code"] == 422
    assert len(fake_ai.requests) == 1


@pytest.mark.parametrize("body", [{}, {"message": 123}, {"msg": "안녕"}])
def test_bad_body_422(client, fake_ai, user_h, body):
    """필드 누락·문자열이 아닌 값 → 422"""
    assert client.post("/api/chat", json=body, headers=user_h).json()["code"] == 422


# ---------- AI 실패 ----------
@pytest.mark.parametrize("mode", ["timeout", "slow"])
def test_v15_timeout_504_saved(client, db, fake_ai, user_h, monkeypatch, mode):
    """httpx 타임아웃·전체 상한 초과 모두 → 504, status=error·error_code=AI_TIMEOUT 로 저장"""
    monkeypatch.setattr(settings, "ai_timeout_seconds", 0.1)
    fake_ai.mode = mode
    res = _ask(client, user_h, "긴 글 요약해줘")
    assert res == {"code": 504, "data": {"message": "현재 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요."}}

    (log,) = _all_logs(db)
    assert (log.status, log.error_code, log.answer) == ("error", "AI_TIMEOUT", None)
    assert log.question == "긴 글 요약해줘"


@pytest.mark.parametrize("mode", ["http_500", "http_429", "http_401", "connect_error", "empty"])
def test_v16_call_failed_502_saved(client, db, fake_ai, user_h, mode):
    """AI 서버 오류·호출 제한·키 오류·연결 실패·빈 응답 → 502, error_code=AI_CALL_FAILED"""
    fake_ai.mode = mode
    res = _ask(client, user_h, "질문")
    assert res == {"code": 502, "data": {"message": "AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요."}}
    (log,) = _all_logs(db)
    assert (log.status, log.error_code) == ("error", "AI_CALL_FAILED")


def test_missing_api_key_502_without_call(client, fake_ai, user_h, monkeypatch):
    """COPA_API_KEY 가 없으면 AI 를 부르지 않고 502"""
    monkeypatch.setattr(settings, "copa_api_key", "")
    assert _ask(client, user_h, "질문")["code"] == 502
    assert fake_ai.requests == []


def test_v17_recovers_after_failure(client, fake_ai, user_h):
    """장애 직후 정상 질문 → 200 (서버 유지), 실패와 재시도는 별도 기록"""
    fake_ai.mode = "timeout"
    assert _ask(client, user_h, "질문")["code"] == 504
    fake_ai.mode = "ok"
    assert _ask(client, user_h, "질문")["code"] == 200


# ---------- 서버 로그 ----------
def _events(db, request_id):
    """한 요청의 server_logs 를 기록 순서대로."""
    db.expire_all()
    return list(db.scalars(select(ServerLog).where(ServerLog.request_id == request_id).order_by(ServerLog.id)).all())


def _log_file() -> str:
    return Path(settings.log_file).read_text(encoding="utf-8")


def test_v20_success_flow_logged(client, db, fake_ai, user_h):
    """성공 흐름 4단계가 같은 request_id 로 server_logs·로그 파일에 남고, 질문 원문·API 키는 남지 않는다"""
    _ask(client, user_h, "로그에 남으면 안 되는 질문")
    (chat,) = _all_logs(db)
    rows = _events(db, chat.request_id)

    assert [r.event for r in rows] == ["request_received", "ai_call_start", "ai_call_success", "db_save_success"]
    assert {r.level for r in rows} == {"INFO"} and {r.user_id for r in rows} == {chat.user_id}
    assert rows[0].detail == "path=/api/chat"
    assert rows[1].detail == "context_turns=0"
    assert rows[3].detail == f"chat_id={chat.id} status=success"

    file_lines = [line for line in _log_file().splitlines() if chat.request_id in line]
    assert len(file_lines) == 4
    everything = _log_file() + " ".join(r.detail or "" for r in rows)
    assert "로그에 남으면 안 되는 질문" not in everything and "test-ai-key" not in everything


def test_failure_flow_logged(client, db, fake_ai, user_h, monkeypatch):
    """AI 타임아웃 → ai_call_failed(ERROR, 사유) 다음에 실패 기록 저장(db_save_success status=error)"""
    monkeypatch.setattr(settings, "ai_timeout_seconds", 0.1)
    fake_ai.mode = "timeout"
    _ask(client, user_h, "질문")
    (chat,) = _all_logs(db)
    rows = _events(db, chat.request_id)

    assert [r.event for r in rows] == ["request_received", "ai_call_start", "ai_call_failed", "db_save_success"]
    assert rows[2].level == "ERROR" and rows[2].detail.startswith("reason=timeout latency_ms=")
    assert rows[3].detail == f"chat_id={chat.id} status=error"


def test_auth_failed_reason(client, db, fake_ai, user_h):
    """AI 서버가 401 → 사유 auth_failed (API 키 확인 필요)"""
    fake_ai.mode = "http_401"
    _ask(client, user_h, "질문")
    (chat,) = _all_logs(db)
    assert _events(db, chat.request_id)[2].detail.startswith("reason=auth_failed")


def test_v21_db_save_failed(client, db, fake_ai, user_h, monkeypatch):
    """대화 저장이 DB 오류로 실패 → db_save_failed(ERROR) 기록, code 500, 서버는 계속 동작"""

    def broken_create(*args, **kwargs):
        raise OperationalError("INSERT INTO chat_logs", {}, Exception("disk I/O error"))

    with monkeypatch.context() as m:
        m.setattr(crud.chat_log, "create", broken_create)
        assert _ask(client, user_h, "질문")["code"] == 500

    db.expire_all()
    last = db.scalars(select(ServerLog).order_by(ServerLog.id.desc())).first()
    assert (last.event, last.level, last.detail) == ("db_save_failed", "ERROR", "reason=OperationalError")
    assert f"db_save_failed request_id={last.request_id}" in _log_file()
    assert "disk I/O error" not in _log_file()  # 예외 메시지(SQL·질문이 섞일 수 있음)는 남기지 않음

    assert _ask(client, user_h, "다시 질문")["code"] == 200  # 장애 뒤에도 정상 처리


# ---------- 동시 요청 ----------
def test_concurrent_chats_do_not_block_server(client, fake_ai, user_h, monkeypatch):
    """AI 응답을 기다리는 챗 20건이 동시에 있어도 다른 사용자 로그인이 바로 되고, 챗도 모두 성공한다.

    예전에는 동시 15건부터 DB 연결 풀이 바닥나 서버 로그 저장이 이벤트 루프를 막아 서버 전체가 멈췄다.
    멈추면 이벤트 루프가 돌지 않아 시간 제한도 동작하지 않으므로, 별도 스레드에서 돌리고 바깥에서 기다린다.
    """
    fake_ai.mode = "slow"  # AI 가 1초 뒤 응답 (상한은 기본 30초라 시간 초과 아님)
    monkeypatch.setattr(chat_limiter, "limit", 100)  # 이 테스트는 동시 처리만 본다 — 횟수 제한(10회)에 걸리지 않게
    signup(client, email="other@example.com")
    result = {}

    async def scenario():
        transport = httpx.ASGITransport(app=client.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            chats = [
                asyncio.create_task(c.post("/api/chat", json={"message": f"질문 {i}"}, headers=user_h))
                for i in range(20)
            ]
            await asyncio.sleep(0.3)  # 챗 요청들이 AI 응답을 기다리는 중
            started = time.monotonic()
            other = await c.post("/api/auth/login", json={"email": "other@example.com", "password": PASSWORD})
            result["login_seconds"] = time.monotonic() - started
            result["login_code"] = other.json()["code"]
            result["chat_codes"] = [r.json()["code"] for r in await asyncio.gather(*chats)]

    worker = threading.Thread(target=lambda: asyncio.run(scenario()), daemon=True)
    worker.start()
    worker.join(timeout=20)

    assert not worker.is_alive(), "20초 안에 끝나지 않음 — 동시 요청으로 서버가 멈췄다"
    assert result["login_code"] == 200
    assert result["login_seconds"] < 3
    assert result["chat_codes"] == [200] * 20


# ---------- 요청 횟수 제한 (S01) ----------
def test_chat_rate_limit(client, fake_ai, user_h, db):
    """1분에 10회까지 처리하고 11번째는 AI 를 부르지 않고 429. 막힌 요청은 서버 로그에 rate_limited. 다른 사용자는 영향 없음"""
    for i in range(10):
        assert _ask(client, user_h, f"질문 {i}")["code"] == 200
    body = _ask(client, user_h, "11번째")
    assert body["code"] == 429
    assert body["data"]["message"] == "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
    assert len(fake_ai.requests) == 10  # 막힌 요청은 AI 호출 없음
    assert len(_all_logs(db)) == 10  # 대화 기록도 남기지 않음
    assert db.scalars(select(ServerLog).where(ServerLog.event == "rate_limited")).first() is not None

    signup(client, email="other@example.com")
    other_h = auth_header(login(client, email="other@example.com")["data"]["access_token"])
    assert _ask(client, other_h, "다른 사용자")["code"] == 200


def test_db_lock_does_not_freeze_event_loop(client, fake_ai, user_h):
    """DB 쓰기 잠금 때문에 챗 저장이 기다리는 동안에도 이벤트 루프는 멈추지 않는다.

    챗 API 는 async def 라 그 안의 동기 DB 작업(조회·저장·서버 로그)이 이벤트 루프에서 돌면,
    SQLite 잠금을 기다리는 동안(최대 5초) 서버 전체가 다른 요청을 처리하지 못한다.
    """
    fake_ai.mode = "slow"  # AI 가 1초 뒤 응답 → 응답이 왔을 때 DB 는 잠겨 있다
    result = {}

    def hold_write_lock(locked: threading.Event):
        conn = sqlite3.connect(engine.url.database, isolation_level=None)
        conn.execute("BEGIN IMMEDIATE")  # 다른 연결의 쓰기를 막는 잠금
        locked.set()
        time.sleep(2)
        conn.execute("COMMIT")
        conn.close()

    async def scenario():
        stall = 0.0
        done = False

        async def ticker():  # 루프가 멈추면 sleep(0.01) 이 늦게 깨어난다 → 가장 오래 늦은 시간을 잰다
            nonlocal stall
            while not done:
                started = time.perf_counter()
                await asyncio.sleep(0.01)
                stall = max(stall, time.perf_counter() - started - 0.01)

        transport = httpx.ASGITransport(app=client.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            chats = [
                asyncio.create_task(c.post("/api/chat", json={"message": f"질문 {i}"}, headers=user_h))
                for i in range(5)
            ]
            await asyncio.sleep(0.3)  # 챗 요청들이 AI 응답을 기다리는 중
            locked = threading.Event()
            threading.Thread(target=hold_write_lock, args=(locked,), daemon=True).start()
            await asyncio.to_thread(locked.wait)
            watcher = asyncio.create_task(ticker())
            result["chat_codes"] = [r.json()["code"] for r in await asyncio.gather(*chats)]
            done = True
            await watcher
        result["stall"] = stall

    worker = threading.Thread(target=lambda: asyncio.run(scenario()), daemon=True)
    worker.start()
    worker.join(timeout=20)

    assert not worker.is_alive(), "20초 안에 끝나지 않음"
    assert result["chat_codes"] == [200] * 5  # 잠금이 풀린 뒤 모두 저장된다
    assert result["stall"] < 0.5, f"이벤트 루프가 {result['stall']:.2f}초 멈춤"
