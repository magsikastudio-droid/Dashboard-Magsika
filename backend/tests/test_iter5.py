"""
Iter 5 backend tests:
- Weekly earnings GET/PUT /api/weekly/{yyyymm}
- Freelance artists CRUD (and cascade delete projects)
- Freelance projects CRUD with filters
- Telegram chat_id stored value (no Telegram API call)
- Regression on existing endpoints
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-management-110.preview.emergentagent.com").rstrip("/")
TOKEN = os.environ.get("ITER5_TOKEN", "sess_admin_iter5_1777762026146")
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update(HEADERS)
    yield sess


# ---------- Auth sanity ----------
def test_auth_me(s):
    r = s.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    assert r.json()["email"].startswith("admin")


# ---------- Settings (Telegram chat_id verification only — DO NOT send) ----------
def test_settings_telegram_chat_id(s):
    r = s.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200
    data = r.json()
    assert data.get("telegram_chat_id") == "-1003611845591", f"got {data.get('telegram_chat_id')}"


# ---------- Weekly: default & upsert ----------
def test_weekly_default_and_upsert(s):
    month = "2099-12"  # use far-future month so we don't clobber real data
    # cleanup pre
    # GET default (doc absent)
    r = s.get(f"{BASE_URL}/api/weekly/{month}")
    assert r.status_code == 200
    d = r.json()
    # Either default or previously-saved; at minimum keys exist
    assert "targets" in d and "groups" in d
    # PUT custom
    payload = {
        "targets": {"magsika": 2500, "eirene": 1800},
        "groups": {
            "magsika": [{"week": 1, "fiverr": 100, "etsy": 50, "upwork": 0, "vgen": 0, "komunitas": 0, "lain_lain": 0}],
            "eirene": [{"week": 1, "fiverr": 0, "etsy": 0, "upwork": 200, "vgen": 0, "komunitas": 0, "lain_lain": 0}],
            "lolicharm_komunitas": [],
        },
    }
    r2 = s.put(f"{BASE_URL}/api/weekly/{month}", json=payload)
    assert r2.status_code == 200, r2.text
    rd = r2.json()
    assert rd["targets"]["magsika"] == 2500
    # GET back
    r3 = s.get(f"{BASE_URL}/api/weekly/{month}")
    assert r3.status_code == 200
    g = r3.json()
    assert g["targets"]["magsika"] == 2500
    assert g["targets"]["eirene"] == 1800
    assert g["groups"]["magsika"][0]["fiverr"] == 100
    assert g["groups"]["eirene"][0]["upwork"] == 200


def test_weekly_default_when_truly_absent(s):
    # use a fresh future month
    month = "2099-11"
    r = s.get(f"{BASE_URL}/api/weekly/{month}")
    assert r.status_code == 200
    d = r.json()
    # If nobody PUT, should give defaults
    if "magsika" in d.get("targets", {}):
        assert d["targets"]["magsika"] in (2000, 2500)  # 2000 is default


# ---------- Freelance artists CRUD ----------
@pytest.fixture()
def artist_id(s):
    payload = {"name": "TEST_ARTIST_iter5", "bank": "BCA", "rekening": "1234567890", "phone": "081234567890"}
    r = s.post(f"{BASE_URL}/api/freelance/artists", json=payload)
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    yield aid
    # teardown — delete artist (cascade deletes projects)
    s.delete(f"{BASE_URL}/api/freelance/artists/{aid}")


def test_artist_create_list_update(s, artist_id):
    # list
    r = s.get(f"{BASE_URL}/api/freelance/artists")
    assert r.status_code == 200
    names = [a["name"] for a in r.json()]
    assert "TEST_ARTIST_iter5" in names
    # update
    r2 = s.put(f"{BASE_URL}/api/freelance/artists/{artist_id}", json={
        "name": "TEST_ARTIST_iter5", "bank": "Mandiri", "rekening": "9999", "phone": "0811"
    })
    assert r2.status_code == 200
    assert r2.json()["bank"] == "Mandiri"
    assert r2.json()["rekening"] == "9999"


def test_artist_no_mongo_id_leak(s, artist_id):
    r = s.get(f"{BASE_URL}/api/freelance/artists")
    assert r.status_code == 200
    for a in r.json():
        assert "_id" not in a


# ---------- Freelance projects CRUD ----------
def test_project_crud_and_filters(s, artist_id):
    payload = {
        "artist_id": artist_id,
        "tanggal": "2099-12-15",
        "project": "TEST_PROJECT",
        "pic": "Admin",
        "status_project": "in_progress",
        "platform": "fiverr",
        "fee": 1500000,
        "dp_amount": 750000,
        "dp_date": "2099-12-10",
        "pelunasan_date": "",
        "status_bayar": "dp_only",
    }
    r = s.post(f"{BASE_URL}/api/freelance/projects", json=payload)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    assert r.json()["status_bayar"] == "dp_only"

    # list with artist filter
    r2 = s.get(f"{BASE_URL}/api/freelance/projects", params={"artist_id": artist_id})
    assert r2.status_code == 200
    assert any(p["id"] == pid for p in r2.json())

    # list with month filter
    r3 = s.get(f"{BASE_URL}/api/freelance/projects", params={"artist_id": artist_id, "month": "2099-12"})
    assert r3.status_code == 200
    assert any(p["id"] == pid for p in r3.json())

    # month filter that excludes
    r3b = s.get(f"{BASE_URL}/api/freelance/projects", params={"artist_id": artist_id, "month": "1999-01"})
    assert r3b.status_code == 200
    assert not any(p["id"] == pid for p in r3b.json())

    # update — mark paid
    payload["status_bayar"] = "paid"
    payload["pelunasan_date"] = "2099-12-20"
    r4 = s.put(f"{BASE_URL}/api/freelance/projects/{pid}", json=payload)
    assert r4.status_code == 200
    assert r4.json()["status_bayar"] == "paid"
    assert r4.json()["pelunasan_date"] == "2099-12-20"

    # delete
    r5 = s.delete(f"{BASE_URL}/api/freelance/projects/{pid}")
    assert r5.status_code == 200
    # confirm gone
    r6 = s.get(f"{BASE_URL}/api/freelance/projects", params={"artist_id": artist_id})
    assert not any(p["id"] == pid for p in r6.json())


def test_artist_delete_cascades_projects(s):
    # create artist
    a = s.post(f"{BASE_URL}/api/freelance/artists", json={"name": "TEST_CASCADE", "bank": "BCA", "rekening": "1", "phone": "1"}).json()
    aid = a["id"]
    # create 2 projects
    for i in range(2):
        s.post(f"{BASE_URL}/api/freelance/projects", json={
            "artist_id": aid, "tanggal": "2099-01-01", "project": f"P{i}", "pic": "x",
            "status_project": "done", "platform": "fiverr", "fee": 1000,
            "dp_amount": 0, "dp_date": "", "pelunasan_date": "", "status_bayar": "unpaid",
        })
    # confirm projects exist
    pre = s.get(f"{BASE_URL}/api/freelance/projects", params={"artist_id": aid}).json()
    assert len(pre) == 2
    # delete artist
    r = s.delete(f"{BASE_URL}/api/freelance/artists/{aid}")
    assert r.status_code == 200
    # projects should be gone (cascade)
    post = s.get(f"{BASE_URL}/api/freelance/projects", params={"artist_id": aid}).json()
    assert post == []


# ---------- Regression ----------
def test_regression_orders_earnings_freelance_invoices(s):
    for path in ["/api/orders", "/api/earnings", "/api/freelance", "/api/invoices"]:
        r = s.get(f"{BASE_URL}{path}")
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        # ensure no _id leaks for list endpoints
        data = r.json()
        if isinstance(data, list):
            for item in data[:5]:
                assert "_id" not in item, f"_id leaked in {path}"


def test_invoices_next_klien(s):
    r = s.get(f"{BASE_URL}/api/invoices/next", params={"klien": "TEST_CLIENT_iter5"})
    assert r.status_code == 200
    assert "next" in r.json()
