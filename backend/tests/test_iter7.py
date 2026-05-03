"""Iter7 backend tests: auto freelance_projects sync, telegram templates, render fallback, platform pivot with custom platform."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-management-110.preview.emergentagent.com').rstrip('/')
TOKEN = os.environ.get('ITER7_TOKEN', 'sess_admin_iter7_1777810295322')
HDRS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

_created_orders = []
_test_artist_names = ["Artisto Iter7A", "Artisto Iter7B", "Artisto Iter7C"]


def _settings_payload(src: dict, **overrides) -> dict:
    base = {
        "allowed_emails": src.get("allowed_emails", []),
        "telegram_bot_token": src.get("telegram_bot_token", ""),
        "telegram_chat_id": src.get("telegram_chat_id", ""),
        "reminders_enabled": src.get("reminders_enabled", True),
        "exchange_rate": src.get("exchange_rate", 16000),
        "telegram_templates": src.get("telegram_templates", {}),
    }
    base.update(overrides)
    return base


@pytest.fixture(scope="module", autouse=True)
def setup_teardown():
    """Blank Telegram + snapshot templates. Restore at end. Cleanup orders/artists/projects."""
    r = requests.get(f"{BASE_URL}/api/settings", headers=HDRS, timeout=15)
    assert r.status_code == 200, f"GET settings failed: {r.status_code} {r.text}"
    original = r.json()
    # Blank telegram & clear templates for safe testing
    blanked = _settings_payload(original, telegram_bot_token="", telegram_chat_id="", telegram_templates={})
    pr = requests.put(f"{BASE_URL}/api/settings", headers=HDRS, json=blanked, timeout=15)
    assert pr.status_code == 200, f"blank settings failed: {pr.status_code} {pr.text}"
    yield original

    # Restore original settings — use documented values from test_credentials context
    restore = _settings_payload(
        original,
        telegram_bot_token=original.get("telegram_bot_token", "") or "8504165985:AAFb7qnjvNAfmrFA4ihzCHem6cXJ4eNVyF0",
        telegram_chat_id=original.get("telegram_chat_id", "") or "-1003611845591",
        telegram_templates={},  # clear test templates so defaults apply
    )
    try:
        requests.put(f"{BASE_URL}/api/settings", headers=HDRS, json=restore, timeout=15)
    except Exception:
        pass

    # Cleanup orders
    for oid in _created_orders:
        try:
            requests.delete(f"{BASE_URL}/api/orders/{oid}", headers=HDRS, timeout=10)
        except Exception:
            pass
    # Cleanup freelance projects tied to these orders
    try:
        projs = requests.get(f"{BASE_URL}/api/freelance/projects", headers=HDRS, timeout=10).json()
        for p in projs:
            if p.get("order_ref_id") in _created_orders or (p.get("project") or "").startswith("Iter7 Sync"):
                try:
                    requests.delete(f"{BASE_URL}/api/freelance/projects/{p['id']}", headers=HDRS, timeout=10)
                except Exception:
                    pass
    except Exception:
        pass
    # Cleanup auto-created artists
    try:
        artists = requests.get(f"{BASE_URL}/api/freelance/artists", headers=HDRS, timeout=10).json()
        for a in artists:
            if a.get("name") in _test_artist_names:
                try:
                    requests.delete(f"{BASE_URL}/api/freelance/artists/{a['id']}", headers=HDRS, timeout=10)
                except Exception:
                    pass
    except Exception:
        pass


# ---------- Health ----------
def test_health_and_auth():
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=HDRS, timeout=10)
    assert me.status_code == 200, me.text
    assert me.json().get("role") == "admin"


# ---------- POST /api/orders auto-creates freelance_projects (NEW in Iter7) ----------
def test_create_order_auto_creates_freelance_project_linked():
    payload = {
        "tanggal": "2026-05-01",
        "deadline": "2026-05-15",
        "klien": "Iter7Test Client",
        "project": "Iter7 Sync Create",
        "platform": "Direct",
        "marketer": "IterPIC",
        "artists": ["Artisto Iter7A", "Artisto Iter7B"],
        "artist_statuses": ["Tim", "Freelance"],
        "value": 500,
        "currency": "USD",
        "fee_freelance": 800000,
    }
    r = requests.post(f"{BASE_URL}/api/orders", headers=HDRS, json=payload, timeout=20)
    assert r.status_code == 200, r.text
    order = r.json()
    oid = order["id"]
    _created_orders.append(oid)

    # Verify freelance artist B auto-created
    artists = requests.get(f"{BASE_URL}/api/freelance/artists", headers=HDRS, timeout=15).json()
    artistB = next((a for a in artists if a["name"] == "Artisto Iter7B"), None)
    assert artistB is not None, "Freelance artist B should be auto-created"

    # Verify freelance_project linked to order is auto-created
    projs = requests.get(f"{BASE_URL}/api/freelance/projects", headers=HDRS, timeout=15).json()
    linked = [p for p in projs if p.get("order_ref_id") == oid]
    assert len(linked) == 1, f"Expected 1 linked freelance project, got {len(linked)}: {linked}"
    p = linked[0]
    assert p["artist_id"] == artistB["id"]
    assert p["project"] == "Iter7 Sync Create"
    assert p["platform"] == "Direct"
    assert p["tanggal"] == "2026-05-01"
    assert p["pic"] == "IterPIC"
    # fee split evenly across 1 freelancer = full fee
    assert abs(float(p["fee"]) - 800000) < 1, f"fee expected 800000, got {p['fee']}"
    # pembayaran fields start blank
    assert p.get("dp_amount", 0) == 0
    assert p.get("dp_date", "") == ""
    assert p.get("pelunasan_date", "") == ""
    assert p.get("status_bayar", "unpaid") == "unpaid"


# ---------- PUT /api/orders updates freelance_project but preserves pembayaran fields ----------
def test_update_order_updates_project_preserves_pembayaran():
    payload = {
        "tanggal": "2026-05-02",
        "deadline": "2026-05-16",
        "klien": "Iter7Test Client U",
        "project": "Iter7 Sync Update Orig",
        "platform": "Direct",
        "marketer": "PIC1",
        "artists": ["Artisto Iter7C"],
        "artist_statuses": ["Freelance"],
        "value": 300,
        "currency": "USD",
        "fee_freelance": 400000,
    }
    r = requests.post(f"{BASE_URL}/api/orders", headers=HDRS, json=payload, timeout=15)
    assert r.status_code == 200
    oid = r.json()["id"]
    _created_orders.append(oid)

    projs = requests.get(f"{BASE_URL}/api/freelance/projects", headers=HDRS, timeout=15).json()
    linked = [p for p in projs if p.get("order_ref_id") == oid]
    assert len(linked) == 1
    proj_id = linked[0]["id"]

    # Simulate user editing pembayaran fields via PUT /api/freelance/projects/{id}
    user_edit = {
        "artist_id": linked[0]["artist_id"],
        "tanggal": linked[0]["tanggal"],
        "project": linked[0]["project"],
        "pic": linked[0]["pic"],
        "status_project": linked[0]["status_project"],
        "platform": linked[0]["platform"],
        "fee": linked[0]["fee"],
        "dp_amount": 200000,
        "dp_date": "2026-05-05",
        "pelunasan_date": "2026-05-20",
        "status_bayar": "paid",
        "order_ref_id": oid,
    }
    ue = requests.put(f"{BASE_URL}/api/freelance/projects/{proj_id}", headers=HDRS, json=user_edit, timeout=15)
    assert ue.status_code == 200, ue.text

    # Now update the order — project name, fee, platform
    payload["project"] = "Iter7 Sync Update Changed"
    payload["fee_freelance"] = 600000
    payload["platform"] = "Fiverr"
    payload["tanggal"] = "2026-05-03"
    pr = requests.put(f"{BASE_URL}/api/orders/{oid}", headers=HDRS, json=payload, timeout=15)
    assert pr.status_code == 200, pr.text

    # Re-fetch linked project
    projs2 = requests.get(f"{BASE_URL}/api/freelance/projects", headers=HDRS, timeout=15).json()
    linked2 = [p for p in projs2 if p.get("order_ref_id") == oid]
    assert len(linked2) == 1
    p2 = linked2[0]
    # order-driven fields should have changed
    assert p2["project"] == "Iter7 Sync Update Changed", f"project not synced: {p2['project']}"
    assert p2["platform"] == "Fiverr", f"platform not synced: {p2['platform']}"
    assert p2["tanggal"] == "2026-05-03"
    assert abs(float(p2["fee"]) - 600000) < 1
    # pembayaran fields must be preserved
    assert p2.get("dp_amount") == 200000, f"dp_amount overwritten! {p2.get('dp_amount')}"
    assert p2.get("dp_date") == "2026-05-05", f"dp_date overwritten! {p2.get('dp_date')}"
    assert p2.get("pelunasan_date") == "2026-05-20"
    assert p2.get("status_bayar") == "paid"


# ---------- Settings persistence for telegram_templates ----------
def test_settings_put_persists_telegram_templates():
    cur = requests.get(f"{BASE_URL}/api/settings", headers=HDRS, timeout=10).json()
    payload = _settings_payload(cur, telegram_templates={"new": "X {project}"})
    p = requests.put(f"{BASE_URL}/api/settings", headers=HDRS, json=payload, timeout=10)
    assert p.status_code == 200, p.text
    g = requests.get(f"{BASE_URL}/api/settings", headers=HDRS, timeout=10).json()
    assert g.get("telegram_templates", {}).get("new") == "X {project}"


# ---------- render_tg_template fallback on invalid placeholder ----------
def test_render_tg_template_fallback_on_bad_placeholder():
    """Save a broken template then trigger notify with blank creds → expect 400 (not 500)."""
    cur = requests.get(f"{BASE_URL}/api/settings", headers=HDRS, timeout=10).json()
    # Ensure telegram blank (no real API call)
    payload = _settings_payload(
        cur,
        telegram_bot_token="",
        telegram_chat_id="",
        telegram_templates={"new": "BROKEN {unknown_var}"},
    )
    p = requests.put(f"{BASE_URL}/api/settings", headers=HDRS, json=payload, timeout=10)
    assert p.status_code == 200

    # Create an order for notify target
    order_payload = {
        "tanggal": "2026-05-04",
        "deadline": "2026-05-18",
        "klien": "Iter7Test NotifyClient",
        "project": "Iter7 Sync Notify",
        "platform": "Direct",
        "artists": ["SoloNotifyArtist"],
        "artist_statuses": ["Tim"],
        "value": 100,
        "currency": "USD",
        "fee_freelance": 0,
    }
    r = requests.post(f"{BASE_URL}/api/orders", headers=HDRS, json=order_payload, timeout=15)
    assert r.status_code == 200, r.text
    oid = r.json()["id"]
    _created_orders.append(oid)

    # Notify → should 400 (telegram not configured), NOT 500 (render error)
    nr = requests.post(f"{BASE_URL}/api/orders/{oid}/notify", headers=HDRS, json={"type": "new"}, timeout=10)
    assert nr.status_code == 400, f"Expected 400 (telegram not configured), got {nr.status_code}: {nr.text}"
    assert "Telegram" in nr.text or "telegram" in nr.text.lower()


# ---------- Earnings includes custom platform ----------
def test_earnings_by_platform_month_includes_custom_platform():
    custom_platform = "Iter7CustomPlatform"
    order_payload = {
        "tanggal": "2026-06-10",
        "deadline": "2026-06-20",
        "klien": "Iter7Test CustomPlat",
        "project": "Iter7 Sync CustomPlat",
        "platform": custom_platform,
        "artists": ["SoloCustomArtist"],
        "artist_statuses": ["Tim"],
        "value": 250,
        "currency": "USD",
        "fee_freelance": 0,
    }
    r = requests.post(f"{BASE_URL}/api/orders", headers=HDRS, json=order_payload, timeout=15)
    assert r.status_code == 200, r.text
    oid = r.json()["id"]
    _created_orders.append(oid)

    e = requests.get(f"{BASE_URL}/api/earnings", headers=HDRS, timeout=15).json()
    assert e.get("base_currency") == "USD"
    platforms_in_pivot = {row["platform"] for row in e.get("by_platform_month", [])}
    assert custom_platform in platforms_in_pivot, f"Custom platform not in by_platform_month: {platforms_in_pivot}"


# ---------- Earnings regression ----------
def test_earnings_usd_reasonable_regression():
    r = requests.get(f"{BASE_URL}/api/earnings", headers=HDRS, timeout=15).json()
    assert r["base_currency"] == "USD"
    assert r["exchange_rate"] > 0
    for m in r["by_month"]:
        assert -10_000_000 < m["net"] < 10_000_000, f"Unreasonable net: {m}"
