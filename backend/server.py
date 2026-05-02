from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import asyncio
import json
import requests
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Set
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Models ----------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tanggal: str  # ISO date YYYY-MM-DD
    deadline: str
    klien: str
    project: str
    jenis: str  # Modeling, Rigging, Animation, Texturing, Full Pipeline, Revisi
    status: str  # Modeling, Rigging, Texturing, Rendering, Delivery, Done
    artists: List[str] = []
    value: float = 0
    paid: bool = False
    catatan: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderInput(BaseModel):
    tanggal: str
    deadline: str
    klien: str
    project: str
    jenis: str
    status: str = "Modeling"
    artists: List[str] = []
    value: float = 0
    paid: bool = False
    catatan: str = ""

# ---------- Auth helpers ----------
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
    return User(**user_doc)

# ---------- WebSocket Manager ----------
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

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {
            "name": data.get("name", existing.get("name")),
            "picture": data.get("picture", existing.get("picture")),
        }})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
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

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )
    return {
        "user_id": user_id,
        "email": email,
        "name": data.get("name", ""),
        "picture": data.get("picture", ""),
    }

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

# ---------- Orders CRUD ----------
@api_router.get("/orders", response_model=List[Order])
async def list_orders(user: User = Depends(get_current_user)):
    docs = await db.orders.find({}, {"_id": 0}).sort("tanggal", 1).to_list(2000)
    return [Order(**d) for d in docs]

@api_router.post("/orders", response_model=Order)
async def create_order(payload: OrderInput, user: User = Depends(get_current_user)):
    order = Order(**payload.model_dump())
    doc = order.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.orders.insert_one(doc)
    await manager.broadcast({"type": "order.created", "order": order.model_dump(mode="json")})
    return order

@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, payload: OrderInput, user: User = Depends(get_current_user)):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Order not found")
    update_data = payload.model_dump()
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    merged = {**existing, **update_data}
    order = Order(**merged)
    await manager.broadcast({"type": "order.updated", "order": order.model_dump(mode="json")})
    return order

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user: User = Depends(get_current_user)):
    res = await db.orders.delete_one({"id": order_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Order not found")
    await manager.broadcast({"type": "order.deleted", "id": order_id})
    return {"ok": True}

# ---------- WebSocket ----------
@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Keep alive — accept pings
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
    {"tanggal": "2026-04-01", "deadline": "2026-04-15", "klien": "Studio Animax", "project": "Character Ranger Full Body 3D", "jenis": "Full Pipeline", "status": "Done", "artists": ["Budi", "Sari"], "value": 3500000, "paid": True, "catatan": ""},
    {"tanggal": "2026-04-03", "deadline": "2026-04-18", "klien": "VtuberCorp", "project": "Rigging Vtuber Sakura", "jenis": "Rigging", "status": "Done", "artists": ["Budi"], "value": 1800000, "paid": False, "catatan": ""},
    {"tanggal": "2026-04-05", "deadline": "2026-04-22", "klien": "NeoAnim", "project": "Animasi Cutscene Game", "jenis": "Animation", "status": "Rendering", "artists": ["Sari", "Joko"], "value": 5000000, "paid": False, "catatan": ""},
    {"tanggal": "2026-04-07", "deadline": "2026-04-20", "klien": "Studio Animax", "project": "Prop Modeling Sword Pack", "jenis": "Modeling", "status": "Texturing", "artists": ["Joko"], "value": 1200000, "paid": False, "catatan": ""},
    {"tanggal": "2026-04-08", "deadline": "2026-04-25", "klien": "VtuberCorp", "project": "Rigging Vtuber Luna", "jenis": "Rigging", "status": "Modeling", "artists": ["Budi", "Sari"], "value": 2000000, "paid": False, "catatan": ""},
    {"tanggal": "2026-04-10", "deadline": "2026-04-28", "klien": "PixelDream", "project": "Environment Kota Fantasi", "jenis": "Modeling", "status": "Modeling", "artists": ["Joko"], "value": 4500000, "paid": False, "catatan": ""},
    {"tanggal": "2026-04-12", "deadline": "2026-04-19", "klien": "NeoAnim", "project": "Revisi Cutscene Chapter 2", "jenis": "Revisi", "status": "Done", "artists": ["Sari"], "value": 500000, "paid": True, "catatan": ""},
    {"tanggal": "2026-04-14", "deadline": "2026-04-30", "klien": "PixelDream", "project": "Character Villain 3D", "jenis": "Full Pipeline", "status": "Rigging", "artists": ["Budi", "Joko", "Sari"], "value": 6000000, "paid": False, "catatan": ""},
    {"tanggal": "2026-04-16", "deadline": "2026-04-26", "klien": "IndieGame", "project": "Creature Pack Slime", "jenis": "Modeling", "status": "Texturing", "artists": ["Joko"], "value": 900000, "paid": False, "catatan": ""},
    {"tanggal": "2026-04-18", "deadline": "2026-04-24", "klien": "Studio Animax", "project": "Texturing Karakter Ranger", "jenis": "Texturing", "status": "Done", "artists": ["Sari"], "value": 800000, "paid": False, "catatan": ""},
    {"tanggal": "2026-04-20", "deadline": "2026-04-28", "klien": "VtuberCorp", "project": "Toggle Outfit Sakura", "jenis": "Rigging", "status": "Delivery", "artists": ["Budi"], "value": 600000, "paid": False, "catatan": ""},
    {"tanggal": "2026-04-22", "deadline": "2026-04-30", "klien": "IndieGame", "project": "UI Asset 3D Button Pack", "jenis": "Modeling", "status": "Modeling", "artists": ["Joko", "Sari"], "value": 1100000, "paid": False, "catatan": ""},
]

@app.on_event("startup")
async def seed_sample():
    count = await db.orders.count_documents({})
    if count == 0:
        for s in SAMPLE_ORDERS:
            o = Order(**s)
            doc = o.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.orders.insert_one(doc)
        logger.info(f"Seeded {len(SAMPLE_ORDERS)} sample orders")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
