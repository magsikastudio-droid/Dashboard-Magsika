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

## Implemented (iter 7 — Tier 2 fixes 2, 2026-05-03) ✅
- ✅ OrderModal artist row layout FIXED — changed flex → CSS grid `auto 1fr 110px auto` (badge | name | dropdown | delete). Name input 470px wide, dropdown 110px, no more collapsed input.
- ✅ Freelance auto-sync EXTENDED — POST/PUT /api/orders now not only auto-creates `freelance_artists` but also auto-creates `freelance_projects` (linked via `order_ref_id=order.id`). Fee split evenly across Freelance artists. On PUT order update, order-driven fields (project, platform, tanggal, pic, status_project, fee) are refreshed but pembayaran fields (dp_amount, dp_date, pelunasan_date, status_bayar) are preserved (user-editable).
- ✅ Editable Telegram templates — `settings.telegram_templates` dict with keys new|reminder|warning|custom. Backend `render_tg_template()` renders with safe fallback. Settings page has new "Template Pesan Telegram" section with 4 textareas + per-template "Reset default" button.
- ✅ Earning per-platform pivot — `allPlatforms` dynamic from actual data (not hardcoded PLATFORM_OPTIONS), so new user-added platforms auto-appear as columns.
- ✅ FreelanceProjectInput schema extended with `order_ref_id` field.
- ✅ Tested 7/7 pytest + 3/3 frontend E2E checkpoints pass.

## Implemented (iter 6 — Tier 2 fixes, 2026-05-02) ✅
- ✅ POST /api/orders auto-sends Telegram "🆕 ORDER BARU MASUK" notification on create
- ✅ POST/PUT /api/orders auto-creates `freelance_artists` record for any artist flagged "Freelance" (case-insensitive name match → no duplicate)
- ✅ /api/earnings normalizes ALL amounts to USD base (uses settings.exchange_rate). Returns `{base_currency:'USD', exchange_rate, by_month, by_platform_month}`. Fixed massive negative net bug from mixed currency summation.
- ✅ OrderModal artist row layout: name input `flex-1 min-w-0`, Tim/Freelance dropdown trimmed to `w-24`. No more cramped name field / oversized dropdown.
- ✅ OrderModal Fee Freelance: shows %-of-order chip with color coding (green ≤30% / amber 30-40% / red >40%) — quick guard rail
- ✅ Freelance ProjectModal:
  - Now portal-rendered (fixes blur bug)
  - Split into "📁 Info Project" + "💰 Pembayaran" sections (sama style dgn OrderModal)
  - "Link ke Order" picker — list/search order yang punya artist sebagai Freelance → click → auto-fill project / platform / pic / tanggal / fee (split per-artist)
- ✅ Earning page: removed `guessCur` heuristic, all values formatted USD-base via `convert(n, 'USD')`
- ✅ Tested 7/7 pytest + 11/11 UI checkpoints

## Implemented (iter 5 — Tier 2, 2026-05-02) ✅
- ✅ Telegram CHAT_ID updated to `-1003611845591` (group chat) in backend/.env + db.settings
- ✅ Dashboard labels: "Net (— Fee)" → "Fee Freelance", "Belum Dibayar" → "Pending Payment"
- ✅ Dashboard Total per Klien now vertical stacked list (avatar + name + count + total + done% + invoice button + progress bar) instead of side-by-side grid cards
- ✅ OrderModal Artist badge on single line (`whitespace-nowrap` + `Artist&nbsp;{i+1}`)
- ✅ Earning page full rewrite:
  - Month filter + Bulanan / Mingguan tabs
  - 6-month SVG trend chart (Gross purple, Fee yellow dashed, Net green) with Y-axis and x-labels
  - Simplified monthly table colors (gross dark, fee orange, net green)
  - Platform table with mini bars per cell showing % of row total
  - "Skrg" badge next to current month
  - 4 top stat cards with trend chips (Total / Magsika / Eirene / Lolicharm+Lain)
  - Weekly manual input tables: Magsika, Eirene, Lolicharm+Komunitas groups with 6 columns (FIVERR, ETSY, UPWORK, VGEN, KOMUNITAS, LAIN-LAIN)
  - Editable targets ($2000 default for Magsika & Eirene) with progress bar
  - `+ Tambah minggu` button per group
  - Auto-accumulation table at bottom (Minggu 1..N with cumulative + per-column totals)
  - Debounced PUT /api/weekly/{yyyymm} on every cell edit
- ✅ Freelance page full rewrite:
  - Clickable artist cards (avatar initial, name, count, UNPAID/LUNAS badge, total fee, rekening + phone, salin/edit/delete buttons, lunas progress bar)
  - 4 summary stat cards at top (Total fee, Sudah dibayar, Belum dibayar, Artist aktif)
  - Detail table: Tanggal, Project, PIC, Status Project, Fee (with DP info), Tanggal DP, Tanggal Pelunasan, Status Bayar (3-level: Paid/Unpaid/DP saja)
  - Transfer / Lunasi buttons per row (auto-sets pelunasan_date = today)
  - Edit/Delete modals for both artist profile (name, bank, rekening, phone) and project (full fields)
  - Baris total per artist di bawah tabel (Total fee / Paid / Sisa)
- ✅ New backend endpoints:
  - `GET/PUT /api/weekly/{yyyymm}` — weekly earnings doc
  - `GET/POST/PUT/DELETE /api/freelance/artists`
  - `GET/POST/PUT/DELETE /api/freelance/projects` (supports `?artist_id=&month=YYYY-MM` filter)
  - DELETE artist cascades to related projects
- ✅ Tested 10/10 pytest + 10/10 Playwright frontend

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
