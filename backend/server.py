from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import asyncio
import re
import requests
import bcrypt
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Set
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Platform Codes ----------
PLATFORM_CODES = {
    "Fiverr Magsika": "MGSIKA",
    "Fiverr Eirene": "EIRENE",
    "Etsy Lolicharm": "LLCHRM",
    "Direct": "DIRECT",
    "Komunitas": "LTK",
}

def sanitize_upper(s: str) -> str:
    # keep alnum and spaces; remove special chars; uppercase; collapse spaces
    s = re.sub(r"[^A-Za-z0-9 ]+", "", s or "").strip().upper()
    return re.sub(r"\s+", " ", s)

async def generate_folder_code(tanggal: str, platform: str, klien: str, project: str) -> str:
    # tanggal: YYYY-MM-DD -> YYMMDD
    date_compact = tanggal.replace("-", "")[2:] if tanggal else "000000"
    code = PLATFORM_CODES.get(platform, "ETC")
    # count existing orders same tanggal & platform
    existing = await db.orders.count_documents({"tanggal": tanggal, "platform": platform})
    seq = existing + 1
    client_part = sanitize_upper(klien).replace(" ", "")
    project_part = sanitize_upper(project)
    return f"{date_compact}-{code}{seq:02d}-{client_part}-{project_part}"

# ---------- Models ----------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "talent"  # admin | pm | talent
    status: str = "active"  # active | pending | disabled
    auth_provider: str = "google"  # google | password | both

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tanggal: str
    deadline: str
    klien: str
    project: str
    jenis: str = "Modeling"
    status: str = "modeling"
    artists: List[str] = []
    artist_statuses: List[str] = []  # parallel array: "Tim" or "Freelance"
    artist_contributions: List[float] = []  # parallel array: % contribution, total should be 100
    value: float = 0
    currency: str = "USD"  # USD or IDR
    paid: bool = False
    catatan: str = ""
    platform: str = "Direct"
    marketer: str = ""
    order_id: str = ""
    folder_code: str = ""
    folder_code_manual: bool = False  # if true, do not regen
    fee_freelance: float = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderInput(BaseModel):
    tanggal: str
    deadline: str
    klien: str
    project: str
    jenis: str = "Modeling"
    status: str = "modeling"
    artists: List[str] = []
    artist_statuses: List[str] = []
    artist_contributions: List[float] = []
    value: float = 0
    currency: str = "USD"
    paid: bool = False
    catatan: str = ""
    platform: str = "Direct"
    marketer: str = ""
    order_id: str = ""
    folder_code: str = ""
    folder_code_manual: bool = False
    fee_freelance: float = 0

DEFAULT_TG_TEMPLATES = {
    "new": "🆕 ORDER BARU MASUK\n\n📁 Project   : {project}\n👤 Client    : {klien}\n📂 Folder    : {folder_code}\n📅 Deadline  : {deadline}\n🚀 Silakan segera diproses.",
    "reminder": "⏰ REMINDER DEADLINE\n\n📁 Project   : {project}\n👤 Client    : {klien}\n📂 Folder    : {folder_code}\n📅 Deadline  : {deadline}\n⚠️ Deadline sudah semakin dekat, segera diselesaikan.",
    "warning": "❗ WARNING DEADLINE H-1\n\n📁 Project   : {project}\n👤 Client    : {klien}\n📂 Folder    : {folder_code}\n📅 Deadline  : {deadline}\n🚨 Deadline BESOK! Pastikan selesai tepat waktu!",
    "custom": "⏳ REMINDER DEADLINE\n\n📁 Project   : {project}\n👤 Client    : {klien}\n📂 Folder    : {folder_code}\n📅 Deadline  : {deadline}\n⚠️ Deadline tersisa {days_left} hari lagi!",
}

def render_tg_template(settings_doc: dict, kind: str, vars: dict) -> str:
    """Render Telegram message template with safe fallback to defaults on KeyError."""
    templates = (settings_doc or {}).get("telegram_templates") or {}
    tpl = templates.get(kind) or DEFAULT_TG_TEMPLATES.get(kind, "")
    try:
        return tpl.format(**{"project": "", "klien": "", "folder_code": "", "deadline": "", "days_left": "", **vars})
    except Exception:
        return DEFAULT_TG_TEMPLATES.get(kind, "").format(**{"project": "", "klien": "", "folder_code": "", "deadline": "", "days_left": "", **vars})


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    allowed_emails: List[str] = []
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    telegram_thread_id: Optional[int] = None
    reminders_enabled: bool = True
    exchange_rate: float = 16000  # IDR per USD
    telegram_templates: dict = {}

class SettingsInput(BaseModel):
    allowed_emails: List[str] = []
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    telegram_thread_id: Optional[int] = None
    reminders_enabled: bool = True
    exchange_rate: float = 16000
    telegram_templates: dict = {}

class ReassignInput(BaseModel):
    artists: Optional[List[str]] = None
    status: Optional[str] = None

# ---------- Auth helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

async def get_current_user(request: Request) -> User:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    # migrate legacy role values
    role = user_doc.get("role") or "talent"
    if role == "member":
        role = "pm"
    user_doc["role"] = role
    user_doc.setdefault("status", "active")
    if user_doc.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    if user_doc.get("status") == "pending":
        raise HTTPException(status_code=403, detail="Akun belum disetujui admin")
    return User(**user_doc)

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

async def require_admin_or_pm(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "pm"):
        raise HTTPException(status_code=403, detail="Admin/PM only")
    return user

# ---------- WS Manager ----------
class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.active.add(ws)

    async def disconnect(self, ws: WebSocket):
        async with self.lock:
            self.active.discard(ws)

    async def broadcast(self, message: dict):
        dead = []
        async with self.lock:
            conns = list(self.active)
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

manager = ConnectionManager()

# ---------- Settings helpers ----------
async def get_settings_doc() -> dict:
    doc = await db.settings.find_one({"_id": "global"})
    if not doc:
        doc = {
            "_id": "global",
            "allowed_emails": [],
            "telegram_bot_token": os.environ.get("TELEGRAM_BOT_TOKEN", ""),
            "telegram_chat_id": os.environ.get("TELEGRAM_CHAT_ID", ""),
            "reminders_enabled": True,
        }
        await db.settings.insert_one(doc)
    return doc

# ---------- Auth routes ----------
@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Auth failed: {e}")

    email = data["email"].lower().strip()
    settings_doc = await get_settings_doc()
    allowed = [e.lower().strip() for e in settings_doc.get("allowed_emails", []) if e]
    has_admin = await db.users.find_one({"role": "admin"}, {"_id": 0})

    if not has_admin:
        role = "admin"
        status = "active"
    elif allowed and email not in allowed and not await db.users.find_one({"email": email, "role": "admin"}, {"_id": 0}):
        raise HTTPException(status_code=403, detail=f"Email {email} tidak diizinkan. Hubungi admin untuk akses.")
    else:
        role = "talent"
        status = "active"  # Google sign-in trusted if whitelisted

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        new_role = existing.get("role") or role
        if new_role == "member":
            new_role = "pm"
        # enforce status on re-login
        cur_status = existing.get("status", "active")
        if cur_status == "disabled":
            raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
        if cur_status == "pending":
            raise HTTPException(status_code=403, detail="Akun belum disetujui admin")
        await db.users.update_one({"user_id": user_id}, {"$set": {
            "name": data.get("name", existing.get("name")),
            "picture": data.get("picture", existing.get("picture")),
            "role": new_role,
        }})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "role": role,
            "status": status,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 60 * 60)
    return {"user_id": user_id, "email": email, "name": data.get("name", ""), "picture": data.get("picture", ""), "role": (existing or {}).get("role") or role}

@api_router.get("/auth/me", response_model=User)
async def auth_me(user: User = Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}

# ---------- Email/Password auth ----------
class RegisterInput(BaseModel):
    email: str
    password: str
    name: str = ""

class LoginInput(BaseModel):
    email: str
    password: str

class InviteInput(BaseModel):
    email: str
    password: str
    name: str = ""
    role: str = "talent"  # admin | pm | talent

async def _issue_session(user_id: str, response: Response) -> str:
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 60 * 60)
    return session_token

@api_router.post("/auth/register")
async def auth_register(payload: RegisterInput):
    email = (payload.email or "").lower().strip()
    if not email or not payload.password or len(payload.password) < 6:
        raise HTTPException(400, "Email & password (min 6 karakter) wajib")
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(400, "Email sudah terdaftar")
    # First user becomes admin + active, otherwise pending
    has_admin = await db.users.find_one({"role": "admin"}, {"_id": 0})
    role = "admin" if not has_admin else "talent"
    status = "active" if not has_admin else "pending"
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": payload.name or email.split("@")[0],
        "picture": "",
        "password_hash": hash_password(payload.password),
        "role": role,
        "status": status,
        "auth_provider": "password",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"user_id": user_id, "email": email, "role": role, "status": status, "message": "Berhasil mendaftar" + ("" if status == "active" else ". Tunggu persetujuan admin.")}

@api_router.post("/auth/login")
async def auth_login(payload: LoginInput, request: Request, response: Response):
    email = (payload.email or "").lower().strip()
    # brute force throttle: use X-Forwarded-For (first hop) when behind proxy
    xff = request.headers.get("x-forwarded-for", "")
    client_ip = xff.split(",")[0].strip() if xff else (request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown"))
    key = f"{client_ip}::{email}"
    now = datetime.now(timezone.utc)
    attempts_doc = await db.login_attempts.find_one({"_id": key}) or {}
    fails = attempts_doc.get("fails", [])
    fails = [f for f in fails if datetime.fromisoformat(f) > now - timedelta(minutes=15)]
    if len(fails) >= 5:
        raise HTTPException(429, "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.")

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc or not verify_password(payload.password, user_doc.get("password_hash", "")):
        fails.append(now.isoformat())
        await db.login_attempts.update_one({"_id": key}, {"$set": {"fails": fails}}, upsert=True)
        raise HTTPException(401, "Email atau password salah")

    status = user_doc.get("status", "active")
    if status == "pending":
        raise HTTPException(403, "Akun belum disetujui admin")
    if status == "disabled":
        raise HTTPException(403, "Akun dinonaktifkan")

    await db.login_attempts.delete_one({"_id": key})
    user_id = user_doc["user_id"]
    await _issue_session(user_id, response)
    role = user_doc.get("role") or "talent"
    if role == "member":
        role = "pm"
    return {"user_id": user_id, "email": user_doc["email"], "name": user_doc.get("name", ""), "picture": user_doc.get("picture", ""), "role": role, "status": status}

@api_router.post("/auth/invite")
async def auth_invite(payload: InviteInput, admin: User = Depends(require_admin)):
    email = (payload.email or "").lower().strip()
    if not email or not payload.password or len(payload.password) < 6:
        raise HTTPException(400, "Email & password (min 6 karakter) wajib")
    if payload.role not in ("admin", "pm", "talent"):
        raise HTTPException(400, "Role tidak valid")
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(400, "Email sudah terdaftar")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": payload.name or email.split("@")[0],
        "picture": "",
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "status": "active",
        "auth_provider": "password",
        "invited_by": admin.email,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"user_id": user_id, "email": email, "role": payload.role, "status": "active"}

# ---------- User management (admin only) ----------
class UserPatch(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None

@api_router.get("/users")
async def list_users(admin: User = Depends(require_admin)):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        if d.get("role") == "member":
            d["role"] = "pm"
        d.setdefault("status", "active")
        d.setdefault("auth_provider", "google")
    return docs

@api_router.patch("/users/{user_id}")
async def patch_user(user_id: str, payload: UserPatch, admin: User = Depends(require_admin)):
    existing = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "User not found")
    upd = {}
    if payload.name is not None:
        upd["name"] = payload.name
    if payload.role is not None:
        if payload.role not in ("admin", "pm", "talent"):
            raise HTTPException(400, "Role tidak valid")
        upd["role"] = payload.role
    if payload.status is not None:
        if payload.status not in ("active", "pending", "disabled"):
            raise HTTPException(400, "Status tidak valid")
        upd["status"] = payload.status
    if payload.password is not None:
        if len(payload.password) < 6:
            raise HTTPException(400, "Password min 6 karakter")
        upd["password_hash"] = hash_password(payload.password)
        if not existing.get("auth_provider"):
            upd["auth_provider"] = "password"
    if upd:
        await db.users.update_one({"user_id": user_id}, {"$set": upd})
    # If status disabled, invalidate all sessions
    if payload.status == "disabled":
        await db.user_sessions.delete_many({"user_id": user_id})
    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return doc

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(require_admin)):
    if user_id == admin.user_id:
        raise HTTPException(400, "Tidak bisa hapus diri sendiri")
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    return {"ok": True}

# ---------- Orders CRUD ----------
@api_router.get("/orders", response_model=List[Order])
async def list_orders(user: User = Depends(get_current_user)):
    docs = await db.orders.find({}, {"_id": 0}).sort("tanggal", 1).to_list(5000)
    return [Order(**d) for d in docs]

@api_router.post("/orders", response_model=Order)
async def create_order(payload: OrderInput, user: User = Depends(get_current_user)):
    data = payload.model_dump()
    if not data.get("folder_code") or not data.get("folder_code_manual"):
        data["folder_code"] = await generate_folder_code(data["tanggal"], data["platform"], data["klien"], data["project"])
        data["folder_code_manual"] = False
    # Folder code uniqueness check
    fc = (data.get("folder_code") or "").strip()
    if fc and await db.orders.find_one({"folder_code": fc}, {"_id": 0}):
        raise HTTPException(409, f"Folder code '{fc}' sudah dipakai. Harap gunakan kode lain.")
    order = Order(**data)
    doc = order.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.orders.insert_one(doc)
    await manager.broadcast({"type": "order.created", "order": order.model_dump(mode="json")})
    # Auto-create freelance artists for "Freelance" flagged artists
    await _sync_freelance_artists(order)
    # Auto-send Telegram "new order" notification
    try:
        s = await get_settings_doc()
        token = s.get("telegram_bot_token", "")
        chat_id = s.get("telegram_chat_id", "")
        thread_id = s.get("telegram_thread_id")
        if token and chat_id:
            msg = render_tg_template(s, "new", {
                "project": order.project, "klien": order.klien,
                "folder_code": order.folder_code, "deadline": order.deadline,
            })
            send_telegram(token, chat_id, msg, thread_id)
    except Exception as e:
        logger.warning(f"auto new-order telegram failed: {e}")
    return order

async def _sync_freelance_artists(order: "Order"):
    """For each artist flagged 'Freelance' in the order:
    - ensure a freelance_artists record exists
    - ensure a freelance_projects record exists linked (order_ref_id == order.id) for that artist
      Fee is split equally among all Freelance-flagged artists of the order.
    """
    try:
        import re
        artists = order.artists or []
        statuses = order.artist_statuses or []
        freelancers = [(n or "").strip() for i, n in enumerate(artists) if i < len(statuses) and (statuses[i] or "").lower() == "freelance" and (n or "").strip()]
        if not freelancers:
            return
        per_artist_fee = (float(order.fee_freelance or 0) / len(freelancers)) if freelancers else 0.0
        # Map order status → project status
        done_statuses = {"done", "delivered", "cancel", "cancle"}
        proj_status = "done" if (order.status or "").lower() in done_statuses else "in_progress"

        for name in freelancers:
            # 1) ensure artist
            safe = re.escape(name)
            artist_doc = await db.freelance_artists.find_one({"name": {"$regex": f"^{safe}$", "$options": "i"}}, {"_id": 0})
            if not artist_doc:
                artist_doc = {
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "bank": "BCA",
                    "rekening": "",
                    "phone": "",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "auto_created": True,
                }
                await db.freelance_artists.insert_one(artist_doc)
                logger.info(f"Auto-created freelance artist: {name}")
            # 2) ensure project record linked to this order
            existing_proj = await db.freelance_projects.find_one({"order_ref_id": order.id, "artist_id": artist_doc["id"]}, {"_id": 0})
            proj_data = {
                "artist_id": artist_doc["id"],
                "order_ref_id": order.id,
                "tanggal": order.tanggal or "",
                "project": order.project or "",
                "pic": order.marketer or "",
                "status_project": proj_status,
                "platform": order.platform or "",
                "fee": round(per_artist_fee),
            }
            if existing_proj:
                # update only order-driven fields, preserve pembayaran fields (dp/status_bayar/etc)
                await db.freelance_projects.update_one({"id": existing_proj["id"]}, {"$set": proj_data})
            else:
                new_proj = {
                    "id": str(uuid.uuid4()),
                    **proj_data,
                    "dp_amount": 0,
                    "dp_date": "",
                    "pelunasan_date": "",
                    "status_bayar": "unpaid",
                    "auto_created": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.freelance_projects.insert_one(new_proj)
                logger.info(f"Auto-created freelance project for {name}: {order.project}")
    except Exception as e:
        logger.warning(f"freelance sync error: {e}")

@api_router.put("/orders/{order_id_uuid}", response_model=Order)
async def update_order(order_id_uuid: str, payload: OrderInput, user: User = Depends(get_current_user)):
    existing = await db.orders.find_one({"id": order_id_uuid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Order not found")
    update_data = payload.model_dump()
    # If user supplied manual folder code, keep it
    if update_data.get("folder_code_manual") and update_data.get("folder_code"):
        pass
    elif (existing.get("platform") != update_data.get("platform")
        or existing.get("tanggal") != update_data.get("tanggal")
        or existing.get("klien") != update_data.get("klien")
        or existing.get("project") != update_data.get("project")):
        date_compact = update_data["tanggal"].replace("-", "")[2:] if update_data.get("tanggal") else "000000"
        code = PLATFORM_CODES.get(update_data.get("platform"), "ETC")
        existing_count = await db.orders.count_documents({
            "tanggal": update_data["tanggal"],
            "platform": update_data["platform"],
            "id": {"$ne": order_id_uuid},
        })
        seq = existing_count + 1
        client_part = sanitize_upper(update_data.get("klien", "")).replace(" ", "")
        project_part = sanitize_upper(update_data.get("project", ""))
        update_data["folder_code"] = f"{date_compact}-{code}{seq:02d}-{client_part}-{project_part}"
        update_data["folder_code_manual"] = False
    else:
        update_data["folder_code"] = existing.get("folder_code", "")
    # Folder code uniqueness check (skip self)
    fc = (update_data.get("folder_code") or "").strip()
    if fc and await db.orders.find_one({"folder_code": fc, "id": {"$ne": order_id_uuid}}, {"_id": 0}):
        raise HTTPException(409, f"Folder code '{fc}' sudah dipakai. Harap gunakan kode lain.")
    await db.orders.update_one({"id": order_id_uuid}, {"$set": update_data})
    merged = {**existing, **update_data}
    order = Order(**merged)
    await manager.broadcast({"type": "order.updated", "order": order.model_dump(mode="json")})
    await _sync_freelance_artists(order)
    return order

# ---------- Telegram notify per-order ----------
class NotifyInput(BaseModel):
    type: str  # "new" | "reminder" | "warning" | "custom"

@api_router.post("/orders/{order_id_uuid}/notify")
async def notify_order(order_id_uuid: str, payload: NotifyInput, user: User = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id_uuid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    s = await get_settings_doc()
    token = s.get("telegram_bot_token", "")
    chat_id = s.get("telegram_chat_id", "")
    if not token or not chat_id:
        raise HTTPException(400, "Telegram belum dikonfigurasi")
    # compute days remaining
    try:
        deadline_dt = datetime.fromisoformat(o["deadline"]).replace(tzinfo=timezone.utc).replace(hour=23, minute=59)
        days_left = max(0, (deadline_dt - datetime.now(timezone.utc)).days)
    except Exception:
        days_left = "?"
    common_vars = {
        "project": o["project"],
        "klien": o["klien"],
        "folder_code": o.get("folder_code", ""),
        "deadline": o["deadline"],
        "days_left": days_left,
    }
    t = payload.type
    kind = t if t in ("new", "reminder", "warning", "custom") else "custom"
    msg = render_tg_template(s, kind, common_vars)
    ok = send_telegram(token, chat_id, msg, s.get("telegram_thread_id"))
    if not ok:
        raise HTTPException(500, "Gagal kirim Telegram")
    return {"ok": True, "type": t, "days_left": days_left}

@api_router.delete("/orders/{order_id_uuid}")
async def delete_order(order_id_uuid: str, user: User = Depends(get_current_user)):
    res = await db.orders.delete_one({"id": order_id_uuid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Order not found")
    await manager.broadcast({"type": "order.deleted", "id": order_id_uuid})
    return {"ok": True}

@api_router.patch("/orders/{order_id_uuid}/reassign", response_model=Order)
async def reassign_order(order_id_uuid: str, payload: ReassignInput, user: User = Depends(get_current_user)):
    existing = await db.orders.find_one({"id": order_id_uuid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Order not found")
    update = {}
    if payload.artists is not None:
        update["artists"] = payload.artists
    if payload.status is not None:
        update["status"] = payload.status
    if update:
        await db.orders.update_one({"id": order_id_uuid}, {"$set": update})
        existing.update(update)
    order = Order(**existing)
    await manager.broadcast({"type": "order.updated", "order": order.model_dump(mode="json")})
    return order

class StatusPatch(BaseModel):
    status: str

@api_router.patch("/orders/{order_id_uuid}/status", response_model=Order)
async def patch_order_status(order_id_uuid: str, payload: StatusPatch, user: User = Depends(get_current_user)):
    existing = await db.orders.find_one({"id": order_id_uuid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one({"id": order_id_uuid}, {"$set": {"status": payload.status}})
    existing["status"] = payload.status
    order = Order(**existing)
    await manager.broadcast({"type": "order.updated", "order": order.model_dump(mode="json")})
    return order

# ---------- CSV Import ----------
class ImportRow(BaseModel):
    tanggal: str = ""
    deadline: str = ""
    klien: str = ""
    project: str = ""
    platform: str = "Direct"
    marketer: str = ""
    jenis: str = "Modeling"
    status: str = "modeling"
    artists: List[str] = []
    artist_statuses: List[str] = []
    value: float = 0
    currency: str = "USD"
    fee_freelance: float = 0
    paid: bool = False
    order_id: str = ""
    folder_code: str = ""
    catatan: str = ""

class ImportPayload(BaseModel):
    rows: List[ImportRow]

@api_router.post("/orders/import")
async def import_orders(payload: ImportPayload, user: User = Depends(get_current_user)):
    """Bulk-import orders. Rows that lack required fields (tanggal, klien, project) are skipped."""
    created = 0
    skipped = 0
    errors = []
    for idx, row in enumerate(payload.rows):
        if not row.tanggal or not row.klien or not row.project:
            skipped += 1
            errors.append({"row": idx, "reason": "missing tanggal/klien/project"})
            continue
        try:
            data = row.model_dump()
            # Auto-generate folder_code if blank
            if not data.get("folder_code"):
                data["folder_code"] = await generate_folder_code(data["tanggal"], data["platform"], data["klien"], data["project"])
                data["folder_code_manual"] = False
            else:
                data["folder_code_manual"] = True
            if not data.get("deadline"):
                data["deadline"] = data["tanggal"]
            order = Order(**data)
            doc = order.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.orders.insert_one(doc)
            await manager.broadcast({"type": "order.created", "order": order.model_dump(mode="json")})
            created += 1
        except Exception as e:
            skipped += 1
            errors.append({"row": idx, "reason": str(e)})
    return {"created": created, "skipped": skipped, "errors": errors[:20]}


# ---------- Earning & Freelance aggregations ----------
@api_router.get("/earnings")
async def get_earnings(user: User = Depends(get_current_user)):
    docs = await db.orders.find({}, {"_id": 0}).to_list(5000)
    settings = await get_settings_doc()
    rate = float(settings.get("exchange_rate") or 16000)
    by_month = {}
    by_platform_month = {}
    for o in docs:
        month = (o.get("tanggal") or "")[:7]
        if not month:
            continue
        raw_val = float(o.get("value") or 0)
        raw_fee = float(o.get("fee_freelance") or 0)
        cur = (o.get("currency") or "USD").upper()
        # Normalize to USD base
        val_usd = raw_val if cur == "USD" else raw_val / rate
        fee_usd = raw_fee / rate  # fee is always IDR
        plat = o.get("platform") or "Direct"
        paid = bool(o.get("paid"))
        m = by_month.setdefault(month, {"month": month, "gross": 0, "fee": 0, "net": 0, "paid": 0, "unpaid": 0, "count": 0})
        m["gross"] += val_usd
        m["fee"] += fee_usd
        m["net"] = m["gross"] - m["fee"]
        m["paid"] += val_usd if paid else 0
        m["unpaid"] += 0 if paid else val_usd
        m["count"] += 1

        key = f"{month}::{plat}"
        pm = by_platform_month.setdefault(key, {"month": month, "platform": plat, "gross": 0, "count": 0})
        pm["gross"] += val_usd
        pm["count"] += 1
    return {
        "base_currency": "USD",
        "exchange_rate": rate,
        "by_month": sorted(by_month.values(), key=lambda x: x["month"], reverse=True),
        "by_platform_month": sorted(by_platform_month.values(), key=lambda x: (x["month"], x["platform"]), reverse=True),
    }

@api_router.get("/freelance")
async def get_freelance(user: User = Depends(get_current_user)):
    docs = await db.orders.find({}, {"_id": 0}).to_list(5000)
    by_artist = {}
    rows = []
    for o in docs:
        fee = float(o.get("fee_freelance") or 0)
        artists = [a for a in (o.get("artists") or []) if a]
        month = (o.get("tanggal") or "")[:7]
        if not artists or fee <= 0:
            continue
        per = fee / len(artists)
        for a in artists:
            ba = by_artist.setdefault(a, {"artist": a, "total_fee": 0, "count": 0, "by_month": {}})
            ba["total_fee"] += per
            ba["count"] += 1
            ba["by_month"][month] = ba["by_month"].get(month, 0) + per
            rows.append({
                "order_id": o["id"],
                "tanggal": o.get("tanggal"),
                "artist": a,
                "klien": o.get("klien"),
                "project": o.get("project"),
                "status": o.get("status"),
                "fee_per_artist": per,
                "folder_code": o.get("folder_code", ""),
            })
    return {
        "by_artist": sorted(by_artist.values(), key=lambda x: x["total_fee"], reverse=True),
        "rows": sorted(rows, key=lambda x: x["tanggal"] or "", reverse=True),
    }

# ---------- Invoice tracking ----------
class InvoiceInput(BaseModel):
    klien: str
    invoice_no: str
    order_ids: List[str] = []
    total_display: float = 0
    currency_display: str = "USD"

@api_router.get("/invoices/next")
async def next_invoice(klien: str, user: User = Depends(get_current_user)):
    cnt = await db.invoices.count_documents({"klien": klien})
    return {"klien": klien, "next": cnt + 1}

@api_router.post("/invoices")
async def create_invoice_record(payload: InvoiceInput, user: User = Depends(get_current_user)):
    cnt = await db.invoices.count_documents({"klien": payload.klien})
    doc = {
        "id": str(uuid.uuid4()),
        "klien": payload.klien,
        "invoice_no": payload.invoice_no,
        "order_ids": payload.order_ids,
        "total_display": payload.total_display,
        "currency_display": payload.currency_display,
        "seq": cnt + 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.email,
    }
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/invoices")
async def list_invoices(user: User = Depends(get_current_user)):
    docs = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

# ---------- Weekly earnings (manual input) ----------
class WeeklyInput(BaseModel):
    targets: dict = {}  # { "magsika": 2000, "eirene": 2000 }
    groups: dict = {}   # { "magsika": [{week:1, fiverr,etsy,...}], "eirene": [...], "lolicharm_komunitas": [...] }

@api_router.get("/weekly/{yyyymm}")
async def get_weekly(yyyymm: str, user: User = Depends(get_current_user)):
    doc = await db.weekly_earnings.find_one({"_id": yyyymm})
    if not doc:
        return {"month": yyyymm, "targets": {"magsika": 2000, "eirene": 2000}, "groups": {"magsika": [], "eirene": [], "lolicharm_komunitas": []}}
    doc.pop("_id", None)
    doc["month"] = yyyymm
    return doc

@api_router.put("/weekly/{yyyymm}")
async def put_weekly(yyyymm: str, payload: WeeklyInput, user: User = Depends(get_current_user)):
    data = {"targets": payload.targets or {}, "groups": payload.groups or {}, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user.email}
    await db.weekly_earnings.update_one({"_id": yyyymm}, {"$set": data}, upsert=True)
    return {"month": yyyymm, **data}

# ---------- Freelance artist profiles & project payment tracking ----------
class FreelanceArtistInput(BaseModel):
    name: str
    bank: str = "BCA"
    rekening: str = ""
    phone: str = ""

class FreelanceProjectInput(BaseModel):
    artist_id: str
    tanggal: str = ""
    project: str = ""
    pic: str = ""
    status_project: str = "in_progress"  # "done" | "in_progress"
    platform: str = ""
    fee: float = 0
    dp_amount: float = 0
    dp_date: str = ""
    pelunasan_date: str = ""
    status_bayar: str = "unpaid"  # "paid" | "unpaid" | "dp_only"
    order_ref_id: str = ""

@api_router.get("/freelance/artists")
async def list_freelance_artists(user: User = Depends(get_current_user)):
    docs = await db.freelance_artists.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return docs

@api_router.post("/freelance/artists")
async def create_freelance_artist(payload: FreelanceArtistInput, user: User = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), **payload.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.freelance_artists.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/freelance/artists/{artist_id}")
async def update_freelance_artist(artist_id: str, payload: FreelanceArtistInput, user: User = Depends(get_current_user)):
    res = await db.freelance_artists.update_one({"id": artist_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Artist not found")
    doc = await db.freelance_artists.find_one({"id": artist_id}, {"_id": 0})
    return doc

@api_router.delete("/freelance/artists/{artist_id}")
async def delete_freelance_artist(artist_id: str, user: User = Depends(get_current_user)):
    await db.freelance_artists.delete_one({"id": artist_id})
    await db.freelance_projects.delete_many({"artist_id": artist_id})
    return {"ok": True}

@api_router.get("/freelance/projects")
async def list_freelance_projects(user: User = Depends(get_current_user), artist_id: Optional[str] = None, month: Optional[str] = None):
    q = {}
    if artist_id:
        q["artist_id"] = artist_id
    docs = await db.freelance_projects.find(q, {"_id": 0}).sort("tanggal", -1).to_list(2000)
    if month:
        docs = [d for d in docs if (d.get("tanggal") or "")[:7] == month]
    return docs

@api_router.post("/freelance/projects")
async def create_freelance_project(payload: FreelanceProjectInput, user: User = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), **payload.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.freelance_projects.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/freelance/projects/{project_id}")
async def update_freelance_project(project_id: str, payload: FreelanceProjectInput, user: User = Depends(get_current_user)):
    res = await db.freelance_projects.update_one({"id": project_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Project not found")
    doc = await db.freelance_projects.find_one({"id": project_id}, {"_id": 0})
    return doc

@api_router.delete("/freelance/projects/{project_id}")
async def delete_freelance_project(project_id: str, user: User = Depends(get_current_user)):
    await db.freelance_projects.delete_one({"id": project_id})
    return {"ok": True}

# ---------- To-Do tasks ----------
class TaskInput(BaseModel):
    title: str
    date: str  # YYYY-MM-DD
    assignee: str = ""
    assignee_type: str = "tim"  # "tim" | "freelance"
    folder_code: str = ""
    order_id: str = ""
    status: str = "pending"  # pending | in_progress | done | failed
    notes: str = ""

class TaskPatch(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    assignee: Optional[str] = None
    assignee_type: Optional[str] = None
    notes: Optional[str] = None

async def _auto_generate_tasks(date: str):
    """For each active order (status != done/delivered/cancel), ensure a task exists for {date} per artist."""
    done_like = {"done", "delivered", "cancel", "cancle"}
    orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    created = 0
    for o in orders:
        if (o.get("status") or "").lower() in done_like:
            continue
        artists = o.get("artists") or []
        statuses = o.get("artist_statuses") or []
        if not artists:
            # single unassigned task linked to order
            artists = [o.get("marketer") or "Tim"]
            statuses = ["Tim"]
        for i, name in enumerate(artists):
            if not name or not name.strip():
                continue
            atype = "freelance" if (statuses[i] if i < len(statuses) else "Tim").lower() == "freelance" else "tim"
            title = f"{o.get('project', '')} — {name.strip()}"
            existing = await db.tasks.find_one({"date": date, "order_id": o["id"], "assignee": name.strip()}, {"_id": 0})
            if existing:
                continue
            doc = {
                "id": str(uuid.uuid4()),
                "title": title,
                "date": date,
                "assignee": name.strip(),
                "assignee_type": atype,
                "folder_code": o.get("folder_code", ""),
                "order_id": o["id"],
                "status": "pending",
                "started_at": "",
                "completed_at": "",
                "duration_seconds": 0,
                "auto_created": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.tasks.insert_one(doc)
            created += 1
    return created

@api_router.get("/tasks/{date}")
async def get_tasks(date: str, auto: bool = True, user: User = Depends(get_current_user)):
    """Get tasks for a date. If auto=True and date==today and no tasks exist yet, auto-generate from active orders."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if auto and date == today:
        count = await db.tasks.count_documents({"date": date})
        if count == 0:
            await _auto_generate_tasks(date)
    docs = await db.tasks.find({"date": date}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    return docs

@api_router.post("/tasks")
async def create_task(payload: TaskInput, user: User = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "started_at": "",
        "completed_at": "",
        "duration_seconds": 0,
        "auto_created": False,
        "created_by": user.email,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tasks.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.patch("/tasks/{task_id}")
async def patch_task(task_id: str, payload: TaskPatch, user: User = Depends(get_current_user)):
    existing = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Task not found")
    # Talent allowed to update status/notes for any task (per user req).
    # Edit title/assignee/assignee_type still restricted to admin/pm.
    if user.role == "talent":
        if payload.title is not None or payload.assignee is not None or payload.assignee_type is not None:
            raise HTTPException(403, "Talent hanya bisa update status & notes")
    upd = {}
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    if payload.status is not None:
        cur = existing.get("status", "pending")
        new = payload.status
        if new not in ("pending", "in_progress", "done", "failed"):
            raise HTTPException(400, "Status tidak valid")
        upd["status"] = new
        # Accumulated elapsed timer
        elapsed = int(existing.get("elapsed_seconds") or 0)
        if cur == "in_progress" and existing.get("started_at"):
            try:
                start_dt = datetime.fromisoformat(existing["started_at"])
                elapsed += int((now - start_dt).total_seconds())
            except Exception:
                pass

        if new == "in_progress" and cur != "in_progress":
            upd["started_at"] = now_iso
            upd["elapsed_seconds"] = elapsed
        elif new == "in_progress" and cur == "in_progress":
            pass  # already running
        elif new == "pending":
            # Pause but DON'T reset accumulated time
            upd["started_at"] = ""
            upd["elapsed_seconds"] = elapsed
        elif new == "done":
            upd["started_at"] = ""
            upd["completed_at"] = now_iso
            upd["elapsed_seconds"] = elapsed
            upd["duration_seconds"] = elapsed  # mirrored for compat
        elif new == "failed":
            upd["started_at"] = ""
            upd["elapsed_seconds"] = elapsed
    if payload.title is not None:
        upd["title"] = payload.title
    if payload.assignee is not None:
        upd["assignee"] = payload.assignee
    if payload.assignee_type is not None:
        upd["assignee_type"] = payload.assignee_type
    if payload.notes is not None:
        upd["notes"] = payload.notes
    if upd:
        await db.tasks.update_one({"id": task_id}, {"$set": upd})
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return doc

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: User = Depends(require_admin_or_pm)):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}

# ---------- Performance ----------
@api_router.get("/performance")
async def get_performance(month: Optional[str] = None, user: User = Depends(get_current_user)):
    """Compute per-member performance based on tasks. month=YYYY-MM filter optional."""
    q = {"status": "done"}
    if month:
        q["date"] = {"$regex": f"^{month}"}
    done_tasks = await db.tasks.find(q, {"_id": 0}).to_list(5000)

    # all tasks (for pending/in_progress count)
    q_all = {}
    if month:
        q_all["date"] = {"$regex": f"^{month}"}
    all_tasks = await db.tasks.find(q_all, {"_id": 0}).to_list(10000)

    # contribution credits from orders Done in the month (by artist_contributions %)
    order_q = {"status": {"$in": ["done", "delivered"]}}
    if month:
        order_q["tanggal"] = {"$regex": f"^{month}"}
    done_orders = await db.orders.find(order_q, {"_id": 0}).to_list(5000)

    per_member = {}
    def bucket(name: str):
        if name not in per_member:
            per_member[name] = {"assignee": name, "tasks_done": 0, "tasks_pending": 0, "tasks_in_progress": 0, "total_duration_sec": 0, "timed_task_count": 0, "credit_points": 0.0}
        return per_member[name]

    for t in done_tasks:
        a = (t.get("assignee") or "").strip()
        if not a:
            continue
        b = bucket(a)
        b["tasks_done"] += 1
        if t.get("duration_seconds"):
            b["total_duration_sec"] += t["duration_seconds"]
            b["timed_task_count"] += 1

    for t in all_tasks:
        a = (t.get("assignee") or "").strip()
        if not a:
            continue
        if t.get("status") == "pending":
            bucket(a)["tasks_pending"] += 1
        elif t.get("status") == "in_progress":
            bucket(a)["tasks_in_progress"] += 1

    for o in done_orders:
        artists = o.get("artists") or []
        contribs = o.get("artist_contributions") or []
        for i, name in enumerate(artists):
            pct = contribs[i] if i < len(contribs) else (100 / len(artists) if artists else 0)
            b = bucket(name.strip())
            b["credit_points"] += float(pct or 0) / 100.0

    # compute avg speed
    rows = []
    for name, b in per_member.items():
        avg = (b["total_duration_sec"] / b["timed_task_count"] / 3600) if b["timed_task_count"] else 0
        rows.append({
            **b,
            "avg_speed_hours": round(avg, 2),
        })
    rows.sort(key=lambda r: (r["tasks_done"], r["credit_points"]), reverse=True)
    # Talent: scope to self
    if user.role == "talent":
        my_name = (user.name or "").lower()
        my_handle = (user.email or "").split("@")[0].lower()
        rows = [r for r in rows if r["assignee"].lower() in (my_name, my_handle)]
    return {"month": month or "all", "members": rows}



# ---------- Settings ----------
@api_router.get("/settings")
async def get_settings(user: User = Depends(require_admin)):
    doc = await get_settings_doc()
    doc.pop("_id", None)
    return doc

@api_router.put("/settings")
async def update_settings(payload: SettingsInput, user: User = Depends(require_admin)):
    update = payload.model_dump()
    update["allowed_emails"] = [e.lower().strip() for e in update.get("allowed_emails", []) if e and e.strip()]
    await db.settings.update_one({"_id": "global"}, {"$set": update}, upsert=True)
    return {**update}

@api_router.post("/settings/test-telegram")
async def test_telegram(user: User = Depends(require_admin)):
    s = await get_settings_doc()
    token = s.get("telegram_bot_token", "")
    chat_id = s.get("telegram_chat_id", "")
    if not token or not chat_id:
        raise HTTPException(400, "Telegram belum dikonfigurasi")
    ok = send_telegram(token, chat_id, "✅ Magsika Studio: Test reminder Telegram OK!", s.get("telegram_thread_id"))
    if not ok:
        raise HTTPException(400, "Gagal kirim pesan test")
    return {"ok": True}

@api_router.get("/users")
async def list_users(user: User = Depends(require_admin)):
    docs = await db.users.find({}, {"_id": 0, "user_id": 1, "email": 1, "name": 1, "role": 1, "picture": 1}).to_list(500)
    return docs

# ---------- Telegram Reminder ----------
REMINDER_THRESHOLDS = [
    ("5d", timedelta(days=5)),
    ("3d", timedelta(days=3)),
    ("1d", timedelta(days=1)),
]
DONE_STATUSES = {"done", "delivered", "cancel", "cancle"}

def send_telegram(token: str, chat_id: str, text: str, thread_id: Optional[int] = None) -> bool:
    if not token or not chat_id:
        return False
    try:
        data = {"chat_id": chat_id, "text": text}
        if thread_id:
            data["message_thread_id"] = thread_id
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data,
            timeout=15,
        )
        if r.status_code != 200:
            logger.warning(f"Telegram non-200: {r.status_code} {r.text[:200]}")
        return r.status_code == 200
    except Exception as e:
        logger.warning(f"Telegram error: {e}")
        return False

async def reminder_loop():
    while True:
        try:
            settings_doc = await get_settings_doc()
            if not settings_doc.get("reminders_enabled", True):
                await asyncio.sleep(600); continue
            token = settings_doc.get("telegram_bot_token", "")
            chat_id = settings_doc.get("telegram_chat_id", "")
            thread_id = settings_doc.get("telegram_thread_id")
            if not token or not chat_id:
                await asyncio.sleep(600); continue

            now = datetime.now(timezone.utc)
            orders_list = await db.orders.find({}, {"_id": 0}).to_list(5000)

            for o in orders_list:
                if (o.get("status") or "").lower() in DONE_STATUSES:
                    continue
                try:
                    deadline_dt = datetime.fromisoformat(o["deadline"]).replace(tzinfo=timezone.utc).replace(hour=23, minute=59)
                except Exception:
                    continue
                remaining = deadline_dt - now
                # Negative remaining → overdue. Send "overdue" once per day.
                if remaining.total_seconds() < 0:
                    days_overdue = (-remaining.days) or 1
                    key = f"{o['id']}::overdue::{now.strftime('%Y-%m-%d')}"
                    sent = await db.sent_reminders.find_one({"_id": key})
                    if sent:
                        continue
                    common = (
                        f"📁 Project   : {o['project']}\n"
                        f"👤 Client    : {o['klien']}\n"
                        f"📂 Folder    : {o.get('folder_code', '')}\n"
                        f"📅 Deadline  : {o['deadline']}\n"
                    )
                    msg = f"🚨 OVERDUE — DEADLINE LEWAT\n\n{common}❗ Sudah lewat {days_overdue} hari! Status: {o.get('status', '-')}. Harap segera diselesaikan."
                    ok = send_telegram(token, chat_id, msg, thread_id)
                    if ok:
                        await db.sent_reminders.insert_one({"_id": key, "sent_at": now.isoformat()})
                        logger.info(f"Telegram overdue sent: {key}")
                    continue
                for label, threshold in REMINDER_THRESHOLDS:
                    # Match within a 1-hour window of threshold to allow loop interval slack
                    if abs((remaining - threshold).total_seconds()) > 3600:
                        continue
                    key = f"{o['id']}::{label}"
                    sent = await db.sent_reminders.find_one({"_id": key})
                    if sent:
                        continue
                    vars_ = {
                        "project": o['project'],
                        "klien": o['klien'],
                        "folder_code": o.get('folder_code', ''),
                        "deadline": o['deadline'],
                        "days_left": threshold.days,
                    }
                    kind = "warning" if label == "1d" else "reminder"
                    msg = render_tg_template(settings_doc, kind, vars_)
                    ok = send_telegram(token, chat_id, msg, thread_id)
                    if ok:
                        await db.sent_reminders.insert_one({"_id": key, "sent_at": now.isoformat()})
                        logger.info(f"Telegram reminder sent: {key}")
        except Exception as e:
            logger.exception(f"reminder_loop error: {e}")
        await asyncio.sleep(1800)  # check every 30 minutes

async def daily_task_generator_loop():
    """Every hour, ensure today has auto-generated tasks. Also auto-fail tasks from previous days that are not done."""
    while True:
        try:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            # Auto-fail any task from a past date that's still pending or in_progress
            res = await db.tasks.update_many(
                {"date": {"$lt": today}, "status": {"$in": ["pending", "in_progress"]}},
                {"$set": {"status": "failed", "started_at": ""}},
            )
            if res.modified_count:
                logger.info(f"Auto-failed {res.modified_count} expired tasks from past dates")
            count = await db.tasks.count_documents({"date": today})
            if count == 0:
                n = await _auto_generate_tasks(today)
                if n:
                    logger.info(f"Auto-generated {n} tasks for {today}")
        except Exception as e:
            logger.exception(f"daily_task_generator_loop error: {e}")
        await asyncio.sleep(3600)  # every hour
        await asyncio.sleep(600)

# ---------- WebSocket ----------
@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:
        await manager.disconnect(ws)

# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"message": "Magsika Studio Admin API"}

# ---------- Sample seed (idempotent) ----------
SAMPLE_ORDERS = [
    {"tanggal": "2026-04-01", "deadline": "2026-04-15", "klien": "Studio Animax", "project": "Character Ranger Full Body 3D", "jenis": "Full Pipeline", "status": "done", "artists": ["Budi", "Sari"], "value": 3500000, "paid": True, "platform": "Direct", "marketer": "Novita", "order_id": "A-001", "fee_freelance": 1200000},
    {"tanggal": "2026-04-03", "deadline": "2026-04-18", "klien": "VtuberCorp", "project": "Rigging Vtuber Sakura", "jenis": "Rigging", "status": "done", "artists": ["Budi"], "value": 1800000, "paid": False, "platform": "Fiverr Magsika", "marketer": "Novita", "order_id": "FVR-8823", "fee_freelance": 600000},
    {"tanggal": "2026-04-05", "deadline": "2026-04-22", "klien": "NeoAnim", "project": "Animasi Cutscene Game", "jenis": "Animation", "status": "rendering", "artists": ["Sari", "Joko"], "value": 5000000, "paid": False, "platform": "Direct", "marketer": "Ivo", "order_id": "A-002", "fee_freelance": 1800000},
    {"tanggal": "2026-04-07", "deadline": "2026-04-20", "klien": "Studio Animax", "project": "Prop Modeling Sword Pack", "jenis": "Modeling", "status": "teksturing", "artists": ["Joko"], "value": 1200000, "paid": False, "platform": "Fiverr Magsika", "marketer": "Ivo", "order_id": "FVR-8901", "fee_freelance": 400000},
    {"tanggal": "2026-04-08", "deadline": "2026-04-25", "klien": "VtuberCorp", "project": "Rigging Vtuber Luna", "jenis": "Rigging", "status": "modeling", "artists": ["Budi", "Sari"], "value": 2000000, "paid": False, "platform": "Fiverr Eirene", "marketer": "Novita", "order_id": "EIR-112", "fee_freelance": 700000},
    {"tanggal": "2026-04-10", "deadline": "2026-04-28", "klien": "PixelDream", "project": "Environment Kota Fantasi", "jenis": "Modeling", "status": "modeling", "artists": ["Joko"], "value": 4500000, "paid": False, "platform": "Direct", "marketer": "Ivo", "order_id": "A-003", "fee_freelance": 1500000},
    {"tanggal": "2026-04-12", "deadline": "2026-04-19", "klien": "NeoAnim", "project": "Revisi Cutscene Chapter 2", "jenis": "Revisi", "status": "revisi", "artists": ["Sari"], "value": 500000, "paid": True, "platform": "Direct", "marketer": "Novita", "order_id": "A-004", "fee_freelance": 200000},
    {"tanggal": "2026-04-14", "deadline": "2026-04-30", "klien": "PixelDream", "project": "Character Villain 3D", "jenis": "Full Pipeline", "status": "rigging", "artists": ["Budi", "Joko", "Sari"], "value": 6000000, "paid": False, "platform": "Etsy Lolicharm", "marketer": "Novita", "order_id": "ETSY-55", "fee_freelance": 2100000},
    {"tanggal": "2026-04-16", "deadline": "2026-04-26", "klien": "IndieGame", "project": "Creature Pack Slime", "jenis": "Modeling", "status": "teksturing", "artists": ["Joko"], "value": 900000, "paid": False, "platform": "Komunitas", "marketer": "Ivo", "order_id": "LTK-09", "fee_freelance": 300000},
    {"tanggal": "2026-04-18", "deadline": "2026-04-24", "klien": "Studio Animax", "project": "Texturing Karakter Ranger", "jenis": "Texturing", "status": "done", "artists": ["Sari"], "value": 800000, "paid": False, "platform": "Direct", "marketer": "Novita", "order_id": "A-005", "fee_freelance": 280000},
    {"tanggal": "2026-04-20", "deadline": "2026-04-28", "klien": "VtuberCorp", "project": "Toggle Outfit Sakura", "jenis": "Rigging", "status": "delivered", "artists": ["Budi"], "value": 600000, "paid": False, "platform": "Fiverr Magsika", "marketer": "Ivo", "order_id": "FVR-9005", "fee_freelance": 200000},
    {"tanggal": "2026-04-22", "deadline": "2026-04-30", "klien": "IndieGame", "project": "UI Asset 3D Button Pack", "jenis": "Modeling", "status": "modeling", "artists": ["Joko", "Sari"], "value": 1100000, "paid": False, "platform": "Fiverr Magsika", "marketer": "Novita", "order_id": "FVR-9122", "fee_freelance": 380000},
]

@app.on_event("startup")
async def on_startup():
    count = await db.orders.count_documents({})
    if count == 0:
        for s in SAMPLE_ORDERS:
            fc = await generate_folder_code(s["tanggal"], s["platform"], s["klien"], s["project"])
            o = Order(**{**s, "folder_code": fc})
            doc = o.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.orders.insert_one(doc)
        logger.info(f"Seeded {len(SAMPLE_ORDERS)} sample orders")
    # backfill missing fields on existing docs
    await db.orders.update_many({"platform": {"$exists": False}}, {"$set": {"platform": "Direct", "marketer": "", "order_id": "", "folder_code": "", "fee_freelance": 0}})
    await db.users.update_many({"role": "member"}, {"$set": {"role": "pm"}})
    await db.users.update_many({"status": {"$exists": False}}, {"$set": {"status": "active"}})
    await db.users.update_many({"auth_provider": {"$exists": False}}, {"$set": {"auth_provider": "google"}})
    # regenerate missing folder codes
    missing = await db.orders.find({"$or": [{"folder_code": ""}, {"folder_code": {"$exists": False}}]}, {"_id": 0}).to_list(2000)
    for o in missing:
        fc = await generate_folder_code(o.get("tanggal", ""), o.get("platform", "Direct"), o.get("klien", ""), o.get("project", ""))
        await db.orders.update_one({"id": o["id"]}, {"$set": {"folder_code": fc}})
    await get_settings_doc()
    # MongoDB indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.tasks.create_index([("date", 1), ("order_id", 1), ("assignee", 1)])
    except Exception as e:
        logger.warning(f"index create warn: {e}")
    asyncio.create_task(reminder_loop())
    asyncio.create_task(daily_task_generator_loop())
    logger.info("Reminder & daily-task loops started")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
