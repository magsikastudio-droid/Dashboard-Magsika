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
- ✅ Email whitelist (admin-managed via Settings UI). First user auto-admin.
- ✅ Drag-and-drop on Board (per Artist / per Status view toggle).
- ✅ Reminder scheduler (WA Fonnte at iter 2, replaced with Telegram at iter 3).
- ✅ Tested 27/27 pass.

## Implemented (iter 3 — major revision)
- ✅ Order model extended: `platform`, `marketer`, `order_id` (manual), `folder_code` (auto), `fee_freelance`
- ✅ Folder code generator: `YYMMDD-CODE##-CLIENT-PROJECT` with per-platform-per-date seq. Platform codes: MGSIKA / EIRENE / LLCHRM / DIRECT / LTK.
- ✅ Expanded STATUS (17 opts): need designer, modeling, teksturing, cut&key, waiting file, articulate, revisi, rigging, pending, ready to send, rendering, coloring 3D Print, animation, waiting feedback, delivered, done, cancel.
- ✅ Dashboard month filter (default current month) + per-platform breakdown.
- ✅ Orders default filter = current month; done+past-month orders auto-hidden (archived).
- ✅ Per-row "Buat Invoice" button → `/invoice?orderId=xxx` pre-selects that order.
- ✅ Invoice page: search (project/klien/folder), multi-select candidates, per-project invoice.
- ✅ Board: active columns + "Selesai bulan ini" separate section.
- ✅ NEW Archive page (rekening koran, CSV export).
- ✅ NEW Earning page: per-month + per-platform pivot with gross/fee/net.
- ✅ NEW Freelance page: per-artist fee aggregation (fee dibagi rata).
- ✅ Telegram reminder (replace Fonnte): `/api/settings/test-telegram` endpoint + live test button. Token & chat_id seeded from .env.
- ✅ Tested 15/15 pytest + frontend Playwright 100% iter3 flows verified.

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
