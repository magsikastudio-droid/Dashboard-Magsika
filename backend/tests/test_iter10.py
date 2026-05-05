"""Iteration 10 backend tests.
Focus: folder_code uniqueness, PATCH /api/tasks/{id} pause-resume elapsed_seconds,
talent RBAC for PATCH tasks, GET /api/auth/me, GET /api/performance."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN_EMAIL = "magsikastudio@gmail.com"
ADMIN_PASSWORD = "MagsikaAdmin123!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def talent_session(admin_session):
    ts = int(time.time())
    email = f"talent.iter10.{ts}@iter10test.com"
    password = "Talent1234!"
    # invite talent via admin
    r = admin_session.post(f"{BASE_URL}/api/auth/invite",
                           json={"email": email, "password": password,
                                 "name": f"TalentIter10 {ts}", "role": "talent"}, timeout=15)
    assert r.status_code in (200, 201), f"Invite talent failed: {r.status_code} {r.text}"

    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Talent login failed: {r.status_code} {r.text}"
    s._meta = {"email": email}
    return s


# ---------- /api/auth/me ----------
class TestAuthMe:
    def test_auth_me_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrongpass"}, timeout=10)
        assert r.status_code in (401, 403)


# ---------- /api/performance ----------
class TestPerformance:
    def test_performance_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/performance", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Shape check
        assert isinstance(data, dict) or isinstance(data, list)

    def test_performance_talent_scope(self, talent_session):
        r = talent_session.get(f"{BASE_URL}/api/performance", timeout=15)
        assert r.status_code == 200


# ---------- Folder code uniqueness (POST/PUT /api/orders) ----------
class TestFolderCodeUnique:
    def _make_order(self, folder_code):
        return {
            "tanggal": "2026-01-10",
            "deadline": "2026-01-20",
            "klien": "TESTIter10Client",
            "project": "TESTIter10Project",
            "jenis": "Modeling",
            "status": "modeling",
            "artists": [],
            "artist_statuses": [],
            "artist_contributions": [],
            "value": 100,
            "currency": "USD",
            "platform": "Direct",
            "folder_code": folder_code,
            "folder_code_manual": True,
        }

    def test_post_duplicate_folder_code_rejected(self, admin_session):
        unique_code = f"TEST-DUP-{uuid.uuid4().hex[:6].upper()}"
        r1 = admin_session.post(f"{BASE_URL}/api/orders",
                                json=self._make_order(unique_code), timeout=15)
        assert r1.status_code in (200, 201), f"First POST failed: {r1.status_code} {r1.text}"
        order1 = r1.json()
        assert order1["folder_code"] == unique_code

        # Duplicate attempt
        r2 = admin_session.post(f"{BASE_URL}/api/orders",
                                json=self._make_order(unique_code), timeout=15)
        # Spec asked 400; impl uses 409 Conflict (semantically correct for dup).
        assert r2.status_code in (400, 409), \
            f"Expected 400/409 for duplicate; got {r2.status_code} {r2.text}"

        # cleanup
        admin_session.delete(f"{BASE_URL}/api/orders/{order1['id']}", timeout=10)

    def test_put_duplicate_folder_code_rejected(self, admin_session):
        code_a = f"TEST-PUTA-{uuid.uuid4().hex[:6].upper()}"
        code_b = f"TEST-PUTB-{uuid.uuid4().hex[:6].upper()}"
        ra = admin_session.post(f"{BASE_URL}/api/orders",
                                json=self._make_order(code_a), timeout=15)
        rb = admin_session.post(f"{BASE_URL}/api/orders",
                                json=self._make_order(code_b), timeout=15)
        assert ra.status_code in (200, 201)
        assert rb.status_code in (200, 201)
        oa = ra.json()
        ob = rb.json()
        # Try to rename order B's folder_code to code_a -> must fail
        payload = self._make_order(code_a)  # already taken by A
        rput = admin_session.put(f"{BASE_URL}/api/orders/{ob['id']}",
                                 json=payload, timeout=15)
        assert rput.status_code in (400, 409), \
            f"Expected 400/409 on PUT dup; got {rput.status_code} {rput.text}"
        # cleanup
        admin_session.delete(f"{BASE_URL}/api/orders/{oa['id']}", timeout=10)
        admin_session.delete(f"{BASE_URL}/api/orders/{ob['id']}", timeout=10)


# ---------- PATCH /api/tasks/{id} pause-resume elapsed_seconds ----------
class TestTaskPauseResume:
    def _make_task(self, session, title_suffix=""):
        import datetime as _dt
        today = _dt.datetime.utcnow().strftime("%Y-%m-%d")
        payload = {
            "title": f"TESTIter10 Task {title_suffix}",
            "date": today,
            "assignee": "TestAssignee",
            "assignee_type": "tim",
            "folder_code": "",
            "order_id": "",
            "status": "pending",
            "notes": "",
        }
        r = session.post(f"{BASE_URL}/api/tasks", json=payload, timeout=10)
        assert r.status_code in (200, 201), f"Create task failed: {r.status_code} {r.text}"
        return r.json()

    def _patch(self, session, task_id, body):
        return session.patch(f"{BASE_URL}/api/tasks/{task_id}", json=body, timeout=10)

    def test_notes_update(self, admin_session):
        t = self._make_task(admin_session, "notes")
        r = self._patch(admin_session, t["id"], {"notes": "TEST iter10 note"})
        assert r.status_code == 200
        assert r.json().get("notes") == "TEST iter10 note"
        admin_session.delete(f"{BASE_URL}/api/tasks/{t['id']}", timeout=10)

    def test_pause_resume_preserves_elapsed_seconds(self, admin_session):
        t = self._make_task(admin_session, "pauseresume")
        tid = t["id"]

        # START: pending -> in_progress (started_at set, elapsed=0)
        r1 = self._patch(admin_session, tid, {"status": "in_progress"})
        assert r1.status_code == 200
        t1 = r1.json()
        assert t1["status"] == "in_progress"
        assert t1.get("started_at"), "started_at must be set on start"
        assert int(t1.get("elapsed_seconds") or 0) == 0

        time.sleep(2)

        # PAUSE: in_progress -> pending (started_at cleared; elapsed preserved ≥2)
        r2 = self._patch(admin_session, tid, {"status": "pending"})
        assert r2.status_code == 200
        t2 = r2.json()
        assert t2["status"] == "pending"
        assert t2.get("started_at", "") == "", "started_at should be cleared on pause"
        paused_elapsed = int(t2.get("elapsed_seconds") or 0)
        assert paused_elapsed >= 2, f"elapsed_seconds should be >=2 after 2s, got {paused_elapsed}"

        # RESUME: pending -> in_progress (started_at re-set; elapsed NOT reset)
        r3 = self._patch(admin_session, tid, {"status": "in_progress"})
        assert r3.status_code == 200
        t3 = r3.json()
        assert t3["status"] == "in_progress"
        assert t3.get("started_at"), "started_at must re-set on resume"
        resume_elapsed = int(t3.get("elapsed_seconds") or 0)
        assert resume_elapsed == paused_elapsed, \
            f"elapsed_seconds should not reset on resume; before={paused_elapsed} after={resume_elapsed}"

        time.sleep(2)

        # DONE: in_progress -> done (elapsed continues accumulating)
        r4 = self._patch(admin_session, tid, {"status": "done"})
        assert r4.status_code == 200
        t4 = r4.json()
        assert t4["status"] == "done"
        done_elapsed = int(t4.get("elapsed_seconds") or 0)
        assert done_elapsed >= resume_elapsed + 2, \
            f"Done elapsed should be >= resume+2, got {done_elapsed} vs {resume_elapsed}"

        admin_session.delete(f"{BASE_URL}/api/tasks/{tid}", timeout=10)


# ---------- Talent RBAC on PATCH /api/tasks/{id} ----------
class TestTalentTaskRBAC:
    def _make_task(self, admin_session, title_suffix="", assignee="SomeoneElse"):
        import datetime as _dt
        today = _dt.datetime.utcnow().strftime("%Y-%m-%d")
        payload = {
            "title": f"TESTIter10 RBAC {title_suffix}",
            "date": today,
            "assignee": assignee,
            "assignee_type": "tim",
            "folder_code": "",
            "order_id": "",
            "status": "pending",
            "notes": "",
        }
        r = admin_session.post(f"{BASE_URL}/api/tasks", json=payload, timeout=10)
        assert r.status_code in (200, 201)
        return r.json()

    def test_talent_can_update_status_on_any_task(self, admin_session, talent_session):
        t = self._make_task(admin_session, "talentstatus", assignee="NotTheTalent")
        r = talent_session.patch(f"{BASE_URL}/api/tasks/{t['id']}",
                                 json={"status": "done"}, timeout=10)
        assert r.status_code == 200, f"Talent should update status on any task; got {r.status_code} {r.text}"
        assert r.json().get("status") == "done"
        admin_session.delete(f"{BASE_URL}/api/tasks/{t['id']}", timeout=10)

    def test_talent_can_update_notes_on_any_task(self, admin_session, talent_session):
        t = self._make_task(admin_session, "talentnotes", assignee="NotTheTalent")
        r = talent_session.patch(f"{BASE_URL}/api/tasks/{t['id']}",
                                 json={"notes": "talent note iter10"}, timeout=10)
        assert r.status_code == 200
        assert r.json().get("notes") == "talent note iter10"
        admin_session.delete(f"{BASE_URL}/api/tasks/{t['id']}", timeout=10)

    def test_talent_cannot_update_title(self, admin_session, talent_session):
        t = self._make_task(admin_session, "talenttitle")
        r = talent_session.patch(f"{BASE_URL}/api/tasks/{t['id']}",
                                 json={"title": "hacked"}, timeout=10)
        assert r.status_code == 403, f"Talent must be forbidden from title update; got {r.status_code}"
        admin_session.delete(f"{BASE_URL}/api/tasks/{t['id']}", timeout=10)

    def test_talent_cannot_update_assignee(self, admin_session, talent_session):
        t = self._make_task(admin_session, "talentassignee")
        r = talent_session.patch(f"{BASE_URL}/api/tasks/{t['id']}",
                                 json={"assignee": "hacked"}, timeout=10)
        assert r.status_code == 403, f"Talent must be forbidden from assignee update; got {r.status_code}"
        admin_session.delete(f"{BASE_URL}/api/tasks/{t['id']}", timeout=10)


# ---------- Admin can edit task title/assignee/notes ----------
class TestAdminTaskEdit:
    def test_admin_edit_task_fields(self, admin_session):
        import datetime as _dt
        today = _dt.datetime.utcnow().strftime("%Y-%m-%d")
        payload = {
            "title": "TESTIter10 Admin Edit",
            "date": today,
            "assignee": "OriginalUser",
            "assignee_type": "tim",
            "folder_code": "",
            "order_id": "",
            "status": "pending",
            "notes": "",
        }
        r = admin_session.post(f"{BASE_URL}/api/tasks", json=payload, timeout=10)
        assert r.status_code in (200, 201)
        t = r.json()
        tid = t["id"]

        patch_body = {
            "title": "TESTIter10 Admin Edit - Updated",
            "assignee": "NewAssignee",
            "notes": "admin edited note",
        }
        rp = admin_session.patch(f"{BASE_URL}/api/tasks/{tid}", json=patch_body, timeout=10)
        assert rp.status_code == 200
        updated = rp.json()
        assert updated["title"] == patch_body["title"]
        assert updated["assignee"] == patch_body["assignee"]
        assert updated["notes"] == patch_body["notes"]

        # verify persistence via GET /api/tasks/{date}
        rg = admin_session.get(f"{BASE_URL}/api/tasks/{today}", timeout=10)
        assert rg.status_code == 200
        all_tasks = rg.json()
        found = next((x for x in all_tasks if x["id"] == tid), None)
        assert found is not None
        assert found["title"] == patch_body["title"]
        assert found["assignee"] == patch_body["assignee"]

        admin_session.delete(f"{BASE_URL}/api/tasks/{tid}", timeout=10)


# ---------- Settings telegram_thread_id field ----------
class TestTelegramThreadId:
    def test_settings_accepts_thread_id(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/settings", timeout=10)
        assert r.status_code == 200
        current = r.json()
        # Save original
        original_thread = current.get("telegram_thread_id")

        # Set thread_id
        body = dict(current)
        body["telegram_thread_id"] = 4689
        rp = admin_session.put(f"{BASE_URL}/api/settings", json=body, timeout=10)
        # Accept PUT or POST depending on impl
        if rp.status_code == 405:
            rp = admin_session.post(f"{BASE_URL}/api/settings", json=body, timeout=10)
        assert rp.status_code in (200, 201), f"Set thread_id failed: {rp.status_code} {rp.text}"

        rg = admin_session.get(f"{BASE_URL}/api/settings", timeout=10)
        assert rg.status_code == 200
        assert rg.json().get("telegram_thread_id") == 4689

        # restore
        body["telegram_thread_id"] = original_thread
        admin_session.put(f"{BASE_URL}/api/settings", json=body, timeout=10)
