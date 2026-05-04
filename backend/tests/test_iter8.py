"""Iter8 Phase A tests: inline status PATCH, artist_contributions, CSV import."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
TOKEN = os.environ.get('ITER8_TOKEN', 'sess_admin_iter8_1777856066074')
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
CLIENT_TAG = "CSVImportTest"


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    # Cleanup test orders
    r = requests.get(f"{BASE_URL}/api/orders", headers=H, timeout=15)
    if r.status_code == 200:
        for o in r.json():
            if (o.get("klien") or "").startswith(CLIENT_TAG) or (o.get("project") or "").startswith("Iter8"):
                requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=H, timeout=15)


def _create_order(**overrides):
    payload = {
        "tanggal": "2026-05-01", "deadline": "2026-05-20",
        "klien": f"{CLIENT_TAG}Base", "project": "Iter8 PatchOrder",
        "platform": "Direct", "status": "modeling",
        "artists": ["Artist A", "Artist B"],
        "artist_statuses": ["Tim", "Tim"],
        "artist_contributions": [60, 40],
        "value": 100, "currency": "USD",
    }
    payload.update(overrides)
    r = requests.post(f"{BASE_URL}/api/orders", headers=H, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ----- PATCH /api/orders/{id}/status -----
class TestStatusPatch:
    def test_patch_status_updates(self):
        o = _create_order(project="Iter8 StatusPatch")
        r = requests.patch(f"{BASE_URL}/api/orders/{o['id']}/status", headers=H, json={"status": "delivered"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "delivered"
        # Persistence verification
        g = requests.get(f"{BASE_URL}/api/orders", headers=H, timeout=15).json()
        match = next((x for x in g if x["id"] == o["id"]), None)
        assert match and match["status"] == "delivered"

    def test_patch_status_404(self):
        r = requests.patch(f"{BASE_URL}/api/orders/nonexistent-id-xyz/status", headers=H, json={"status": "done"}, timeout=15)
        assert r.status_code == 404


# ----- artist_contributions roundtrip -----
class TestArtistContribs:
    def test_create_and_get_contribs(self):
        o = _create_order(project="Iter8 Contrib", artist_contributions=[70, 30])
        assert o.get("artist_contributions") == [70, 30]
        all_orders = requests.get(f"{BASE_URL}/api/orders", headers=H, timeout=15).json()
        m = next((x for x in all_orders if x["id"] == o["id"]), None)
        assert m and m.get("artist_contributions") == [70, 30]

    def test_update_contribs(self):
        o = _create_order(project="Iter8 ContribUpdate", artist_contributions=[50, 50])
        update = {**o, "artist_contributions": [25, 75]}
        # Strip fields not in OrderInput
        update.pop("id", None); update.pop("created_at", None)
        r = requests.put(f"{BASE_URL}/api/orders/{o['id']}", headers=H, json=update, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("artist_contributions") == [25, 75]

    def test_default_empty_contribs(self):
        # Create with no artist_contributions key
        payload = {
            "tanggal": "2026-05-01", "deadline": "2026-05-20",
            "klien": f"{CLIENT_TAG}NoContrib", "project": "Iter8 NoContrib",
            "platform": "Direct",
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=H, json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json().get("artist_contributions") == []


# ----- POST /api/orders/import -----
class TestImport:
    def test_import_ok(self):
        rows = [
            {"tanggal": "2026-06-01", "klien": f"{CLIENT_TAG}", "project": "Iter8 ImportA",
             "platform": "Direct", "value": 500, "currency": "USD", "artists": ["X"]},
            {"tanggal": "2026-06-02", "klien": f"{CLIENT_TAG}", "project": "Iter8 ImportB",
             "platform": "Direct", "value": 800, "currency": "USD", "artists": ["Y", "Z"]},
        ]
        r = requests.post(f"{BASE_URL}/api/orders/import", headers=H, json={"rows": rows}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["created"] == 2
        assert data["skipped"] == 0
        # Verify created + folder_code auto-gen
        all_orders = requests.get(f"{BASE_URL}/api/orders", headers=H, timeout=15).json()
        imp = [o for o in all_orders if o["project"] in ("Iter8 ImportA", "Iter8 ImportB")]
        assert len(imp) == 2
        for o in imp:
            assert o["folder_code"], f"folder_code empty for {o['project']}"

    def test_import_skip_incomplete(self):
        rows = [
            {"tanggal": "2026-06-03", "project": "Iter8 ImportMissingKlien", "platform": "Direct"},  # missing klien
            {"tanggal": "2026-06-03", "klien": f"{CLIENT_TAG}", "project": "Iter8 ImportValid", "platform": "Direct"},
        ]
        r = requests.post(f"{BASE_URL}/api/orders/import", headers=H, json={"rows": rows}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["created"] == 1
        assert data["skipped"] == 1
        assert len(data["errors"]) >= 1
        assert "klien" in data["errors"][0]["reason"].lower() or "missing" in data["errors"][0]["reason"].lower()


# ----- regression -----
class TestRegression:
    def test_get_orders(self):
        r = requests.get(f"{BASE_URL}/api/orders", headers=H, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_earnings(self):
        r = requests.get(f"{BASE_URL}/api/earnings", headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "by_month" in d and "by_platform_month" in d

    def test_get_freelance_artists(self):
        r = requests.get(f"{BASE_URL}/api/freelance/artists", headers=H, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
