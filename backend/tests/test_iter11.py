"""Iter 11 — Daily Chat backend tests (RBAC + CRUD + summary + settings)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-management-110.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "magsikastudio@gmail.com"
ADMIN_PASS = "MagsikaAdmin123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def talent_session(admin_session):
    """Create talent via invite, login as talent."""
    email = f"tdc.iter11.{int(time.time())}@iter11test.com"
    pw = "tdc12345"
    r = admin_session.post(
        f"{BASE_URL}/api/auth/invite",
        json={"email": email, "password": pw, "name": "TDC Talent", "role": "talent"},
        timeout=15,
    )
    assert r.status_code in (200, 201), f"invite failed: {r.status_code} {r.text}"
    s = requests.Session()
    rl = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert rl.status_code == 200, f"talent login failed: {rl.status_code} {rl.text}"
    yield s, email
    # cleanup user (best effort)
    try:
        users = admin_session.get(f"{BASE_URL}/api/users", timeout=10).json()
        for u in users:
            if u.get("email") == email:
                admin_session.delete(f"{BASE_URL}/api/users/{u.get('user_id') or u.get('id')}", timeout=10)
                break
    except Exception:
        pass


# ---------- /api/daily-chats/current-week ----------
class TestCurrentWeek:
    def test_current_week(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/daily-chats/current-week", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "week_key" in data and "label" in data
        wk = data["week_key"]
        # YYYY-MM-Wn pattern
        assert wk.count("-") == 2 and "W" in wk, f"unexpected week_key: {wk}"
        y, m, n = wk.split("-")
        assert len(y) == 4 and len(m) == 2 and n.startswith("W")
        assert isinstance(data["label"], str) and len(data["label"]) > 0


# ---------- CRUD + Filters + Summary ----------
class TestDailyChatCRUD:
    created_id = None
    week_key = None

    def test_01_create(self, admin_session):
        # capture current week
        wkr = admin_session.get(f"{BASE_URL}/api/daily-chats/current-week", timeout=10).json()
        TestDailyChatCRUD.week_key = wkr["week_key"]

        payload = {
            "username": "TEST_apitest_iter11",
            "status": "Follow Up",
            "account": "Eirene",
            "est_budget": 500,
            "client_budget": 400,
        }
        r = admin_session.post(f"{BASE_URL}/api/daily-chats", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert "id" in doc
        assert "_id" not in doc, "Mongo _id leaked into response"
        assert doc["username"] == payload["username"]
        assert doc["status"] == "Follow Up"
        assert doc["account"] == "Eirene"
        assert float(doc["est_budget"]) == 500
        assert float(doc["client_budget"]) == 400
        assert doc["week_key"] == TestDailyChatCRUD.week_key
        # date is today (UTC)
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        assert doc["date"] == today
        TestDailyChatCRUD.created_id = doc["id"]

    def test_02_list_by_week(self, admin_session):
        wk = TestDailyChatCRUD.week_key
        r = admin_session.get(f"{BASE_URL}/api/daily-chats", params={"week": wk}, timeout=10)
        assert r.status_code == 200
        rows = r.json()
        ids = [x["id"] for x in rows]
        assert TestDailyChatCRUD.created_id in ids

    def test_03_filter_account_magsika_excludes(self, admin_session):
        wk = TestDailyChatCRUD.week_key
        r = admin_session.get(f"{BASE_URL}/api/daily-chats", params={"week": wk, "account": "Magsika"}, timeout=10)
        assert r.status_code == 200
        rows = r.json()
        ids = [x["id"] for x in rows]
        assert TestDailyChatCRUD.created_id not in ids

    def test_04_filter_status_followup_includes(self, admin_session):
        wk = TestDailyChatCRUD.week_key
        r = admin_session.get(f"{BASE_URL}/api/daily-chats", params={"week": wk, "status": "Follow Up"}, timeout=10)
        assert r.status_code == 200
        rows = r.json()
        ids = [x["id"] for x in rows]
        assert TestDailyChatCRUD.created_id in ids

    def test_05_patch_to_place_order(self, admin_session):
        cid = TestDailyChatCRUD.created_id
        r = admin_session.patch(f"{BASE_URL}/api/daily-chats/{cid}", json={"status": "Place Order", "real": 380}, timeout=10)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["status"] == "Place Order"
        assert float(doc["real"]) == 380

    def test_06_summary_reflects_closing_and_revenue(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/daily-chats/summary", params={"limit": 8}, timeout=10)
        assert r.status_code == 200, r.text
        rows = r.json()
        wk = TestDailyChatCRUD.week_key
        # find the eirene row for this week
        match = [x for x in rows if x["week_key"] == wk and x["account"] == "Eirene"]
        assert match, f"no Eirene summary row for {wk}: {rows}"
        row = match[0]
        # The created chat is the only one we made; closing>=1 and revenue_real>=380
        assert row["closing"] >= 1, f"closing should be >=1 got {row}"
        assert row["revenue_real"] >= 380, f"revenue_real should be >=380 got {row}"
        # required keys per spec
        for k in ("week_key", "label", "account", "inbox", "closing", "conversion_rate", "revenue_real"):
            assert k in row

    def test_07_delete(self, admin_session):
        cid = TestDailyChatCRUD.created_id
        r = admin_session.delete(f"{BASE_URL}/api/daily-chats/{cid}", timeout=10)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

    def test_08_get_after_delete_excludes(self, admin_session):
        wk = TestDailyChatCRUD.week_key
        r = admin_session.get(f"{BASE_URL}/api/daily-chats", params={"week": wk}, timeout=10)
        rows = r.json()
        ids = [x["id"] for x in rows]
        assert TestDailyChatCRUD.created_id not in ids


# ---------- Settings round-trip ----------
class TestSettingsDC:
    def test_settings_dc_roundtrip(self, admin_session):
        # Read existing settings to preserve
        original = admin_session.get(f"{BASE_URL}/api/settings", timeout=10).json()
        try:
            # Build payload with required SettingsInput fields preserved
            payload = {
                "allowed_emails": original.get("allowed_emails", []),
                "telegram_bot_token": original.get("telegram_bot_token", ""),
                "telegram_chat_id": original.get("telegram_chat_id", ""),
                "telegram_thread_id": original.get("telegram_thread_id"),
                "reminders_enabled": original.get("reminders_enabled", True),
                "exchange_rate": original.get("exchange_rate", 16000),
                "telegram_templates": original.get("telegram_templates", {}),
                "dc_telegram_bot_token": "fake",
                "dc_telegram_chat_id": "-100",
                "dc_telegram_thread_id": 5000,
                "dc_reminders_enabled": True,
                "dc_template": "test {total}",
            }
            r = admin_session.put(f"{BASE_URL}/api/settings", json=payload, timeout=10)
            assert r.status_code == 200, r.text
            g = admin_session.get(f"{BASE_URL}/api/settings", timeout=10).json()
            assert g["dc_telegram_bot_token"] == "fake"
            assert g["dc_telegram_chat_id"] == "-100"
            assert g["dc_telegram_thread_id"] == 5000
            assert g["dc_template"] == "test {total}"
            assert g["dc_reminders_enabled"] is True

            # null on empty: send empty string -> Optional[int] should become null
            payload["dc_telegram_thread_id"] = None
            r2 = admin_session.put(f"{BASE_URL}/api/settings", json=payload, timeout=10)
            assert r2.status_code == 200, r2.text
            g2 = admin_session.get(f"{BASE_URL}/api/settings", timeout=10).json()
            assert g2["dc_telegram_thread_id"] in (None, 0), f"expected null, got {g2['dc_telegram_thread_id']}"
        finally:
            # restore original
            restore = {
                "allowed_emails": original.get("allowed_emails", []),
                "telegram_bot_token": original.get("telegram_bot_token", ""),
                "telegram_chat_id": original.get("telegram_chat_id", ""),
                "telegram_thread_id": original.get("telegram_thread_id"),
                "reminders_enabled": original.get("reminders_enabled", True),
                "exchange_rate": original.get("exchange_rate", 16000),
                "telegram_templates": original.get("telegram_templates", {}),
                "dc_telegram_bot_token": original.get("dc_telegram_bot_token", ""),
                "dc_telegram_chat_id": original.get("dc_telegram_chat_id", ""),
                "dc_telegram_thread_id": original.get("dc_telegram_thread_id"),
                "dc_reminders_enabled": original.get("dc_reminders_enabled", True),
                "dc_template": original.get("dc_template", ""),
            }
            admin_session.put(f"{BASE_URL}/api/settings", json=restore, timeout=10)


# ---------- RBAC: Talent forbidden ----------
class TestRBAC:
    def test_talent_get_forbidden(self, talent_session):
        s, _email = talent_session
        r = s.get(f"{BASE_URL}/api/daily-chats", timeout=10)
        assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text}"

    def test_talent_post_forbidden(self, talent_session):
        s, _email = talent_session
        r = s.post(f"{BASE_URL}/api/daily-chats", json={"username": "TEST_x"}, timeout=10)
        assert r.status_code == 403

    def test_talent_summary_forbidden(self, talent_session):
        s, _email = talent_session
        r = s.get(f"{BASE_URL}/api/daily-chats/summary", timeout=10)
        assert r.status_code == 403

    def test_talent_current_week_forbidden(self, talent_session):
        s, _email = talent_session
        r = s.get(f"{BASE_URL}/api/daily-chats/current-week", timeout=10)
        assert r.status_code == 403
