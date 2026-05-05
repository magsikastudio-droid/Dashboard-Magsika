import React, { useEffect, useMemo, useState, useCallback } from "react";
import { MessageCircle, Plus, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const STATUSES = ["Discussing", "Negotiating", "Follow Up", "Offer Sent", "Place Order", "Lost"];
const TYPES = ["New Client", "Return Client", "Referral"];
const ACCOUNTS = ["Magsika", "Eirene"];

const STATUS_COLORS = {
  "Discussing":   { bg: "#ede9fe", text: "#6d28d9", border: "#a78bfa" },
  "Negotiating":  { bg: "#fef9c3", text: "#a16207", border: "#facc15" },
  "Follow Up":    { bg: "#ffedd5", text: "#c2410c", border: "#fb923c" },
  "Offer Sent":   { bg: "#dbeafe", text: "#1d4ed8", border: "#60a5fa" },
  "Place Order":  { bg: "#dcfce7", text: "#15803d", border: "#4ade80" },
  "Lost":         { bg: "#fee2e2", text: "#b91c1c", border: "#f87171" },
};
const ACCOUNT_COLORS = {
  Magsika: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  Eirene:  { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Compute week_key = YYYY-MM-Wn from a date
const weekKey = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  // monday of that week
  const wd = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
  const monday = new Date(dt); monday.setDate(dt.getDate() - wd);
  const n = Math.floor((monday.getDate() - 1) / 7) + 1;
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-W${n}`;
};
const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const weekLabel = (wk) => {
  if (!wk) return "";
  const [y, m, n] = wk.split("-");
  return `Minggu ${n.replace("W", "")} · ${BULAN[parseInt(m, 10)]} ${y}`;
};
const shiftWeekKey = (wk, delta) => {
  // Convert week_key to representative monday, shift by 7*delta, recompute
  const [y, m, n] = wk.split("-");
  const yy = parseInt(y, 10), mm = parseInt(m, 10), nn = parseInt(n.replace("W", ""), 10);
  // First monday in that month
  const firstOfMonth = new Date(yy, mm - 1, 1);
  const firstMondayOffset = (8 - firstOfMonth.getDay()) % 7; // sun=0 → +1, mon=1 → 0...
  // Actually simpler: find any day where (day-1)//7 + 1 == nn and day is monday
  let targetDay = (nn - 1) * 7 + 1;
  while (targetDay <= 31) {
    const dt = new Date(yy, mm - 1, targetDay);
    if (dt.getMonth() !== mm - 1) break;
    if (dt.getDay() === 1) break; // monday
    targetDay += 1;
  }
  const monday = new Date(yy, mm - 1, targetDay);
  monday.setDate(monday.getDate() + delta * 7);
  const dateStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  return weekKey(dateStr);
};

const fmtUSD = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function DailyChat() {
  const [chats, setChats] = useState([]);
  const [summary, setSummary] = useState([]);
  const [week, setWeek] = useState("");
  const [accountFilter, setAccountFilter] = useState("all"); // all|Magsika|Eirene
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  // Load current week on mount
  useEffect(() => {
    api.get("/daily-chats/current-week").then((r) => setWeek(r.data.week_key)).catch(() => setWeek(weekKey(todayStr())));
  }, []);

  const load = useCallback(async () => {
    if (!week) return;
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get(`/daily-chats?week=${week}`),
        api.get(`/daily-chats/summary?limit=8`),
      ]);
      setChats(r1.data);
      setSummary(r2.data);
    } catch { toast.error("Gagal memuat data"); }
    finally { setLoading(false); }
  }, [week]);

  useEffect(() => { load(); }, [load]);

  // Apply client-side filters for visible
  const visible = useMemo(() => chats.filter((c) => {
    if (accountFilter !== "all" && c.account !== accountFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  }), [chats, accountFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = visible.length;
    const discussing = visible.filter((c) => c.status === "Discussing").length;
    const followNego = visible.filter((c) => c.status === "Follow Up" || c.status === "Negotiating").length;
    const place = visible.filter((c) => c.status === "Place Order").length;
    const realRev = visible.reduce((s, c) => s + (Number(c.real) || 0), 0);
    const conv = total ? Math.round((place / total) * 100) : 0;
    return { total, discussing, followNego, place, realRev, conv };
  }, [visible]);

  // Optimistic update helper
  const updateLocal = (id, patch) => setChats((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));

  const patchChat = async (id, patch) => {
    updateLocal(id, patch);
    try {
      const r = await api.patch(`/daily-chats/${id}`, patch);
      setChats((prev) => prev.map((c) => c.id === id ? r.data : c));
    } catch (e) {
      toast.error("Gagal simpan: " + (e.response?.data?.detail || e.message));
      load();
    }
  };

  const addRow = async () => {
    try {
      const r = await api.post("/daily-chats", { date: todayStr(), status: "Discussing", account: "Magsika", type: "New Client" });
      setChats((prev) => [...prev, r.data]);
      toast.success("Baris ditambahkan");
    } catch (e) { toast.error("Gagal: " + (e.response?.data?.detail || e.message)); }
  };

  const deleteRow = async (id) => {
    if (!window.confirm("Hapus baris ini?")) return;
    try {
      await api.delete(`/daily-chats/${id}`);
      setChats((prev) => prev.filter((c) => c.id !== id));
    } catch { toast.error("Gagal hapus"); }
  };

  const exportCSV = () => {
    const headers = ["Tanggal", "Tipe", "Username", "Estimasi", "Budget", "Agreed", "Real", "Status", "Akun"];
    const rows = visible.map((c) => [c.date, c.type, c.username, c.est_budget, c.client_budget, c.agreed, c.real, c.status, c.account]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `daily-chat-${week || "all"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5" data-testid="daily-chat-page">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}><MessageCircle size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Daily Chat</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Tracking inbox &amp; pipeline client</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--ms-border)] bg-white text-sm font-semibold hover:bg-[var(--ms-bg)] transition-base" data-testid="export-csv-btn">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={addRow} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-semibold transition-base hover:opacity-90" style={{ background: "var(--ms-primary)" }} data-testid="add-client-btn">
            <Plus size={14} /> Tambah client
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Inbox" value={stats.total} sub="minggu ini" color="#6d4cff" testid="stat-total" />
        <StatCard label="Discussing" value={stats.discussing} sub="aktif" color="#7c3aed" testid="stat-discussing" />
        <StatCard label="Follow Up / Nego" value={stats.followNego} sub="perlu tindak lanjut" color="#ea580c" testid="stat-followup" />
        <StatCard label="Place Order" value={stats.place} sub="closing minggu ini" color="#16a34a" testid="stat-place" />
        <StatCard label="Conversion Rate" value={`${stats.conv}%`} sub="closing / total" color="#6d4cff" testid="stat-conv" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-[var(--ms-border)] p-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setWeek(shiftWeekKey(week, -1))} className="p-2 rounded-full border border-[var(--ms-border)] hover:bg-[var(--ms-bg)]" data-testid="week-prev"><ChevronLeft size={14} /></button>
          <div className="px-4 py-2 rounded-full bg-[var(--ms-bg)] border border-[var(--ms-border)] text-sm font-semibold min-w-[180px] text-center" data-testid="week-label">{weekLabel(week)}</div>
          <button onClick={() => setWeek(shiftWeekKey(week, 1))} className="p-2 rounded-full border border-[var(--ms-border)] hover:bg-[var(--ms-bg)]" data-testid="week-next"><ChevronRight size={14} /></button>
        </div>

        <div className="flex items-center bg-[var(--ms-bg)] p-0.5 rounded-full border border-[var(--ms-border)]" data-testid="account-pill">
          <PillBtn active={accountFilter === "all"} onClick={() => setAccountFilter("all")} label="Semua" testid="acct-all" />
          <PillBtn active={accountFilter === "Magsika"} onClick={() => setAccountFilter("Magsika")} label="Magsika" color={ACCOUNT_COLORS.Magsika} testid="acct-magsika" />
          <PillBtn active={accountFilter === "Eirene"} onClick={() => setAccountFilter("Eirene")} label="Eirene" color={ACCOUNT_COLORS.Eirene} testid="acct-eirene" />
        </div>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-full border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)]" data-testid="status-filter">
          <option value="all">Semua status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="ml-auto text-xs font-mono text-[var(--ms-text-muted)]">
          Real revenue: <span className="font-bold" style={{ color: "var(--ms-primary)" }}>{fmtUSD(stats.realRev)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="dc-table">
            <thead className="bg-[var(--ms-bg)] text-[0.62rem] uppercase tracking-wider font-mono font-bold text-[var(--ms-text-muted)]">
              <tr>
                <Th>TGL</Th><Th>Tipe</Th><Th>Username</Th>
                <Th>Estimasi</Th><Th>Budget</Th><Th>Agreed</Th><Th>Real</Th>
                <Th>Status</Th><Th>Akun</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="p-8 text-center text-[var(--ms-text-muted)]">Memuat...</td></tr>}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-[var(--ms-text-muted)] text-sm">Tidak ada data untuk minggu ini. Klik <span className="font-semibold" style={{ color: "var(--ms-primary)" }}>Tambah client</span> untuk mulai.</td></tr>
              )}
              {visible.map((c) => <Row key={c.id} chat={c} onPatch={patchChat} onDelete={deleteRow} />)}
            </tbody>
          </table>
        </div>
        <button onClick={addRow} className="w-full py-3 text-sm font-semibold border-t border-[var(--ms-border)] bg-[var(--ms-bg)] hover:bg-white text-[var(--ms-primary)] flex items-center justify-center gap-1.5 transition-base" data-testid="add-row-btn">
          <Plus size={14} /> Tambah baris
        </button>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <button onClick={() => setHistoryOpen((v) => !v)} className="w-full flex items-center justify-between p-4 hover:bg-[var(--ms-bg)] transition-base" data-testid="history-toggle">
          <div className="text-left">
            <h2 className="font-display text-lg font-bold tracking-tight">Ringkasan minggu sebelumnya</h2>
            <p className="text-xs text-[var(--ms-text-muted)]">8 minggu terakhir · otomatis dari data tabel</p>
          </div>
          {historyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {historyOpen && (
          <div className="overflow-x-auto border-t border-[var(--ms-border)]">
            <table className="w-full text-sm" data-testid="history-table">
              <thead className="bg-[var(--ms-bg)] text-[0.62rem] uppercase tracking-wider font-mono font-bold text-[var(--ms-text-muted)]">
                <tr><Th>Periode</Th><Th>Inbox</Th><Th>Closing</Th><Th>Conv. Rate</Th><Th>Revenue Real</Th><Th>Akun</Th></tr>
              </thead>
              <tbody>
                {summary.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-[var(--ms-text-muted)]">Belum ada history.</td></tr>}
                {summary.map((row) => {
                  const cr = row.conversion_rate;
                  const crColor = cr > 45 ? "#16a34a" : cr >= 30 ? "#ca8a04" : "#dc2626";
                  const ac = ACCOUNT_COLORS[row.account] || ACCOUNT_COLORS.Magsika;
                  return (
                    <tr key={`${row.week_key}-${row.account}`} className="border-t border-[var(--ms-border)]" data-testid={`history-row-${row.week_key}-${row.account}`}>
                      <Td className="font-semibold">{row.label}</Td>
                      <Td>{row.inbox}</Td>
                      <Td className="font-bold" style={{ color: "#16a34a" }}>{row.closing}</Td>
                      <Td className="font-bold" style={{ color: crColor }}>{cr}%</Td>
                      <Td className="font-mono font-bold" style={{ color: "var(--ms-primary)" }}>{fmtUSD(row.revenue_real)}</Td>
                      <Td><span className="px-2 py-0.5 rounded-full text-[0.62rem] font-bold" style={{ background: ac.bg, color: ac.text }}>{row.account}</span></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const StatCard = ({ label, value, sub, color, testid }) => (
  <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-4" data-testid={testid}>
    <div className="text-[0.62rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">{label}</div>
    <div className="font-display text-2xl font-extrabold" style={{ color }}>{value}</div>
    <div className="text-[0.65rem] text-[var(--ms-text-muted)] mt-0.5">{sub}</div>
  </div>
);

const PillBtn = ({ active, onClick, label, color, testid }) => (
  <button onClick={onClick} data-testid={testid}
    className={`px-3 py-1 rounded-full text-xs font-bold transition-base ${active ? "shadow-sm" : "text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]"}`}
    style={active ? (color ? { background: color.bg, color: color.text } : { background: "white", color: "var(--ms-text)" }) : {}}>{label}</button>
);

const Th = ({ children }) => <th className="px-2 py-2 text-left whitespace-nowrap">{children}</th>;
const Td = ({ children, className = "", style }) => <td className={`px-2 py-2 ${className}`} style={style}>{children}</td>;

function Row({ chat, onPatch, onDelete }) {
  const [local, setLocal] = useState(chat);
  useEffect(() => { setLocal(chat); }, [chat]);

  const flush = (key, val) => {
    if (val === chat[key]) return;
    onPatch(chat.id, { [key]: val });
  };

  const sc = STATUS_COLORS[local.status] || STATUS_COLORS.Discussing;
  const ac = ACCOUNT_COLORS[local.account] || ACCOUNT_COLORS.Magsika;

  const inputCls = "w-full px-2 py-1 rounded-lg border border-transparent hover:border-[var(--ms-border)] focus:border-[var(--ms-primary)] focus:outline-none focus:bg-white text-sm";
  const numCls = inputCls + " text-right font-mono w-24";

  return (
    <tr className="border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)] transition-base" data-testid={`dc-row-${chat.id}`}>
      <Td>
        <input type="date" value={local.date} className={inputCls + " font-mono w-32"}
          onChange={(e) => setLocal({ ...local, date: e.target.value })}
          onBlur={(e) => flush("date", e.target.value)}
          data-testid={`row-date-${chat.id}`} />
      </Td>
      <Td>
        <select value={local.type} className={inputCls + " w-32"}
          onChange={(e) => { setLocal({ ...local, type: e.target.value }); flush("type", e.target.value); }}
          data-testid={`row-type-${chat.id}`}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Td>
      <Td>
        <input type="text" value={local.username} className={inputCls + " w-40"}
          onChange={(e) => setLocal({ ...local, username: e.target.value })}
          onBlur={(e) => flush("username", e.target.value)}
          placeholder="username..."
          data-testid={`row-username-${chat.id}`} />
      </Td>
      <Td>
        <NumInput value={local.est_budget} onChange={(v) => setLocal({ ...local, est_budget: v })} onBlur={(v) => flush("est_budget", v)} className={numCls} testid={`row-est-${chat.id}`} />
      </Td>
      <Td>
        <NumInput value={local.client_budget} onChange={(v) => setLocal({ ...local, client_budget: v })} onBlur={(v) => flush("client_budget", v)} className={numCls} testid={`row-budget-${chat.id}`} />
      </Td>
      <Td>
        <NumInput value={local.agreed} onChange={(v) => setLocal({ ...local, agreed: v })} onBlur={(v) => flush("agreed", v)} className={numCls} testid={`row-agreed-${chat.id}`} />
      </Td>
      <Td>
        <NumInput value={local.real} onChange={(v) => setLocal({ ...local, real: v })} onBlur={(v) => flush("real", v)} className={numCls} testid={`row-real-${chat.id}`} />
      </Td>
      <Td>
        <select value={local.status} onChange={(e) => { setLocal({ ...local, status: e.target.value }); flush("status", e.target.value); }}
          className="px-2 py-1 rounded-full text-xs font-bold border focus:outline-none cursor-pointer"
          style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
          data-testid={`row-status-${chat.id}`}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Td>
      <Td>
        <select value={local.account} onChange={(e) => { setLocal({ ...local, account: e.target.value }); flush("account", e.target.value); }}
          className="px-2 py-1 rounded-full text-xs font-bold border focus:outline-none cursor-pointer"
          style={{ background: ac.bg, color: ac.text, borderColor: ac.border }}
          data-testid={`row-account-${chat.id}`}>
          {ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </Td>
      <Td>
        <button onClick={() => onDelete(chat.id)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 transition-base" data-testid={`row-delete-${chat.id}`}><Trash2 size={13} /></button>
      </Td>
    </tr>
  );
}

function NumInput({ value, onChange, onBlur, className, testid }) {
  // Show empty when 0 for cleaner UX
  const display = value === 0 || value === "" ? "" : value;
  return (
    <div className="relative">
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)] text-xs font-mono pointer-events-none">$</span>
      <input
        type="number"
        value={display}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        onBlur={(e) => onBlur(e.target.value === "" ? 0 : Number(e.target.value))}
        className={className + " pl-5"}
        placeholder="—"
        data-testid={testid}
      />
    </div>
  );
}
