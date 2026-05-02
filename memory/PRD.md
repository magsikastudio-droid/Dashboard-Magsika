# Magsika Studio — Admin Order Dashboard

## Original Problem Statement
Saya punya website magsikastudio.com dan saya ingin membuat administrasi pencatatan order di web tersebut dengan page yang berbeda. Tampilannya seperti referensi (5 screenshot) tetapi font dan gaya yang lebih jelas, enak dibaca dan rapi. Real-time: jika tim mengedit, data langsung berubah di browser lain. magsikastudio.com memakai WordPress.

## User Choices
- Hosting: aplikasi terpisah, akan di-embed/iframe ke WordPress
- Auth: Emergent Google Auth
- Real-time: WebSocket
- Sample data: ya, isi dengan data dummy
- Invoice: print/save PDF via browser (Ctrl+P)

## Architecture
- **Backend**: FastAPI (port 8001 internal, /api prefix), MongoDB (test_database), WebSocket broadcast manager
- **Frontend**: React 19 + react-router 7 + Tailwind + shadcn/ui + sonner toasts
- **Fonts**: Plus Jakarta Sans (body), Space Grotesk (display), JetBrains Mono (labels/numbers)
- **Auth**: Emergent OAuth → session_token httpOnly cookie + DB session record (7-day expiry)
- **Real-time**: WebSocket /api/ws — broadcasts `order.created` / `order.updated` / `order.deleted` to all clients

## User Personas
- **Owner Magsika Studio**: kelola semua order, lihat dashboard ringkas, generate invoice
- **Tim/Artist (Budi, Sari, Joko)**: lihat board pekerjaan masing-masing, update status real-time
- **Admin**: tambah/edit/hapus order, mark lunas/belum

## Core Requirements (Static)
1. 4 halaman: Dashboard (KPI + per-klien), Orders (table CRUD + filter), Board (kanban per artist), Invoice (printable per klien/bulan)
2. Real-time sync antar tim via WebSocket
3. Login Google untuk akses
4. Status order: Modeling, Rigging, Texturing, Rendering, Delivery, Done
5. Jenis pekerjaan: Modeling, Rigging, Animation, Texturing, Full Pipeline, Revisi
6. Tracking pembayaran (LUNAS / BELUM)
7. Highlight late deadline otomatis

## Implemented (2026-02-XX, iter 1)
- ✅ Backend: auth (`/api/auth/session`, `/api/auth/me`, `/api/auth/logout`)
- ✅ Backend: orders CRUD + WebSocket broadcast
- ✅ Backend: 12 sample orders seed (idempotent)
- ✅ Frontend: Login page + AuthCallback (race-condition-safe)
- ✅ Frontend: Dashboard, Orders, Board, Invoice
- ✅ Tested 100% pass

## Implemented (iter 2)
- ✅ Email whitelist (admin-managed via Settings UI). First user auto-admin. Backfill role='member' for legacy users.
- ✅ Drag-and-drop on Board with view-mode toggle (per Artist / per Status). Drag updates artist or status via PATCH /api/orders/{id}/reassign.
- ✅ WhatsApp reminder via Fonnte at 3 hari / 2 hari / 1 hari / 6 jam sebelum deadline. Background asyncio loop every 10 min, dedup via sent_reminders. Token + admin_wa configurable di Settings.
- ✅ Settings page (admin only): whitelist emails, list users, Fonnte config, toggle reminders.
- ✅ Tested 27/27 backend + frontend pass.

## Backlog (P0/P1/P2)
- **P1**: Drag-and-drop kanban board (move card → update status)
- **P1**: Server-side PNG export of invoice (currently relies on Ctrl+P)
- **P2**: Notifications (toast) saat order baru masuk via WebSocket dari user lain
- **P2**: Dark mode
- **P2**: Audit log (siapa edit apa, kapan)
- **P2**: Multi-currency / pajak
- **P2**: Allowed-email list untuk membatasi siapa yang bisa login Google

## Embed in WordPress
Tambahkan ke halaman WP (Custom HTML block):
```html
<iframe src="https://<preview-url>" style="width:100%;height:100vh;border:0" allow="clipboard-read; clipboard-write"></iframe>
```
Catatan: cookie httpOnly SameSite=None Secure sudah benar untuk iframe cross-origin.

## Next Tasks
1. Deploy ke production (custom domain seperti admin.magsikastudio.com)
2. Setup allowed-email list (whitelist akun Google tim)
3. Konfigurasi embed iframe di halaman WordPress
