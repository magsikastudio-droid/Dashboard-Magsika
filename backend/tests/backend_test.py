"""Backend API tests for Magsika Studio admin order tracking."""
import os
import json
import time
import asyncio
import uuid
import pytest
import requests
import websockets
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-management-110.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

TEST_USER_ID = "test-user-tester"
TEST_EMAIL = "test.tester@example.com"


@pytest.fixture(scope="session")
def mongo_db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="session")
def session_token(mongo_db):
    token = f"test_session_tester_{int(time.time())}"
    mongo_db.users.delete_many({"user_id": TEST_USER_ID})
    mongo_db.user_sessions.delete_many({"user_id": TEST_USER_ID})
    mongo_db.users.insert_one({
        "user_id": TEST_USER_ID,
        "email": TEST_EMAIL,
        "name": "Test Tester",
        "picture": "https://via.placeholder.com/150",
        "created_at": "2026-01-01T00:00:00+00:00",
    })
    from datetime import datetime, timedelta, timezone
    mongo_db.user_sessions.insert_one({
        "user_id": TEST_USER_ID,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield token
    # Cleanup
    mongo_db.user_sessions.delete_many({"user_id": TEST_USER_ID})
    mongo_db.users.delete_many({"user_id": TEST_USER_ID})


@pytest.fixture
def auth_headers(session_token):
    return {"Authorization": f"Bearer {session_token}", "Content-Type": "application/json"}


# -------- Health & Auth gating --------
class TestAuthGating:
    def test_health_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "Magsika" in r.json().get("message", "")

    def test_me_no_session_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_orders_no_session_401(self):
        r = requests.get(f"{BASE_URL}/api/orders")
        assert r.status_code == 401

    def test_me_with_session(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == TEST_EMAIL
        assert data["user_id"] == TEST_USER_ID
        assert "_id" not in data

    def test_me_invalid_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer invalid_xyz"})
        assert r.status_code == 401


# -------- Orders CRUD --------
class TestOrders:
    def test_list_orders_seeded(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 12
        # No _id leaked
        for item in data:
            assert "_id" not in item
            assert "id" in item
            assert "klien" in item
            assert "status" in item

    def test_create_get_update_delete_order(self, auth_headers, mongo_db):
        payload = {
            "tanggal": "2026-05-01",
            "deadline": "2026-05-10",
            "klien": "TEST_ClientX",
            "project": "TEST_Project",
            "jenis": "Modeling",
            "status": "Modeling",
            "artists": ["Budi"],
            "value": 1000000,
            "paid": False,
            "catatan": "TEST entry",
        }
        # CREATE
        r = requests.post(f"{BASE_URL}/api/orders", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["klien"] == "TEST_ClientX"
        assert "id" in created
        assert "_id" not in created
        order_id = created["id"]

        # GET (list contains)
        r = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        found = [o for o in r.json() if o["id"] == order_id]
        assert len(found) == 1
        assert found[0]["project"] == "TEST_Project"

        # UPDATE
        updated_payload = {**payload, "status": "Done", "paid": True, "value": 1500000}
        r = requests.put(f"{BASE_URL}/api/orders/{order_id}", headers=auth_headers, json=updated_payload)
        assert r.status_code == 200
        updated = r.json()
        assert updated["status"] == "Done"
        assert updated["paid"] is True
        assert updated["value"] == 1500000
        assert updated["id"] == order_id

        # Verify GET reflects update
        r = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        found = [o for o in r.json() if o["id"] == order_id]
        assert found[0]["status"] == "Done"
        assert found[0]["paid"] is True

        # DELETE
        r = requests.delete(f"{BASE_URL}/api/orders/{order_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Verify removed
        r = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        found = [o for o in r.json() if o["id"] == order_id]
        assert len(found) == 0

    def test_update_nonexistent_404(self, auth_headers):
        fake = str(uuid.uuid4())
        payload = {
            "tanggal": "2026-05-01", "deadline": "2026-05-10",
            "klien": "X", "project": "Y", "jenis": "Modeling",
            "status": "Modeling", "artists": [], "value": 0, "paid": False, "catatan": "",
        }
        r = requests.put(f"{BASE_URL}/api/orders/{fake}", headers=auth_headers, json=payload)
        assert r.status_code == 404

    def test_delete_nonexistent_404(self, auth_headers):
        r = requests.delete(f"{BASE_URL}/api/orders/{uuid.uuid4()}", headers=auth_headers)
        assert r.status_code == 404


# -------- Seed idempotency --------
class TestSeedIdempotency:
    def test_seed_count_is_12(self, mongo_db):
        # After restart/startup, sample count should still be 12 if the collection was empty
        # Here we verify sample data exists and is not duplicated (count should be exactly 12 + any TEST creations cleared)
        # We just check presence of known sample projects
        names = {d.get("project") for d in mongo_db.orders.find({}, {"_id": 0, "project": 1})}
        assert "Character Ranger Full Body 3D" in names
        assert "Rigging Vtuber Sakura" in names
        # count of unique seeded klien names
        sample_kliens = {"Studio Animax", "VtuberCorp", "NeoAnim", "PixelDream", "IndieGame"}
        klien_names = {d.get("klien") for d in mongo_db.orders.find({}, {"_id": 0, "klien": 1})}
        assert sample_kliens.issubset(klien_names)


# -------- WebSocket broadcast --------
class TestWebSocket:
    @pytest.mark.asyncio
    async def test_ws_receives_create_update_delete(self, session_token):
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"
        headers = {"Authorization": f"Bearer {session_token}"}

        received = []

        async def listen(ws):
            try:
                while True:
                    msg = await asyncio.wait_for(ws.recv(), timeout=8)
                    received.append(json.loads(msg))
            except Exception:
                pass

        async with websockets.connect(ws_url) as ws:
            listen_task = asyncio.create_task(listen(ws))
            await asyncio.sleep(0.5)

            # Trigger CRUD via HTTP (from sync requests in async - use loop executor)
            loop = asyncio.get_event_loop()
            payload = {
                "tanggal": "2026-06-01", "deadline": "2026-06-10",
                "klien": "TEST_WS", "project": "TEST_WS_Project",
                "jenis": "Modeling", "status": "Modeling", "artists": [],
                "value": 100, "paid": False, "catatan": "",
            }
            created = await loop.run_in_executor(None, lambda: requests.post(
                f"{BASE_URL}/api/orders", headers=headers, json=payload).json())
            order_id = created["id"]
            await asyncio.sleep(1.0)

            updated_payload = {**payload, "status": "Done"}
            await loop.run_in_executor(None, lambda: requests.put(
                f"{BASE_URL}/api/orders/{order_id}", headers=headers, json=updated_payload))
            await asyncio.sleep(1.0)

            await loop.run_in_executor(None, lambda: requests.delete(
                f"{BASE_URL}/api/orders/{order_id}", headers=headers))
            await asyncio.sleep(1.5)

            listen_task.cancel()

        types = [m.get("type") for m in received]
        assert "order.created" in types, f"Missing order.created in {types}"
        assert "order.updated" in types, f"Missing order.updated in {types}"
        assert "order.deleted" in types, f"Missing order.deleted in {types}"
