"""
Iter 8B-E backend tests: email/password auth, role/user mgmt, todo tasks, performance.
Covers: register/login/invite/logout, brute force, users CRUD, task auto-gen + state machine,
performance aggregation, regression on existing endpoints.
"""
import os
import time
import requests
import pytest
from datetime import datetime, timezone

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
            ).rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_TOKEN = "sess_admin_1777758074903"
ADMIN_HDR = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

UNIQ = str(int(time.time()))
TALENT_EMAIL = f"talent.iter8.{UNIQ}@iter8test.com"
TALENT_PW = "pass1234"
INVITE_EMAIL = f"invited.iter8.{UNIQ}@iter8test.com"
INVITE_PW = "invite123"

state = {}


# ---------- Auth: register + login + approval flow ----------

def test_admin_token_valid():
    r = requests.get(f"{API}/auth/me", headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["role"] == "admin"
    assert me["status"] in ("active", None) or me.get("status", "active") == "active"
    state["admin_user_id"] = me["user_id"]


def test_register_creates_pending_user():
    r = requests.post(f"{API}/auth/register",
                      json={"email": TALENT_EMAIL, "password": TALENT_PW, "name": "Iter8 Talent"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert body["role"] == "talent"
    state["talent_user_id"] = body["user_id"]


def test_login_blocked_when_pending():
    r = requests.post(f"{API}/auth/login",
                      json={"email": TALENT_EMAIL, "password": TALENT_PW}, timeout=15)
    assert r.status_code == 403, r.text
    assert "belum disetujui" in r.text.lower()


def test_admin_approves_user():
    uid = state["talent_user_id"]
    r = requests.patch(f"{API}/users/{uid}",
                       json={"status": "active"}, headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "active"


def test_login_succeeds_after_approval():
    s = requests.Session()
    r = s.post(f"{API}/auth/login",
               json={"email": TALENT_EMAIL, "password": TALENT_PW}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "talent"
    assert "session_token" in s.cookies, "Cookie not set"
    state["talent_token"] = s.cookies.get("session_token")
    state["talent_session"] = s


def test_logout_clears_session():
    s = state["talent_session"]
    r = s.post(f"{API}/auth/logout", timeout=15)
    assert r.status_code == 200
    # After logout token should be invalid
    r2 = requests.get(f"{API}/auth/me",
                      headers={"Authorization": f"Bearer {state['talent_token']}"}, timeout=15)
    assert r2.status_code == 401


def test_login_again_for_subsequent_tests():
    s = requests.Session()
    r = s.post(f"{API}/auth/login",
               json={"email": TALENT_EMAIL, "password": TALENT_PW}, timeout=15)
    assert r.status_code == 200
    state["talent_token"] = s.cookies.get("session_token")


# ---------- Invite ----------

def test_invite_admin_creates_active_user():
    r = requests.post(f"{API}/auth/invite",
                      json={"email": INVITE_EMAIL, "password": INVITE_PW, "name": "Invited",
                            "role": "pm"}, headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "active"
    assert body["role"] == "pm"
    state["invited_user_id"] = body["user_id"]
    # immediate login should work
    r2 = requests.post(f"{API}/auth/login",
                       json={"email": INVITE_EMAIL, "password": INVITE_PW}, timeout=15)
    assert r2.status_code == 200


def test_invite_non_admin_rejected():
    talent_hdr = {"Authorization": f"Bearer {state['talent_token']}"}
    r = requests.post(f"{API}/auth/invite",
                      json={"email": f"x.{UNIQ}@iter8test.com", "password": "abcdef",
                            "name": "X", "role": "talent"}, headers=talent_hdr, timeout=15)
    assert r.status_code == 403, r.text


# ---------- Brute force throttle ----------

def test_brute_force_429_after_5_fails():
    bf_email = f"bruteforce.{UNIQ}@iter8test.com"
    # Pre-create user so we get 401 (not user-not-found path) — actually login fails same code
    # Just use a non-existent email. Each fail logs against ip+email key.
    for i in range(5):
        r = requests.post(f"{API}/auth/login",
                          json={"email": bf_email, "password": "wrong"}, timeout=15)
        assert r.status_code == 401, f"attempt {i}: {r.status_code} {r.text}"
    # 6th attempt should be 429
    r6 = requests.post(f"{API}/auth/login",
                       json={"email": bf_email, "password": "wrong"}, timeout=15)
    assert r6.status_code == 429, r6.text


# ---------- Users CRUD (admin only) ----------

def test_list_users_excludes_password_hash():
    r = requests.get(f"{API}/users", headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    for u in users:
        assert "password_hash" not in u


def test_list_users_forbidden_for_talent():
    talent_hdr = {"Authorization": f"Bearer {state['talent_token']}"}
    r = requests.get(f"{API}/users", headers=talent_hdr, timeout=15)
    assert r.status_code == 403


def test_patch_user_role_and_password():
    uid = state["invited_user_id"]
    r = requests.patch(f"{API}/users/{uid}",
                       json={"role": "talent", "password": "newpass1"},
                       headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200
    assert r.json()["role"] == "talent"
    # New password works
    r2 = requests.post(f"{API}/auth/login",
                       json={"email": INVITE_EMAIL, "password": "newpass1"}, timeout=15)
    assert r2.status_code == 200


def test_patch_disabled_kills_sessions():
    uid = state["invited_user_id"]
    # Login to get a session
    s = requests.Session()
    s.post(f"{API}/auth/login",
           json={"email": INVITE_EMAIL, "password": "newpass1"}, timeout=15)
    tok = s.cookies.get("session_token")
    # Disable
    requests.patch(f"{API}/users/{uid}", json={"status": "disabled"},
                   headers=ADMIN_HDR, timeout=15)
    r = requests.get(f"{API}/auth/me",
                     headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    assert r.status_code == 401, r.text


def test_cannot_delete_self():
    uid = state["admin_user_id"]
    r = requests.delete(f"{API}/users/{uid}", headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 400


def test_delete_user_kills_sessions():
    uid = state["invited_user_id"]
    r = requests.delete(f"{API}/users/{uid}", headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200
    # The user should be gone
    r2 = requests.get(f"{API}/users", headers=ADMIN_HDR, timeout=15)
    assert all(u["user_id"] != uid for u in r2.json())


# ---------- Tasks ----------

def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def test_get_tasks_today_auto_generates():
    today = _today()
    r = requests.get(f"{API}/tasks/{today}", headers=ADMIN_HDR, timeout=20)
    assert r.status_code == 200, r.text
    tasks = r.json()
    assert isinstance(tasks, list)
    state["today"] = today
    state["initial_tasks"] = tasks


def test_create_task_manually():
    payload = {
        "title": "Iter8Test Manual Task",
        "date": state["today"],
        "assignee": "Iter8 Talent",
        "assignee_type": "tim",
        "folder_code": "",
        "order_id": "",
        "status": "pending",
    }
    r = requests.post(f"{API}/tasks", json=payload, headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["title"] == payload["title"]
    assert body["status"] == "pending"
    state["task_id"] = body["id"]


def test_patch_task_pending_to_in_progress_sets_started_at():
    tid = state["task_id"]
    r = requests.patch(f"{API}/tasks/{tid}", json={"status": "in_progress"},
                       headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "in_progress"
    assert body["started_at"], "started_at should be set"


def test_patch_task_in_progress_to_done_sets_duration():
    tid = state["task_id"]
    time.sleep(1.2)  # ensure some duration
    r = requests.patch(f"{API}/tasks/{tid}", json={"status": "done"},
                       headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "done"
    assert body["completed_at"]
    assert body["duration_seconds"] >= 1


def test_talent_cannot_patch_others_task():
    tid = state["task_id"]
    talent_hdr = {"Authorization": f"Bearer {state['talent_token']}"}
    r = requests.patch(f"{API}/tasks/{tid}", json={"status": "pending"},
                       headers=talent_hdr, timeout=15)
    # task assignee is "Iter8 Talent" (matches talent name, set during register)
    # so this MAY succeed. Let's create a task with mismatched assignee instead.
    other_payload = {
        "title": "Iter8Test Foreign Task",
        "date": state["today"],
        "assignee": "Someone Else",
        "assignee_type": "tim",
        "folder_code": "",
        "order_id": "",
        "status": "pending",
    }
    r0 = requests.post(f"{API}/tasks", json=other_payload, headers=ADMIN_HDR, timeout=15)
    assert r0.status_code == 200
    foreign_id = r0.json()["id"]
    r = requests.patch(f"{API}/tasks/{foreign_id}",
                       json={"status": "in_progress"},
                       headers=talent_hdr, timeout=15)
    assert r.status_code == 403, r.text
    state["foreign_task_id"] = foreign_id


def test_delete_task_requires_admin_pm():
    talent_hdr = {"Authorization": f"Bearer {state['talent_token']}"}
    r = requests.delete(f"{API}/tasks/{state['task_id']}", headers=talent_hdr, timeout=15)
    assert r.status_code == 403
    # admin can
    r2 = requests.delete(f"{API}/tasks/{state['task_id']}", headers=ADMIN_HDR, timeout=15)
    assert r2.status_code == 200
    # cleanup foreign
    requests.delete(f"{API}/tasks/{state['foreign_task_id']}", headers=ADMIN_HDR, timeout=15)


# ---------- Performance ----------

def test_performance_endpoint_aggregates():
    today = _today()
    month = today[:7]
    r = requests.get(f"{API}/performance?month={month}", headers=ADMIN_HDR, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["month"] == month
    assert "members" in body
    assert isinstance(body["members"], list)
    if body["members"]:
        m = body["members"][0]
        for k in ("assignee", "tasks_done", "tasks_pending",
                  "tasks_in_progress", "avg_speed_hours", "credit_points"):
            assert k in m, f"missing {k}"


def test_performance_no_month_filter_works():
    r = requests.get(f"{API}/performance", headers=ADMIN_HDR, timeout=20)
    assert r.status_code == 200


# ---------- Regression ----------

def test_orders_endpoint_still_works():
    r = requests.get(f"{API}/orders", headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_earnings_endpoint_still_works():
    r = requests.get(f"{API}/earnings", headers=ADMIN_HDR, timeout=15)
    assert r.status_code in (200, 422)  # endpoint exists


def test_freelance_artists_still_works():
    r = requests.get(f"{API}/freelance/artists", headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200


def test_talent_can_view_orders():
    talent_hdr = {"Authorization": f"Bearer {state['talent_token']}"}
    r = requests.get(f"{API}/orders", headers=talent_hdr, timeout=15)
    assert r.status_code == 200


def test_talent_cannot_access_settings():
    talent_hdr = {"Authorization": f"Bearer {state['talent_token']}"}
    r = requests.get(f"{API}/settings", headers=talent_hdr, timeout=15)
    assert r.status_code == 403


# ---------- Cleanup ----------

def test_cleanup_iter8_users():
    # Delete the talent user via admin
    if state.get("talent_user_id"):
        requests.delete(f"{API}/users/{state['talent_user_id']}", headers=ADMIN_HDR, timeout=15)
    # confirm gone
    r = requests.get(f"{API}/users", headers=ADMIN_HDR, timeout=15)
    emails = [u["email"] for u in r.json()]
    assert TALENT_EMAIL not in emails
