# Magsika Studio — Admin Order Dashboard

## Original Problem Statement
Saya punya website magsikastudio.com dan saya ingin membuat administrasi pencatatan order di web tersebut dengan page yang berbeda. Tampilannya seperti referensi tetapi font dan gaya yang lebih jelas, enak dibaca dan rapi. Real-time: jika tim mengedit, data langsung berubah di browser lain. magsikastudio.com memakai WordPress.

## User Choices
- Hosting: aplikasi terpisah, akan di-embed/iframe ke WordPress
- Auth: Emergent Google Auth (whitelist via Settings)
- Real-time: WebSocket
- Sample data: data dummy seeded
- Invoice: print/save PDF via browser (Ctrl+P)

## Architecture
- **Backend**: FastAPI (port 8001 internal, /api prefix), MongoDB, WebSocket broadcast manager
- **Frontend**: React 19 + react-router 7 + Tailwind + shadcn/ui + sonner
- **Fonts**: Plus Jakarta Sans (body), Space Grotesk (display), JetBrains Mono (labels/numbers)
- **Auth**: Emergent OAuth → session_token httpOnly cookie + DB session record (7-day expiry)
- **Real-time**: WebSocket /api/ws — broadcasts order events
- **Currency**: Global USD/IDR toggle (CurrencyContext) with manual exchange rate (per-user localStorage + admin settings sync)

## Core Requirements
- Pages: Dashboard, Orders, Board, Invoice, Earning, Freelance, Archive, Settings
- Real-time sync via WebSocket
- Google login w/ admin whitelist
- 17 statuses, 10 jenis pekerjaan
- Tracking pembayaran (LUNAS/BELUM)
- Highlight late deadlines
- Telegram bot reminders + manual notify

## Implemented (iter 1-3, prior forks) ✅
- Auth, Orders CRUD, WebSocket, Drag-drop Board, Folder code generator
- Dashboard month filter, per-platform breakdown
- Invoice search/multi-select
- Earning page (per-month, per-platform)
- Freelance page (fee per artist)
- Telegram reminder loop + test endpoint
- Archive page

## Implemented (iter 4 — Tier 1, 2026-05-02) ✅
- ✅ Global USD/IDR currency toggle (CurrencyContext.jsx) wired across Dashboard / Earning / Invoice / Orders / OrderModal
- ✅ Manual exchange rate input in header (localStorage + admin sync)
- ✅ OrderModal: portal-rendered, scrollable, full backdrop blur (z-index 1000)
- ✅ Dynamic artist roles: Tim (no fee) vs Freelance (fee enabled). Mixed teams supported via parallel `artist_statuses` array.
- ✅ Deadline color coding on Orders table: <3 days RED, <5 days AMBER, done MUTED
- ✅ Manual Telegram notification buttons in OrderModal (4 types: new / reminder / warning H-1 / sisa hari custom)
- ✅ Dashboard: rename "Total Value" → "Total Equity", add month-over-month trend chips (+/- %), add Platform donut SVG chart
- ✅ Header brand subtitle "Administration Database"
- ✅ Live indicator in header (blinking emerald dot when WS connected)
- ✅ Invoice number format: `YYMMDD-CLIENTNAME-INV-N` with per-klien counter (DB-backed)
- ✅ New backend endpoints: `GET /api/invoices/next?klien=X`, `POST /api/invoices`, `GET /api/invoices`
- ✅ Invoice footer: BCA bank details (BCA / 8030651287 / Ivo Febrian Pratama)
- ✅ Telegram template overhaul (plain text, no Markdown — safer for special chars):
  - 🆕 ORDER BARU MASUK (manual button)
  - ⏰ REMINDER DEADLINE (auto at 5d & 3d, also manual button)
  - ❗ WARNING DEADLINE H-1 (auto at 1d, also manual button)
  - ⏳ REMINDER DEADLINE — sisa N hari (manual ping)
- ✅ Tested 12/12 pytest + Playwright frontend coverage 100% iter4 flows.

## Backlog (P1/P2)

### Tier 2 (next)
- [ ] **Earning Page Weekly Tab**: complex weekly table — manual input per platform (Magsika / Eirene / Lolicharm), auto-accumulate, target progress bar to $2000/week
- [ ] Sparklines on Dashboard cards (last 6 months mini-trend)

### Tier 3 (P2)
- [ ] Server-side PNG/PDF export of invoice
- [ ] Audit log (who edited what when)
- [ ] Notification toast when WS broadcasts order from another user
- [ ] Dark mode
- [ ] Multi-currency / pajak (PPN)

### Refactor
- [ ] Switch backend `requests` → `httpx.AsyncClient` for Telegram (avoid blocking event loop)
- [ ] Unique compound index on `db.invoices(klien, seq)` for atomic numbering
- [ ] Track invoice "already saved" in Invoice.jsx state to PATCH instead of POST on re-print
- [ ] Toast feedback on OrderModal handleNotif success/error

## Embed in WordPress
```html
<iframe src="https://<preview-url>" style="width:100%;height:100vh;border:0" allow="clipboard-read; clipboard-write"></iframe>
```

## Next Tasks (after Tier 2 completion)
1. Deploy ke production (custom domain admin.magsikastudio.com)
2. Setup allowed-email whitelist
3. Konfigurasi embed iframe di halaman WordPress
