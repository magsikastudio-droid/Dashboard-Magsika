"""Iter 4 / Tier 1 backend tests:
- Invoice tracking endpoints (GET /invoices/next, POST /invoices, GET /invoices)
- Telegram notify endpoint per-order (4 types) with config gating
- Settings exchange_rate field persistence
- Existing endpoint regression
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


def _seed_admin(mongo_db, suffix: str):
    uid = f"test-iter4-admin-{suffix}-{int(time.time())}"
    token = f"test_iter4_admin_{suffix}_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    email = f"test.iter4.admin.{suffix}@example.com"
    mongo_db.users.insert_one({
        "user_id": uid, "email": email, "name": "Iter4 Admin",
        "picture": "", "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, token


@pytest.fixture(scope="module")
def admin(mongo_db):
    uid, token = _seed_admin(mongo_db, "T1")
    yield {"uid": uid, "token": token}
    mongo_db.user_sessions.delete_many({"user_id": uid})
    mongo_db.users.delete_many({"user_id": uid})


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# -------- /api/invoices --------
class TestInvoices:
    KLIEN = f"TEST_Klien_{uuid.uuid4().hex[:6]}"

    def test_invoice_full_flow(self, admin, mongo_db):
        # cleanup any stale
        mongo_db.invoices.delete_many({"klien": self.KLIEN})
        # 1. next on empty -> next == 1
        r = requests.get(f"{BASE_URL}/api/invoices/next",
                         params={"klien": self.KLIEN}, headers=_h(admin["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["klien"] == self.KLIEN
        assert d["next"] == 1

        # 2. POST invoice -> seq=1
        ymd = datetime.now().strftime("%y%m%d")
        client_part = self.KLIEN.upper().replace(" ", "")
        invoice_no = f"{ymd}-{client_part}-INV-1"
        payload = {
            "klien": self.KLIEN,
            "invoice_no": invoice_no,
            "order_ids": ["order-1", "order-2"],
            "total_display": 1500.0,
            "currency_display": "USD",
        }
        r = requests.post(f"{BASE_URL}/api/invoices", headers=_h(admin["token"]), json=payload)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["seq"] == 1
        assert rec["klien"] == self.KLIEN
        assert rec["invoice_no"] == invoice_no
        assert rec["total_display"] == 1500.0
        assert rec["currency_display"] == "USD"
        assert rec["order_ids"] == ["order-1", "order-2"]
        assert "id" in rec
        assert "created_at" in rec
        assert "_id" not in rec  # mongo _id must not leak

        # 3. next now should return 2
        r = requests.get(f"{BASE_URL}/api/invoices/next",
                         params={"klien": self.KLIEN}, headers=_h(admin["token"]))
        assert r.status_code == 200
        assert r.json()["next"] == 2

        # 4. POST second -> seq=2
        invoice_no2 = f"{ymd}-{client_part}-INV-2"
        r = requests.post(f"{BASE_URL}/api/invoices", headers=_h(admin["token"]), json={
            **payload, "invoice_no": invoice_no2, "total_display": 2000.0,
        })
        assert r.status_code == 200
        assert r.json()["seq"] == 2

        # 5. List invoices includes both, no _id leak
        r = requests.get(f"{BASE_URL}/api/invoices", headers=_h(admin["token"]))
        assert r.status_code == 200
        invoices = r.json()
        assert isinstance(invoices, list)
        mine = [i for i in invoices if i["klien"] == self.KLIEN]
        assert len(mine) >= 2
        for inv in mine:
            assert "_id" not in inv
            assert "id" in inv and "seq" in inv and "invoice_no" in inv

        # cleanup
        mongo_db.invoices.delete_many({"klien": self.KLIEN})

    def test_invoice_next_per_klien_independent(self, admin, mongo_db):
        ka, kb = f"TEST_KA_{uuid.uuid4().hex[:5]}", f"TEST_KB_{uuid.uuid4().hex[:5]}"
        mongo_db.invoices.delete_many({"klien": {"$in": [ka, kb]}})
        try:
            requests.post(f"{BASE_URL}/api/invoices", headers=_h(admin["token"]), json={
                "klien": ka, "invoice_no": "X-1", "order_ids": [],
                "total_display": 1, "currency_display": "USD",
            })
            ra = requests.get(f"{BASE_URL}/api/invoices/next",
                              params={"klien": ka}, headers=_h(admin["token"])).json()
            rb = requests.get(f"{BASE_URL}/api/invoices/next",
                              params={"klien": kb}, headers=_h(admin["token"])).json()
            assert ra["next"] == 2
            assert rb["next"] == 1
        finally:
            mongo_db.invoices.delete_many({"klien": {"$in": [ka, kb]}})

    def test_invoices_auth_required(self):
        r = requests.get(f"{BASE_URL}/api/invoices/next", params={"klien": "X"})
        assert r.status_code == 401
        r = requests.get(f"{BASE_URL}/api/invoices")
        assert r.status_code == 401
        r = requests.post(f"{BASE_URL}/api/invoices",
                          json={"klien": "X", "invoice_no": "1", "order_ids": [],
                                "total_display": 0, "currency_display": "USD"})
        assert r.status_code == 401


# -------- /api/orders/{id}/notify --------
class TestNotify:
    def _create_order(self, admin):
        payload = {
            "tanggal": "2027-08-01", "deadline": "2027-08-15",
            "klien": "TEST_Notify", "project": "Notify Project",
            "jenis": "Modeling", "status": "modeling",
            "artists": ["A"], "artist_statuses": ["Tim"],
            "value": 100, "paid": False, "catatan": "",
            "platform": "Direct", "marketer": "Ivo", "order_id": "",
            "fee_freelance": 0,
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=_h(admin["token"]), json=payload)
        assert r.status_code == 200
        return r.json()

    def test_notify_returns_400_when_telegram_unconfigured(self, admin):
        # Snapshot settings, blank Telegram
        cur = requests.get(f"{BASE_URL}/api/settings", headers=_h(admin["token"])).json()
        try:
            requests.put(f"{BASE_URL}/api/settings", headers=_h(admin["token"]), json={
                "allowed_emails": cur.get("allowed_emails", []),
                "telegram_bot_token": "",
                "telegram_chat_id": "",
                "reminders_enabled": False,
                "exchange_rate": cur.get("exchange_rate", 16000),
            })
            o = self._create_order(admin)
            try:
                # All 4 types should hit 400 when Telegram not configured
                for t in ["new", "reminder", "warning", "custom"]:
                    r = requests.post(
                        f"{BASE_URL}/api/orders/{o['id']}/notify",
                        headers=_h(admin["token"]),
                        json={"type": t},
                    )
                    assert r.status_code == 400, f"type={t} got {r.status_code}: {r.text}"
                    body = r.json()
                    assert "detail" in body
                    # 404 case
                r404 = requests.post(
                    f"{BASE_URL}/api/orders/nonexistent-id/notify",
                    headers=_h(admin["token"]), json={"type": "new"},
                )
                # 404 only if we restore creds first... currently with no creds, server checks order first then settings.
                # In server.py order check is BEFORE settings check, so this should be 404.
                assert r404.status_code == 404
            finally:
                requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=_h(admin["token"]))
        finally:
            # restore
            requests.put(f"{BASE_URL}/api/settings", headers=_h(admin["token"]), json={
                "allowed_emails": cur.get("allowed_emails", []),
                "telegram_bot_token": cur.get("telegram_bot_token", ""),
                "telegram_chat_id": cur.get("telegram_chat_id", ""),
                "reminders_enabled": cur.get("reminders_enabled", True),
                "exchange_rate": cur.get("exchange_rate", 16000),
            })

    def test_notify_auth_required(self, admin):
        o = self._create_order(admin)
        try:
            r = requests.post(f"{BASE_URL}/api/orders/{o['id']}/notify", json={"type": "new"})
            assert r.status_code == 401
        finally:
            requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=_h(admin["token"]))


# -------- Settings exchange_rate --------
class TestExchangeRate:
    def test_exchange_rate_persists(self, admin):
        cur = requests.get(f"{BASE_URL}/api/settings", headers=_h(admin["token"])).json()
        assert "exchange_rate" in cur, "exchange_rate field missing in GET /settings"
        try:
            payload = {
                "allowed_emails": cur.get("allowed_emails", []),
                "telegram_bot_token": cur.get("telegram_bot_token", ""),
                "telegram_chat_id": cur.get("telegram_chat_id", ""),
                "reminders_enabled": cur.get("reminders_enabled", True),
                "exchange_rate": 17250.5,
            }
            r = requests.put(f"{BASE_URL}/api/settings", headers=_h(admin["token"]), json=payload)
            assert r.status_code == 200, r.text
            assert r.json().get("exchange_rate") == 17250.5
            g = requests.get(f"{BASE_URL}/api/settings", headers=_h(admin["token"])).json()
            assert g["exchange_rate"] == 17250.5
        finally:
            requests.put(f"{BASE_URL}/api/settings", headers=_h(admin["token"]), json={
                "allowed_emails": cur.get("allowed_emails", []),
                "telegram_bot_token": cur.get("telegram_bot_token", ""),
                "telegram_chat_id": cur.get("telegram_chat_id", ""),
                "reminders_enabled": cur.get("reminders_enabled", True),
                "exchange_rate": cur.get("exchange_rate", 16000),
            })


# -------- Regression --------
class TestRegression:
    def test_auth_me(self, admin):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(admin["token"]))
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_orders_list(self, admin):
        r = requests.get(f"{BASE_URL}/api/orders", headers=_h(admin["token"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 12

    def test_order_crud(self, admin):
        payload = {
            "tanggal": "2027-09-01", "deadline": "2027-09-20",
            "klien": "TEST_REG", "project": "Regression",
            "jenis": "Modeling", "status": "modeling",
            "artists": ["X"], "artist_statuses": ["Tim"],
            "value": 100, "paid": False, "catatan": "",
            "platform": "Direct", "marketer": "Ivo", "order_id": "",
            "fee_freelance": 0,
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=_h(admin["token"]), json=payload)
        assert r.status_code == 200
        oid = r.json()["id"]
        r2 = requests.put(f"{BASE_URL}/api/orders/{oid}",
                          headers=_h(admin["token"]),
                          json={**payload, "status": "done"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "done"
        r3 = requests.delete(f"{BASE_URL}/api/orders/{oid}", headers=_h(admin["token"]))
        assert r3.status_code == 200

    def test_earnings(self, admin):
        r = requests.get(f"{BASE_URL}/api/earnings", headers=_h(admin["token"]))
        assert r.status_code == 200
        d = r.json()
        assert "by_month" in d and "by_platform_month" in d

    def test_freelance(self, admin):
        r = requests.get(f"{BASE_URL}/api/freelance", headers=_h(admin["token"]))
        assert r.status_code == 200
        d = r.json()
        assert "by_artist" in d and "rows" in d

    def test_artist_statuses_persisted(self, admin):
        payload = {
            "tanggal": "2027-10-01", "deadline": "2027-10-10",
            "klien": "TEST_ARTSTAT", "project": "ArtStatus",
            "jenis": "Modeling", "status": "modeling",
            "artists": ["A1", "A2"], "artist_statuses": ["Tim", "Freelance"],
            "value": 0, "paid": False, "catatan": "",
            "platform": "Direct", "marketer": "Ivo", "order_id": "",
            "fee_freelance": 0,
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=_h(admin["token"]), json=payload)
        assert r.status_code == 200
        body = r.json()
        try:
            assert body.get("artist_statuses") == ["Tim", "Freelance"]
        finally:
            requests.delete(f"{BASE_URL}/api/orders/{body['id']}", headers=_h(admin["token"]))
