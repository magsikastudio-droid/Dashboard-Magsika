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

## Implemented (iter 8 Phase B-E — Auth + RBAC + To Do + Performance, 2026-05-04) ✅

### Phase 8B — Auth Overhaul
- ✅ Email/password custom auth (bcrypt) alongside existing Google OAuth
- ✅ `POST /api/auth/register` — first user = admin+active, rest = `pending`
- ✅ `POST /api/auth/login` — checks status=='active', issues session_token cookie
- ✅ `POST /api/auth/invite` (admin) — creates active user, password set manually
- ✅ `POST /api/auth/logout`
- ✅ Brute-force throttle 5-fails/15min (via X-Forwarded-For — K8s ingress compatible)
- ✅ Roles: admin / pm / talent (auto-migrate legacy 'member'→'pm')
- ✅ User schema: password_hash, status (active|pending|disabled), auth_provider
- ✅ get_current_user blocks pending/disabled users

### Phase 8C — User Management
- ✅ Settings page: new "User Management" section (admin only)
- ✅ Gear icon moved to header top-right (admin only)
- ✅ Invite user modal with role select + manual password
- ✅ Per-user actions: approve / reject / disable / reactivate / edit name+role / reset password / delete
- ✅ Status badges (Aktif / Pending / Disabled)
- ✅ Cannot delete self

### Phase 8D — To Do
- ✅ New `/todo` page, role=all (Admin/PM/Talent)
- ✅ Backend: GET/POST `/api/tasks`, PATCH `/api/tasks/{id}`, DELETE (admin+pm)
- ✅ Auto-generate tasks dari order aktif (status ≠ done) saat /api/tasks/{today} diakses pertama kali
- ✅ Daily hourly loop di startup (backup ke cron 00:00)
- ✅ 3-status timer: pending → in_progress (started_at) → done (completed_at + duration_seconds)
- ✅ Reset ke Pending menghapus timer
- ✅ Date navigation (prev/next/today + date picker)
- ✅ Grouped by Tim Internal vs Freelance
- ✅ Manual task add modal dengan search order untuk auto-link folder code
- ✅ Talent hanya bisa PATCH task miliknya (backend enforced)

### Phase 8E — Performance
- ✅ New `/performance` page, role=all
- ✅ Backend `GET /api/performance?month=YYYY-MM` aggregates:
  - tasks_done per member (from tasks collection)
  - tasks_pending, tasks_in_progress
  - avg_speed_hours (from done tasks that had started_at)
  - credit_points (dari order status=done × artist_contributions%)
- ✅ Talent role: backend AUTO-SCOPE to self only
- ✅ 4 stat cards + per-member cards with progress bars

### Frontend shell
- ✅ Layout nav role-based (Admin/PM 9 links, Talent 2 links)
- ✅ Currency toggle hidden for Talent
- ✅ Role badge in header with color code (admin=green, pm=blue, talent=amber)
- ✅ ProtectedRoute takes `allowedRoles` prop, Talent auto-redirects to /todo

### Testing
- ✅ 29/30 pytest pass + 100% frontend flows verified
- ✅ Brute force throttle now working (X-Forwarded-For fix applied post-testing)
- ✅ Performance talent scope enforced backend-side

## Implemented (iter 8 Phase A — Order quick wins, 2026-05-03) ✅
- ✅ Inline status edit di tabel Orders — clickable dropdown per row, auto-save via PUT /api/orders/{id} (juga ada backup PATCH /api/orders/{id}/status endpoint)
- ✅ Artist contribution % di OrderModal — parallel array `artist_contributions`, total must = 100 to save. UI: per-artist % input + total bar (green=100 / amber<100 / red>100) + remaining hint
- ✅ Import CSV Orders — tombol "Import CSV" di toolbar, ImportCSVModal (portal-rendered):
  - File picker + template download
  - Auto-detect header → field mapping (heuristic aliases incl. indo terms)
  - Manual re-map dropdown per kolom
  - Preview table dengan skip-row checkbox, missing-required highlighted merah
  - Required field warning (tanggal/klien/project)
  - Bulk POST `/api/orders/import` → response {created, skipped, errors}
  - Modal state reset on close
- ✅ Backend endpoints baru: `PATCH /api/orders/{id}/status`, `POST /api/orders/import` (Order+OrderInput sekarang include artist_contributions)
- ✅ Tested 10/10 pytest + frontend flows verified.

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

## Implemented (iter 10 — UI/UX refinements + Telegram thread_id, 2026-05-05) ✅

### Header & Settings
- ✅ Currency toggle (USD/IDR) + Kurs editor MOVED into gear-icon dropdown
- ✅ Header now only shows: brand · nav · live indicator · user badge · gear · logout
- ✅ Gear dropdown visible for Admin AND PM (talent has no money UI). General Settings link admin-only.
- ✅ Dropdown items: General Settings (admin) | Tampilan Mata Uang USD/IDR pill toggle | Kurs USD/IDR (opens rate popup)

### Dashboard
- ✅ Late-deadline banner (rose) + Approaching ≤3 days banner (amber) are dismissible via X icon
- ✅ Per-mount useState (re-shows on full reload/login by design)

### To Do
- ✅ Talent CAN update status & notes on ANY task (not only own)
- ✅ Admin-only Edit Task modal (title, assignee, assignee_type, notes) wired to PATCH /api/tasks/{id}
- ✅ Pause/resume preserves elapsed_seconds — pending state stops timer but keeps accumulated time
- ✅ TaskRow shows live elapsed (running task adds Date.now()-started_at)
- ✅ Notes field rendered on each task row when present
- ✅ Backend PATCH talent guard: status+notes allowed on any; title/assignee/type → 403

### Backend
- ✅ Folder Code uniqueness on POST/PUT /api/orders (returns 409 Conflict)
- ✅ Telegram thread_id (settings.telegram_thread_id) included in sendMessage payload
- ✅ Hourly background loop auto-fails past-date tasks not yet done

### Removed
- ✅ Archive page deleted from frontend nav (and route)

### Testing — iteration_10.json
- 14/14 backend pytest pass (auth, folder-code unique, pause/resume, edit task persist, talent RBAC, telegram thread_id round-trip, performance)
- Frontend Playwright: header decluttered ✓, gear dropdown ✓, IDR switch renders Rp ✓, dismiss banners ✓, rate-popup save→label updates ✓

## Implemented (iter 11 — Daily Chat tracking, 2026-05-05) ✅

### New page `/daily-chat` (Admin + PM only)
- ✅ Position in nav: between Earning and Freelance (Talent does NOT see — has only To Do + Performance)
- ✅ Header (title + Export CSV + Tambah client)
- ✅ 5 realtime stat cards: Total Inbox / Discussing / Follow Up + Nego / Place Order / Conversion Rate
- ✅ Filter bar: week navigation (◀ "Minggu N · Bulan YYYY" ▶), account pill (Semua / Magsika / Eirene), status dropdown (Semua + 6 statuses)
- ✅ Real revenue total displayed at right end of filter bar
- ✅ Editable inline table — date / type / username / estimasi / budget / agreed / real (all USD) / status (color-coded dropdown) / account (color-coded dropdown) / delete
- ✅ Status colors: Discussing=ungu, Negotiating=kuning, Follow Up=oranye, Offer Sent=biru, Place Order=hijau, Lost=merah
- ✅ Account colors: Magsika=hijau, Eirene=pink
- ✅ "Tambah baris" full-width button below table
- ✅ Collapsible "Ringkasan minggu sebelumnya" (default open) — auto-aggregated last 8 weeks. Conv. rate color: green >45%, yellow 30-45%, red <30%
- ✅ CSV export of currently visible rows

### Backend — MongoDB (project standard; user mentioned "Supabase" but kept consistent)
- ✅ Collection `daily_chats` with `week_key=YYYY-MM-Wn` (Monday-anchored)
- ✅ Endpoints: GET/POST/PATCH/DELETE /api/daily-chats (admin/pm gated)
- ✅ GET /api/daily-chats/current-week
- ✅ GET /api/daily-chats/summary?limit=8 — Mongo aggregation (group by week_key + account)
- ✅ WebSocket broadcast on create/update/delete

### Daily Chat Telegram (separate from deadline reminders)
- ✅ Settings extended: `dc_telegram_bot_token`, `dc_telegram_chat_id`, `dc_telegram_thread_id` (Optional[int]), `dc_reminders_enabled`, `dc_template`
- ✅ Background loop `daily_chat_reminder_loop` — runs every 5 min, sends at 09/12/15/18/21 WIB
- ✅ Only sends when there are clients with status ∈ {Discussing, Negotiating, Follow Up} in current week
- ✅ Groups by Magsika first, Eirene second; skips empty account headers; skips entire send if total=0
- ✅ Editable template with vars: `{day}`, `{date}`, `{time}`, `{groups}`, `{total}`
- ✅ Settings UI section "Daily Chat Telegram" with bot/chat/thread/template inputs

### Testing — iteration_11.json
- 14/14 backend pytest pass. 100% frontend critical flows (nav, route, stats, filters, CRUD via UI, CSV download, settings persist, talent RBAC redirect)
- Talent confirmed: nav has only nav-todo + nav-performance, direct /daily-chat redirects to /todo

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
