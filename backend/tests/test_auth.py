"""인증 API 테스트 — 07-verification V01~V08, V05b~V05f, V30, V22·V23."""

import uuid
from datetime import timedelta

import jwt
from sqlalchemy import create_engine, inspect, select, text

from app import crud
from app.core import rate_limit
from app.core.security import hash_refresh_token
from app.core.timeutil import utcnow
from app.database import add_public_id
from app.models import RefreshToken, ServerLog, User
from app.services import auth_service
from tests.conftest import PASSWORD, auth_header, login, signup


# ---------- 회원가입 ----------
# 테스트 함수 이름의 v01·v02 … 는 docs/07-verification.md 검증 ID 와 대응한다
def test_v01_signup_success(client, db):
    """가입 성공: HTTP 200 + code 201, 해시·id 미노출, 이메일 소문자·닉네임 공백 정리, role=user"""
    res = client.post("/api/auth/signup", json={"email": "User@Example.com", "password": PASSWORD, "nickname": " 어썸체크 "})
    assert res.status_code == 200
    body = res.json()
    assert body["code"] == 201
    assert set(body["data"]) == {"email", "nickname", "created_at"}
    assert body["data"]["email"] == "user@example.com"
    assert body["data"]["nickname"] == "어썸체크"
    assert body["data"]["created_at"].endswith("+09:00")
    assert db.scalar(select(User).where(User.email == "user@example.com")).role == "user"


def test_v02_duplicate_email_409(client):
    """같은 이메일(대소문자만 다른 경우 포함) 재가입 → 409"""
    signup(client)
    assert signup(client)["code"] == 409
    assert signup(client, email="USER@example.com")["code"] == 409


def test_v02b_duplicate_nickname_allowed(client):
    """닉네임은 중복 허용"""
    signup(client, email="a@example.com", nickname="같은닉")
    assert signup(client, email="b@example.com", nickname="같은닉")["code"] == 201


def test_v03_validation_422(client):
    """입력 검증 실패는 모두 422 + 한국어 data.message, FastAPI 기본 detail 키는 없어야 함"""
    # (요청 body, 메시지에 포함돼야 할 문구) — None 이면 문구는 검사하지 않음(필드 누락)
    cases = [
        ({"email": "a@example.com", "password": "1234567", "nickname": "n"}, "비밀번호는 8자 이상"),
        ({"email": "not-an-email", "password": PASSWORD, "nickname": "n"}, "이메일 형식"),
        ({"email": "a@example.com", "password": PASSWORD, "nickname": "가" * 21}, "닉네임은 1~20자"),
        ({"email": "a@example.com", "password": PASSWORD, "nickname": "   "}, "닉네임은 1~20자"),
        ({"email": "a@example.com"}, None),
    ]
    for payload, msg in cases:
        body = client.post("/api/auth/signup", json=payload).json()
        assert body["code"] == 422
        assert "detail" not in body and body["data"]["message"]
        if msg:
            assert msg in body["data"]["message"]


def test_v04_password_hashed(client, db):
    """DB 에 bcrypt 해시($2b$, 60자)로 저장되고 평문이 들어 있지 않음"""
    signup(client)
    user = crud.user.get_by_email(db, "user@example.com")
    assert user.hashed_password.startswith("$2b$") and len(user.hashed_password) == 60
    assert PASSWORD not in user.hashed_password


# ---------- 로그인 ----------
def test_v05_login_success(client, db):
    """로그인 응답 필드·수명(900초·86400초), refresh 는 원문이 아닌 해시로 1행 저장"""
    signup(client)
    body = login(client)
    assert body["code"] == 200
    data = body["data"]
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 900 and data["refresh_expires_in"] == 86400
    rows = db.scalars(select(RefreshToken)).all()
    assert len(rows) == 1
    assert rows[0].token_hash == hash_refresh_token(data["refresh_token"])
    assert rows[0].token_hash != data["refresh_token"]


def test_v06_login_failure_same_message(client):
    """틀린 비밀번호·없는 이메일 모두 401 + 같은 메시지 (계정 존재 추측 방지)"""
    signup(client)
    wrong_pw = login(client, password="wrong-password")
    no_user = login(client, email="nobody@example.com")
    assert wrong_pw["code"] == no_user["code"] == 401
    assert wrong_pw["data"]["message"] == no_user["data"]["message"]


def test_multi_device_login_creates_rows(client, db):
    """여러 기기 로그인 허용 — 로그인할 때마다 refresh 행이 따로 생김"""
    signup(client)
    login(client)
    login(client)
    assert len(db.scalars(select(RefreshToken)).all()) == 2


# ---------- 재발급 · 로그아웃 ----------
def test_v05b_refresh_rotates(client):
    """재발급 시 새 토큰 쌍 발급(회전), 새 access 로 인증 성공, 이전 refresh 는 즉시 무효"""
    signup(client)
    old = login(client)["data"]
    body = client.post("/api/auth/refresh", json={"refresh_token": old["refresh_token"]}).json()
    assert body["code"] == 200
    new = body["data"]
    assert new["refresh_token"] != old["refresh_token"]
    assert client.get("/api/auth/me", headers=auth_header(new["access_token"])).json()["code"] == 200
    # 이전 refresh token 은 즉시 무효
    assert client.post("/api/auth/refresh", json={"refresh_token": old["refresh_token"]}).json()["code"] == 401


def test_v05c_refresh_invalid(client, db):
    """만료·위조 refresh → 401, body 누락 → 422"""
    signup(client)
    token = login(client)["data"]["refresh_token"]
    row = db.scalar(select(RefreshToken))
    row.expires_at = utcnow() - timedelta(seconds=1)  # DB 값을 직접 과거로 바꿔 만료 상황을 만든다
    db.commit()
    assert client.post("/api/auth/refresh", json={"refresh_token": token}).json()["code"] == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": "forged"}).json()["code"] == 401
    assert client.post("/api/auth/refresh", json={}).json()["code"] == 422


def test_v05d_e_logout(client, db):
    """로그아웃 → 행 삭제·재발급 불가, 같은 요청 반복해도 200, body 누락 422"""
    signup(client)
    token = login(client)["data"]["refresh_token"]
    assert client.post("/api/auth/logout", json={"refresh_token": token}).json() == {"code": 200, "data": {}}
    assert db.scalars(select(RefreshToken)).all() == []
    assert client.post("/api/auth/refresh", json={"refresh_token": token}).json()["code"] == 401
    assert client.post("/api/auth/logout", json={"refresh_token": token}).json()["code"] == 200
    assert client.post("/api/auth/logout", json={}).json()["code"] == 422


def test_v05f_delete_expired(client, db):
    """스케줄러 정리 함수는 만료된 행만 지우고 유효한 행은 남긴다"""
    signup(client)
    login(client)
    login(client)
    rows = db.scalars(select(RefreshToken).order_by(RefreshToken.id)).all()
    rows[0].expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    assert auth_service.delete_expired_refresh_tokens(db) == 1
    assert [r.id for r in db.scalars(select(RefreshToken)).all()] == [rows[1].id]


# ---------- 인증 확인 ----------
def test_v07_me(client):
    """유효한 토큰으로 /me → email·nickname·role (id 는 내보내지 않는다)"""
    signup(client)
    token = login(client)["data"]["access_token"]
    body = client.get("/api/auth/me", headers=auth_header(token)).json()
    assert body["code"] == 200
    assert set(body["data"]) == {"email", "nickname", "role"}
    assert body["data"]["role"] == "user"


def test_v08_me_unauthorized(client, db):
    """헤더 없음·쓰레기 값·Basic 방식·만료·다른 키 서명·alg=none 토큰은 모두 401"""
    signup(client)
    sub = crud.user.get_by_email(db, "user@example.com").public_id  # 실제 사용자의 sub 로 만들어 sub 이외의 이유로만 실패하게
    assert client.get("/api/auth/me").json()["code"] == 401  # 헤더 없음
    assert client.get("/api/auth/me", headers=auth_header("garbage")).json()["code"] == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Basic abc"}).json()["code"] == 401

    now = utcnow()
    expired = jwt.encode({"sub": sub, "exp": now - timedelta(minutes=1)}, "test-secret-key-for-pytest-only-0123456789abcdef", algorithm="HS256")
    assert client.get("/api/auth/me", headers=auth_header(expired)).json()["code"] == 401
    forged = jwt.encode({"sub": sub, "exp": now + timedelta(minutes=5)}, "another-secret-key-0123456789abcdefghij", algorithm="HS256")
    assert client.get("/api/auth/me", headers=auth_header(forged)).json()["code"] == 401
    none_alg = jwt.encode({"sub": sub, "exp": now + timedelta(minutes=5)}, None, algorithm="none")
    assert client.get("/api/auth/me", headers=auth_header(none_alg)).json()["code"] == 401


# ---------- 사용자 id 비노출 ----------
def test_jwt_sub_is_public_id(client, db):
    """발급된 access token 의 sub 는 정수 id 가 아니라 그 사용자의 public_id(UUID)다 — 로그인·재발급 모두"""
    signup(client)
    user = crud.user.get_by_email(db, "user@example.com")
    tokens = login(client)["data"]
    renewed = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).json()["data"]
    for token in (tokens["access_token"], renewed["access_token"]):
        sub = jwt.decode(token, options={"verify_signature": False})["sub"]
        assert not sub.isdigit() and sub != str(user.id)
        assert str(uuid.UUID(sub)) == sub == user.public_id


def test_integer_sub_token_rejected(client, db):
    """서명이 올바르더라도 정수 sub(이전 형식) 토큰은 401 — 배포 전 발급된 토큰은 다시 로그인해야 한다"""
    signup(client)
    user = crud.user.get_by_email(db, "user@example.com")
    old = jwt.encode(
        {"sub": str(user.id), "exp": utcnow() + timedelta(minutes=5)},
        "test-secret-key-for-pytest-only-0123456789abcdef",
        algorithm="HS256",
    )
    assert client.get("/api/auth/me", headers=auth_header(old)).json()["code"] == 401


def test_add_public_id_migrates_existing_db(tmp_path):
    """public_id 가 없던 기존 DB(users·chat_logs): 컬럼 추가 + 기존 행마다 서로 다른 UUID + UNIQUE INDEX. 다시 실행해도 값이 그대로다"""
    eng = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with eng.begin() as conn:
        for table in ("users", "chat_logs"):
            conn.execute(text(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY, name TEXT)"))
            conn.execute(text(f"INSERT INTO {table} (name) VALUES ('a'), ('b'), ('c')"))

    for table in ("users", "chat_logs"):
        add_public_id(eng, table)
        with eng.connect() as conn:
            first = dict(conn.execute(text(f"SELECT id, public_id FROM {table}")).all())
        assert len(first) == 3 and len(set(first.values())) == 3
        assert all(str(uuid.UUID(v)) == v for v in first.values())
        index = {i["name"]: i for i in inspect(eng).get_indexes(table)}[f"ix_{table}_public_id"]
        assert index["unique"]

        add_public_id(eng, table)  # 서버 재시작 가정
        with eng.connect() as conn:
            assert dict(conn.execute(text(f"SELECT id, public_id FROM {table}")).all()) == first
    eng.dispose()


# ---------- 관리자 시드 · 권한 ----------
def test_v30_admin_seed(client, db):
    """서버 시작 시 ADMIN_EMAIL 관리자 생성, 재실행해도 중복 생성 없음, 로그인하면 role=admin"""
    admin = crud.user.get_by_email(db, "admin@example.com")
    assert admin is not None and admin.role == "admin"
    auth_service.ensure_admin(db)  # 재시작 가정
    assert len(db.scalars(select(User).where(User.email == "admin@example.com")).all()) == 1
    body = login(client, email="admin@example.com", password="admin-password-1234")
    me = client.get("/api/auth/me", headers=auth_header(body["data"]["access_token"])).json()
    assert me["data"]["role"] == "admin"


def test_admin_seed_promotes_existing_user(client, db):
    """이미 일반 계정이면 시드가 role 만 admin 으로 승격"""
    user = crud.user.get_by_email(db, "admin@example.com")
    user.role = "user"
    db.commit()
    auth_service.ensure_admin(db)
    db.refresh(user)
    assert user.role == "admin"



def test_admin_seed_demotes_previous_admin(client, db, monkeypatch):
    """ADMIN_EMAIL 을 바꾸고 재시작하면 관리자는 새 이메일 1명뿐이고, 이전 관리자는 가진 토큰으로도 403"""
    old_token = login(client, email="admin@example.com", password="admin-password-1234")["data"]["access_token"]
    assert client.get("/api/admin/stats", headers=auth_header(old_token)).json()["code"] == 200

    monkeypatch.setattr(auth_service.settings, "admin_email", "new-admin@example.com")
    auth_service.ensure_admin(db)  # 환경변수 변경 후 재시작 가정

    admins = db.scalars(select(User).where(User.role == "admin")).all()
    assert [a.email for a in admins] == ["new-admin@example.com"]
    assert crud.user.get_by_email(db, "admin@example.com").role == "user"
    assert client.get("/api/admin/stats", headers=auth_header(old_token)).json()["code"] == 403
    new_token = login(client, email="new-admin@example.com", password="admin-password-1234")["data"]["access_token"]
    assert client.get("/api/admin/stats", headers=auth_header(new_token)).json()["code"] == 200


def test_admin_seed_skipped_keeps_admin(client, db, monkeypatch):
    """ADMIN_EMAIL 을 비워 시드를 건너뛰면 기존 관리자를 내리지 않는다 (설정 실수로 관리자 0명 방지)"""
    monkeypatch.setattr(auth_service.settings, "admin_email", "")
    auth_service.ensure_admin(db)
    assert crud.user.get_by_email(db, "admin@example.com").role == "admin"


def test_admin_seed_resets_password_of_preregistered_account(client, db, monkeypatch):
    """ADMIN_EMAIL 주소로 누군가 먼저 가입해 둔 경우, 승격하면서 비밀번호를 ADMIN_PASSWORD 로 바꾸고 기존 세션을 끊는다"""
    signup(client, email="taken@example.com")  # 관리자로 지정될 주소를 다른 사람이 먼저 가입
    squatter_refresh = login(client, email="taken@example.com")["data"]["refresh_token"]

    monkeypatch.setattr(auth_service.settings, "admin_email", "taken@example.com")
    auth_service.ensure_admin(db)  # 환경변수 변경 후 재시작 가정

    assert crud.user.get_by_email(db, "taken@example.com").role == "admin"
    assert login(client, email="taken@example.com")["code"] == 401  # 먼저 가입한 사람의 비밀번호로는 못 들어온다
    assert client.post("/api/auth/refresh", json={"refresh_token": squatter_refresh}).json()["code"] == 401
    assert login(client, email="taken@example.com", password="admin-password-1234")["code"] == 200


def test_admin_seed_applies_password_rotation(client, db, monkeypatch):
    """ADMIN_PASSWORD 를 바꾸고 재시작하면 새 비밀번호만 통하고 기존 세션은 끊긴다. 비밀번호가 같으면 세션 유지"""
    old_refresh = login(client, email="admin@example.com", password="admin-password-1234")["data"]["refresh_token"]
    auth_service.ensure_admin(db)  # 같은 설정으로 재시작 → 아무것도 바뀌지 않음
    old_refresh = client.post("/api/auth/refresh", json={"refresh_token": old_refresh}).json()["data"]["refresh_token"]

    monkeypatch.setattr(auth_service.settings, "admin_password", "rotated-password-5678")
    auth_service.ensure_admin(db)  # 비밀번호 교체 후 재시작 가정

    assert login(client, email="admin@example.com", password="admin-password-1234")["code"] == 401
    assert login(client, email="admin@example.com", password="rotated-password-5678")["code"] == 200
    assert client.post("/api/auth/refresh", json={"refresh_token": old_refresh}).json()["code"] == 401

def test_require_admin_uses_db_role(client, db):
    """require_admin: 비로그인 401, 일반 사용자 403, DB role 변경이 토큰 재발급 없이 즉시 반영"""
    # 관리자 라우터가 아직 없어서 테스트 안에서만 쓰는 임시 경로를 등록해 검증한다
    from fastapi import Depends

    from app.core.dependencies import require_admin

    @client.app.get("/_test/admin-only")
    def _admin_only(_=Depends(require_admin)):
        return {"code": 200, "data": {}}

    signup(client)
    user_token = login(client)["data"]["access_token"]
    assert client.get("/_test/admin-only").json()["code"] == 401
    assert client.get("/_test/admin-only", headers=auth_header(user_token)).json()["code"] == 403

    # 토큰 재발급 없이 DB role 만 바꿔도 즉시 반영
    user = crud.user.get_by_email(db, "user@example.com")
    user.role = "admin"
    db.commit()
    assert client.get("/_test/admin-only", headers=auth_header(user_token)).json()["code"] == 200
    client.app.router.routes.pop()  # 임시 경로 제거 (다른 테스트에 영향 없도록)


# ---------- 공통 봉투 · CORS ----------
def test_v23_envelope_for_framework_errors(client):
    """프레임워크 기본 오류(404·405)도 봉투 형식"""
    assert client.get("/api/nope").json() == {"code": 404, "data": {"message": "요청한 정보를 찾을 수 없습니다."}}
    assert client.get("/api/auth/login").json()["code"] == 405


def test_v22_cors_preflight(client):
    """허용 Origin 은 access-control-allow-origin 헤더가 있고, 미허용 Origin 은 없다"""
    headers = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,authorization"}
    ok = client.options("/api/auth/login", headers={**headers, "Origin": "http://localhost:5173"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/api/auth/login", headers={**headers, "Origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in bad.headers


# ---------- 요청 횟수 제한 (S02·S09) ----------
def test_login_rate_limit_by_email(client, db):
    """같은 이메일로 10분에 5번 틀리면 6번째는 비밀번호가 맞아도 429, 로그 login_rate_limited by=email"""
    signup(client)
    for _ in range(5):
        assert login(client, password="wrong-password")["code"] == 401
    assert login(client)["code"] == 429
    log = db.scalars(select(ServerLog).where(ServerLog.event == "login_rate_limited")).first()
    assert log is not None and "by=email" in log.detail
    signup(client, email="other@example.com")  # 다른 이메일은 영향 없음 (IP 한도 20회 안)
    assert login(client, email="other@example.com")["code"] == 200


def test_login_success_resets_email_failures(client):
    """성공하면 그 이메일의 실패 횟수가 초기화된다 — 가끔 틀리는 정상 사용자가 막히지 않게"""
    signup(client)
    for _ in range(4):
        login(client, password="wrong-password")
    assert login(client)["code"] == 200
    for _ in range(4):
        assert login(client, password="wrong-password")["code"] == 401
    assert login(client)["code"] == 200


def test_login_rate_limit_by_ip(client, monkeypatch):
    """한 IP 에서 여러 이메일을 돌아가며 틀려도 IP 한도를 넘으면 429"""
    monkeypatch.setattr(rate_limit.login_fail_by_ip, "limit", 3)
    signup(client)
    for i in range(3):
        assert login(client, email=f"nobody{i}@example.com")["code"] == 401
    assert login(client)["code"] == 429  # 맞는 계정이어도 같은 IP 라 막힘


def test_signup_rate_limit(client):
    """한 IP 에서 10분에 20번까지 가입 요청, 21번째는 429 (중복 이메일 409 도 센다)"""
    for i in range(20):
        assert signup(client, email=f"user{i}@example.com")["code"] == 201
    assert signup(client, email="user99@example.com")["code"] == 429


def test_client_ip_uses_last_forwarded_for(monkeypatch):
    """프록시 뒤(TRUST_FORWARDED_FOR=true)에서는 X-Forwarded-For 의 마지막 값(프록시가 덧붙인 실제 IP)을 쓴다.
    사용자가 앞에 넣은 가짜 값으로 IP 제한을 피할 수 없다. 꺼져 있으면 헤더를 무시한다."""
    from starlette.requests import Request

    request = Request({"type": "http", "headers": [(b"x-forwarded-for", b"6.6.6.6, 203.0.113.7")], "client": ("10.0.0.1", 1234)})
    assert rate_limit.client_ip(request) == "10.0.0.1"
    monkeypatch.setattr(rate_limit.settings, "trust_forwarded_for", True)
    assert rate_limit.client_ip(request) == "203.0.113.7"


# ---------- 비밀번호 최대 길이 (S04) ----------
def test_signup_password_max_length(client):
    """가입 비밀번호는 128자까지, 129자는 422 (프론트 입력칸 상한과 같음)"""
    assert signup(client, password="a" * 128)["code"] == 201
    body = signup(client, email="long@example.com", password="a" * 129)
    assert body == {"code": 422, "data": {"message": "비밀번호는 128자 이하로 입력해 주세요."}}


def test_login_password_max_length_not_counted_as_failure(client):
    """로그인 비밀번호 129자는 422 — 비밀번호 비교를 하지 않으므로 로그인 실패 횟수에도 세지 않는다"""
    signup(client)
    for _ in range(6):
        assert login(client, password="a" * 129)["code"] == 422
    assert login(client)["code"] == 200
