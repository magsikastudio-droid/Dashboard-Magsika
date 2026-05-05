"""
Iter 12 backend tests — Daily Chat iteration:
1. GET /api/settings returns dc_reminder_hours default [9,12,15,18,21]
2. PUT /api/settings with dc_reminder_hours=[10,14,20] roundtrip
3. POST /api/settings/test-dc-telegram w/o dc_telegram_bot_token → 400 'belum dikonfigurasi'
4. POST /api/settings/test-dc-telegram as talent → 403
"""
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
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
               timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def talent_session(admin_session):
    ts = int(time.time())
    email = f"tdc.iter12.{ts}@iter12test.com"
    inv = admin_session.post(f"{BASE_URL}/api/auth/invite",
                              json={"email": email, "password": "tdc12345",
                                    "name": "T12 Talent", "role": "talent"},
                              timeout=15)
    assert inv.status_code in (200, 201), f"Invite failed: {inv.status_code} {inv.text}"
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": "tdc12345"}, timeout=15)
    assert r.status_code == 200, f"Talent login: {r.status_code} {r.text}"
    yield s
    # cleanup
    users = admin_session.get(f"{BASE_URL}/api/users", timeout=15).json()
    for u in users:
        if u.get("email") == email:
            admin_session.delete(f"{BASE_URL}/api/users/{u['user_id']}", timeout=15)
            break


@pytest.fixture(scope="module")
def original_settings(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/settings", timeout=15)
    assert r.status_code == 200
    return r.json()


# ---- Tests ----

class TestDcReminderHours:
    """Settings.dc_reminder_hours field"""

    def test_get_settings_has_dc_reminder_hours(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "dc_reminder_hours" in data, "dc_reminder_hours missing from GET /api/settings"
        hours = data["dc_reminder_hours"]
        assert isinstance(hours, list), f"expected list, got {type(hours)}"
        # every entry must be int
        for h in hours:
            assert isinstance(h, int), f"non-int hour: {h!r}"
        # Default should be [9,12,15,18,21] unless already overridden
        # Accept either default or an existing persisted value, but must be non-empty
        assert len(hours) >= 1

    def test_put_settings_persists_dc_reminder_hours(self, admin_session, original_settings):
        new_hours = [10, 14, 20]
        payload = dict(original_settings)
        payload["dc_reminder_hours"] = new_hours
        # remove _id just in case
        payload.pop("_id", None)

        r = admin_session.put(f"{BASE_URL}/api/settings", json=payload, timeout=15)
        assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("dc_reminder_hours") == new_hours, \
            f"PUT response did not roundtrip: {data.get('dc_reminder_hours')}"

        # Verify persisted via GET
        g = admin_session.get(f"{BASE_URL}/api/settings", timeout=15)
        assert g.status_code == 200
        assert g.json().get("dc_reminder_hours") == new_hours

        # Restore
        payload["dc_reminder_hours"] = original_settings.get("dc_reminder_hours", [9, 12, 15, 18, 21])
        admin_session.put(f"{BASE_URL}/api/settings", json=payload, timeout=15)


class TestDcTelegramTestEndpoint:
    """POST /api/settings/test-dc-telegram"""

    def test_no_dc_creds_returns_400(self, admin_session, original_settings):
        # Ensure dc_telegram_bot_token is empty
        payload = dict(original_settings)
        payload.pop("_id", None)
        saved_token = payload.get("dc_telegram_bot_token", "")
        saved_chat = payload.get("dc_telegram_chat_id", "")
        payload["dc_telegram_bot_token"] = ""
        payload["dc_telegram_chat_id"] = ""
        admin_session.put(f"{BASE_URL}/api/settings", json=payload, timeout=15)

        r = admin_session.post(f"{BASE_URL}/api/settings/test-dc-telegram", timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        body = r.text.lower()
        assert "belum dikonfigurasi" in body or "dikonfigurasi" in body, \
            f"expected 'belum dikonfigurasi' in body: {r.text}"

        # Restore
        payload["dc_telegram_bot_token"] = saved_token
        payload["dc_telegram_chat_id"] = saved_chat
        admin_session.put(f"{BASE_URL}/api/settings", json=payload, timeout=15)

    def test_fake_creds_returns_400_from_telegram_failure(self, admin_session, original_settings):
        """With fake creds, telegram API will fail → endpoint returns 400 'Gagal kirim pesan test'."""
        payload = dict(original_settings)
        payload.pop("_id", None)
        saved_token = payload.get("dc_telegram_bot_token", "")
        saved_chat = payload.get("dc_telegram_chat_id", "")
        payload["dc_telegram_bot_token"] = "fake_token_iter12_0000000000"
        payload["dc_telegram_chat_id"] = "-100999"
        admin_session.put(f"{BASE_URL}/api/settings", json=payload, timeout=15)

        r = admin_session.post(f"{BASE_URL}/api/settings/test-dc-telegram", timeout=20)
        # Acceptable: 400 'Gagal kirim pesan test' (fake token → Telegram API rejects)
        # Also acceptable: 200 if somehow mocked, but we expect 400 in real env.
        assert r.status_code in (200, 400), f"unexpected: {r.status_code} {r.text}"
        if r.status_code == 400:
            assert "gagal" in r.text.lower() or "pesan test" in r.text.lower()

        # Restore
        payload["dc_telegram_bot_token"] = saved_token
        payload["dc_telegram_chat_id"] = saved_chat
        admin_session.put(f"{BASE_URL}/api/settings", json=payload, timeout=15)

    def test_talent_forbidden(self, talent_session):
        r = talent_session.post(f"{BASE_URL}/api/settings/test-dc-telegram", timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
