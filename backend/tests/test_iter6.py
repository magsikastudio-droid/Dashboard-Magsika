"""Iter6 backend tests: auto-freelance sync, telegram on order create (mocked via blank creds), earnings normalization to USD."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-management-110.preview.emergentagent.com').rstrip('/')
TOKEN = os.environ.get('ITER6_TOKEN', 'sess_admin_iter6_1777765697909')
HDRS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# Track items to clean up
_created_orders = []
_test_artist_names = ["Iter6TestArtistA", "Iter6TestArtistB", "Iter6TestArtistC"]


@pytest.fixture(scope="module", autouse=True)
def telegram_blanked():
    """Blank Telegram creds before tests, restore after."""
    r = requests.get(f"{BASE_URL}/api/settings", headers=HDRS, timeout=15)
    assert r.status_code == 200, f"GET settings failed: {r.status_code} {r.text}"
    original = r.json()
    blanked = {**original, "telegram_bot_token": "", "telegram_chat_id": ""}
    # Pydantic validation requires the SettingsInput shape
    payload = {
        "allowed_emails": original.get("allowed_emails", []),
        "telegram_bot_token": "",
        "telegram_chat_id": "",
        "reminders_enabled": original.get("reminders_enabled", True),
        "exchange_rate": original.get("exchange_rate", 16000),
    }
    pr = requests.put(f"{BASE_URL}/api/settings", headers=HDRS, json=payload, timeout=15)
    assert pr.status_code == 200, f"blank settings failed: {pr.status_code} {pr.text}"
    yield original
    # Restore
    restore = {
        "allowed_emails": original.get("allowed_emails", []),
        "telegram_bot_token": original.get("telegram_bot_token", ""),
        "telegram_chat_id": original.get("telegram_chat_id", ""),
        "reminders_enabled": original.get("reminders_enabled", True),
        "exchange_rate": original.get("exchange_rate", 16000),
    }
    requests.put(f"{BASE_URL}/api/settings", headers=HDRS, json=restore, timeout=15)
    # Cleanup orders
    for oid in _created_orders:
        try:
            requests.delete(f"{BASE_URL}/api/orders/{oid}", headers=HDRS, timeout=10)
        except Exception:
            pass
    # Cleanup auto-created artists
    try:
        artists = requests.get(f"{BASE_URL}/api/freelance/artists", headers=HDRS, timeout=10).json()
        for a in artists:
            if a.get("name") in _test_artist_names:
                requests.delete(f"{BASE_URL}/api/freelance/artists/{a['id']}", headers=HDRS, timeout=10)
    except Exception:
        pass


# ---------- Health ----------
def test_health_and_auth():
    r = requests.get(f"{BASE_URL}/api/", timeout=10)
    assert r.status_code == 200
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=HDRS, timeout=10)
    assert me.status_code == 200, me.text
    assert me.json()["role"] == "admin"


# ---------- POST /api/orders auto-creates freelance artists ----------
def test_create_order_auto_creates_freelance_artist():
    payload = {
        "tanggal": "2026-04-01",
        "deadline": "2026-04-15",
        "klien": "Iter6Test Client",
        "project": "Iter6Test Project Auto Sync",
        "platform": "Direct",
        "artists": ["Iter6TestArtistA", "Iter6TestArtistB"],
        "artist_statuses": ["Tim", "Freelance"],
        "value": 500,
        "currency": "USD",
        "fee_freelance": 800000,
    }
    r = requests.post(f"{BASE_URL}/api/orders", headers=HDRS, json=payload, timeout=20)
    assert r.status_code == 200, r.text
    order = r.json()
    _created_orders.append(order["id"])
    assert order["artists"] == ["Iter6TestArtistA", "Iter6TestArtistB"]
    assert order["artist_statuses"] == ["Tim", "Freelance"]

    # Verify Freelance artist auto-created (B), Tim artist NOT auto-created (A)
    artists = requests.get(f"{BASE_URL}/api/freelance/artists", headers=HDRS, timeout=15).json()
    names = {a["name"] for a in artists}
    assert "Iter6TestArtistB" in names, "Freelance-flagged artist should auto-create"
    assert "Iter6TestArtistA" not in names, "Tim-flagged artist should NOT auto-create"


# ---------- PUT /api/orders triggers sync too ----------
def test_update_order_triggers_freelance_sync():
    # Create base order with no freelance
    payload = {
        "tanggal": "2026-04-02",
        "deadline": "2026-04-16",
        "klien": "Iter6Test Client2",
        "project": "Iter6Test Update Sync",
        "platform": "Direct",
        "artists": ["Iter6TestArtistA"],
        "artist_statuses": ["Tim"],
        "value": 100,
        "currency": "USD",
        "fee_freelance": 0,
    }
    r = requests.post(f"{BASE_URL}/api/orders", headers=HDRS, json=payload, timeout=15)
    assert r.status_code == 200
    oid = r.json()["id"]
    _created_orders.append(oid)

    # Now update to add a Freelance artist
    payload["artists"] = ["Iter6TestArtistA", "Iter6TestArtistC"]
    payload["artist_statuses"] = ["Tim", "Freelance"]
    payload["fee_freelance"] = 400000
    pr = requests.put(f"{BASE_URL}/api/orders/{oid}", headers=HDRS, json=payload, timeout=15)
    assert pr.status_code == 200, pr.text

    artists = requests.get(f"{BASE_URL}/api/freelance/artists", headers=HDRS, timeout=15).json()
    names = {a["name"] for a in artists}
    assert "Iter6TestArtistC" in names, "PUT should auto-create freelance artist"


# ---------- Order create returns 200 even when telegram blank ----------
def test_create_order_with_blank_telegram_returns_200():
    payload = {
        "tanggal": "2026-04-03",
        "deadline": "2026-04-17",
        "klien": "Iter6Test Client3",
        "project": "Iter6Test Telegram Skipped",
        "platform": "Direct",
        "artists": ["SoloArtist"],
        "artist_statuses": ["Tim"],
        "value": 200,
        "currency": "USD",
        "fee_freelance": 0,
    }
    r = requests.post(f"{BASE_URL}/api/orders", headers=HDRS, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    _created_orders.append(r.json()["id"])


# ---------- Earnings normalization to USD ----------
def test_earnings_returns_usd_base_with_rate():
    r = requests.get(f"{BASE_URL}/api/earnings", headers=HDRS, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["base_currency"] == "USD"
    assert isinstance(data["exchange_rate"], (int, float))
    assert data["exchange_rate"] > 0
    assert "by_month" in data and isinstance(data["by_month"], list)
    assert "by_platform_month" in data and isinstance(data["by_platform_month"], list)


def test_earnings_math_for_known_order():
    """Order value=500 USD, fee=800000 IDR, rate=16000 → gross +=500, fee +=50, net +=450."""
    # Snapshot earnings BEFORE
    before = requests.get(f"{BASE_URL}/api/earnings", headers=HDRS, timeout=15).json()
    rate = float(before["exchange_rate"])
    by_month_before = {m["month"]: m for m in before["by_month"]}
    target_month = "2026-09"
    pre = by_month_before.get(target_month, {"gross": 0, "fee": 0, "net": 0})

    payload = {
        "tanggal": "2026-09-10",  # unique month so we can isolate
        "deadline": "2026-09-25",
        "klien": "Iter6Test Math Client",
        "project": "Iter6Test Math",
        "platform": "Direct",
        "artists": ["MathArtist"],
        "artist_statuses": ["Freelance"],
        "value": 500,
        "currency": "USD",
        "fee_freelance": 800000,
    }
    r = requests.post(f"{BASE_URL}/api/orders", headers=HDRS, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    _created_orders.append(r.json()["id"])
    _test_artist_names.append("MathArtist")

    after = requests.get(f"{BASE_URL}/api/earnings", headers=HDRS, timeout=15).json()
    by_month_after = {m["month"]: m for m in after["by_month"]}
    post = by_month_after.get(target_month)
    assert post is not None, f"month {target_month} should exist after order"

    gross_delta = post["gross"] - pre["gross"]
    fee_delta = post["fee"] - pre["fee"]
    net_delta = post["net"] - pre["net"]
    expected_fee_usd = 800000.0 / rate
    expected_net = 500.0 - expected_fee_usd

    assert abs(gross_delta - 500.0) < 0.5, f"gross delta {gross_delta}"
    assert abs(fee_delta - expected_fee_usd) < 0.5, f"fee delta {fee_delta} vs {expected_fee_usd}"
    assert abs(net_delta - expected_net) < 0.5, f"net delta {net_delta} vs {expected_net}"
    # rate=16000 → fee_usd=50, net=450
    if abs(rate - 16000) < 1:
        assert abs(fee_delta - 50.0) < 0.5
        assert abs(net_delta - 450.0) < 0.5


def test_earnings_no_giant_negative_net():
    """Regression: with sample seeded orders (mostly IDR-but-stored-as-USD), no astronomically negative nets."""
    r = requests.get(f"{BASE_URL}/api/earnings", headers=HDRS, timeout=15).json()
    for m in r["by_month"]:
        # Reasonable bound: net should be within +/- 10 million USD
        assert -10_000_000 < m["net"] < 10_000_000, f"Unreasonable net: {m}"
        # Specifically should not be negative billions
        assert m["net"] > -1_000_000, f"Massively negative net: {m}"
