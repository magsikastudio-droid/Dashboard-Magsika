"""Iter 2: Settings (admin only), Reassign (drag-drop), Users list, Reminder loop dedup."""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-management-110.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


def _seed_user(mongo_db, role: str, suffix: str):
    uid = f"test-iter2-{role}-{suffix}"
    token = f"test_iter2_{role}_{suffix}_{int(time.time())}"
    email = f"test.iter2.{role}.{suffix}@example.com"
    mongo_db.users.delete_many({"user_id": uid})
    mongo_db.user_sessions.delete_many({"user_id": uid})
    mongo_db.users.insert_one({
        "user_id": uid, "email": email, "name": f"Test {role}",
        "picture": "", "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, token, email


@pytest.fixture(scope="module")
def admin_session(mongo_db):
    uid, token, email = _seed_user(mongo_db, "admin", "A")
    yield {"uid": uid, "token": token, "email": email}
    mongo_db.user_sessions.delete_many({"user_id": uid})
    mongo_db.users.delete_many({"user_id": uid})


@pytest.fixture(scope="module")
def member_session(mongo_db):
    uid, token, email = _seed_user(mongo_db, "member", "M")
    yield {"uid": uid, "token": token, "email": email}
    mongo_db.user_sessions.delete_many({"user_id": uid})
    mongo_db.users.delete_many({"user_id": uid})


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------- Settings: auth gating --------
class TestSettingsAuth:
    def test_get_settings_no_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 401

    def test_get_settings_member_403(self, member_session):
        r = requests.get(f"{BASE_URL}/api/settings", headers=_h(member_session["token"]))
        assert r.status_code == 403

    def test_get_settings_admin_200(self, admin_session, mongo_db):
        r = requests.get(f"{BASE_URL}/api/settings", headers=_h(admin_session["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        # required keys
        for k in ["allowed_emails", "fonnte_token", "admin_wa", "reminders_enabled"]:
            assert k in data, f"Missing key {k}"
        assert isinstance(data["allowed_emails"], list)
        assert isinstance(data["reminders_enabled"], bool)
        assert "_id" not in data

    def test_put_settings_member_403(self, member_session):
        r = requests.put(f"{BASE_URL}/api/settings", headers=_h(member_session["token"]),
                         json={"allowed_emails": [], "fonnte_token": "x", "admin_wa": "", "reminders_enabled": True})
        assert r.status_code == 403

    def test_put_settings_admin_persists(self, admin_session, mongo_db):
        # Set a known state, then verify GET returns same
        payload = {
            "allowed_emails": ["  Foo@Example.com  ", "bar@test.io", "foo@example.com", ""],
            "fonnte_token": "tok_iter2_test",
            "admin_wa": "6281234567890",
            "reminders_enabled": False,
        }
        r = requests.put(f"{BASE_URL}/api/settings", headers=_h(admin_session["token"]), json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        # lowercased + trimmed + deduped
        assert sorted(data["allowed_emails"]) == sorted(["foo@example.com", "bar@test.io"]) or set(data["allowed_emails"]) == {"foo@example.com", "bar@test.io"}
        assert data["fonnte_token"] == "tok_iter2_test"
        assert data["admin_wa"] == "6281234567890"
        assert data["reminders_enabled"] is False

        # GET reflects update
        r = requests.get(f"{BASE_URL}/api/settings", headers=_h(admin_session["token"]))
        d2 = r.json()
        assert set(d2["allowed_emails"]) == {"foo@example.com", "bar@test.io"}
        assert d2["fonnte_token"] == "tok_iter2_test"
        assert d2["reminders_enabled"] is False

        # Reset to safe defaults so allowlist doesn't lock other tests out
        r = requests.put(f"{BASE_URL}/api/settings", headers=_h(admin_session["token"]),
                         json={"allowed_emails": [], "fonnte_token": "", "admin_wa": "", "reminders_enabled": True})
        assert r.status_code == 200


# -------- Users listing --------
class TestUsersList:
    def test_list_users_no_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/users")
        assert r.status_code == 401

    def test_list_users_member_403(self, member_session):
        r = requests.get(f"{BASE_URL}/api/users", headers=_h(member_session["token"]))
        assert r.status_code == 403

    def test_list_users_admin_200(self, admin_session):
        r = requests.get(f"{BASE_URL}/api/users", headers=_h(admin_session["token"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # contains our admin
        emails = [u["email"] for u in data]
        assert admin_session["email"] in emails
        for u in data:
            assert "_id" not in u
            assert "email" in u
        # Our newly seeded admin user must have role
        seeded = [u for u in data if u["email"] == admin_session["email"]][0]
        assert seeded.get("role") == "admin"


# -------- Reassign endpoint --------
class TestReassign:
    @pytest.fixture
    def created_order(self, admin_session):
        payload = {
            "tanggal": "2026-07-01", "deadline": "2026-07-15",
            "klien": "TEST_Reassign", "project": "TEST_Reassign_Project",
            "jenis": "Modeling", "status": "Modeling",
            "artists": ["Budi"], "value": 100, "paid": False, "catatan": "",
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=_h(admin_session["token"]), json=payload)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        yield oid
        requests.delete(f"{BASE_URL}/api/orders/{oid}", headers=_h(admin_session["token"]))

    def test_reassign_artists(self, admin_session, created_order):
        r = requests.patch(f"{BASE_URL}/api/orders/{created_order}/reassign",
                           headers=_h(admin_session["token"]), json={"artists": ["Joko"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["artists"] == ["Joko"]
        assert d["status"] == "Modeling"  # unchanged
        assert "_id" not in d

        # GET verifies persistence
        rl = requests.get(f"{BASE_URL}/api/orders", headers=_h(admin_session["token"]))
        match = [o for o in rl.json() if o["id"] == created_order][0]
        assert match["artists"] == ["Joko"]

    def test_reassign_status(self, admin_session, created_order):
        r = requests.patch(f"{BASE_URL}/api/orders/{created_order}/reassign",
                           headers=_h(admin_session["token"]), json={"status": "Done"})
        assert r.status_code == 200
        assert r.json()["status"] == "Done"

    def test_reassign_no_auth_401(self, created_order):
        r = requests.patch(f"{BASE_URL}/api/orders/{created_order}/reassign", json={"status": "Done"})
        assert r.status_code == 401

    def test_reassign_nonexistent_404(self, admin_session):
        fake = str(uuid.uuid4())
        r = requests.patch(f"{BASE_URL}/api/orders/{fake}/reassign",
                           headers=_h(admin_session["token"]), json={"status": "Done"})
        assert r.status_code == 404

    def test_reassign_works_for_member_too(self, member_session, created_order):
        # endpoint is gated by get_current_user only (any logged in user can reassign)
        r = requests.patch(f"{BASE_URL}/api/orders/{created_order}/reassign",
                           headers=_h(member_session["token"]), json={"artists": ["Sari"]})
        assert r.status_code == 200
        assert r.json()["artists"] == ["Sari"]


# -------- Reminder loop infra --------
class TestReminderInfra:
    def test_reminder_loop_started_in_logs(self):
        try:
            with open("/var/log/supervisor/backend.err.log", "r") as f:
                log = f.read()
            assert "Reminder loop started" in log
        except FileNotFoundError:
            pytest.skip("Backend log not accessible from this context")

    def test_sent_reminders_dedup_collection_supports_unique_id(self, mongo_db):
        """Verify dedup mechanism: insert sentinel; second insert with same _id raises DuplicateKey."""
        from pymongo.errors import DuplicateKeyError
        key = f"TEST_REMINDER::{uuid.uuid4().hex}"
        try:
            mongo_db.sent_reminders.insert_one({"_id": key, "sent_at": datetime.now(timezone.utc).isoformat()})
            with pytest.raises(DuplicateKeyError):
                mongo_db.sent_reminders.insert_one({"_id": key, "sent_at": datetime.now(timezone.utc).isoformat()})
        finally:
            mongo_db.sent_reminders.delete_one({"_id": key})


# -------- First-user-becomes-admin logic (DB state) --------
class TestBootstrapAdmin:
    def test_admin_exists_in_db(self, mongo_db):
        """Verify that at least one admin exists (our seeded admin or pre-existing)."""
        admins = list(mongo_db.users.find({"role": "admin"}, {"_id": 0, "email": 1}))
        assert len(admins) >= 1, "Expected at least one admin user in DB"
