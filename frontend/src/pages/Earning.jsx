import React, { useEffect, useState, useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, Calendar, Plus, Target } from "lucide-react";
import { api } from "../lib/api";
import { useCurrency } from "../context/CurrencyContext";
import { monthLabel, currentMonth } from "../lib/format";
import { PLATFORM_COLORS, PLATFORM_OPTIONS } from "../lib/constants";
import { toast } from "sonner";

// Heuristic for legacy mixed-currency values.
const guessCur = (n) => (Number(n) > 100000 ? "IDR" : "USD");

const PLATFORM_SHORT = { "Fiverr Magsika": "Magsika", "Fiverr Eirene": "Eirene", "Etsy Lolicharm": "Lolicharm", "Direct": "Direct", "Komunitas": "Komunitas" };
const WEEKLY_COLS = ["fiverr", "etsy", "upwork", "vgen", "komunitas", "lain_lain"];
const WEEKLY_COL_LABELS = { fiverr: "FIVERR", etsy: "ETSY", upwork: "UPWORK", vgen: "VGEN", komunitas: "KOMUNITAS", lain_lain: "LAIN-LAIN" };
const WEEKLY_GROUPS = [
  { key: "magsika", label: "Magsika Earning", hasTarget: true },
  { key: "eirene", label: "Eirene Earning", hasTarget: true },
  { key: "lolicharm_komunitas", label: "Lolicharm & Komunitas Earning", hasTarget: false },
];

const Sparkline = ({ data, color = "#6d4cff", dashed = false, width = 280, height = 60, max = 1 }) => {
  if (!data || data.length === 0) return null;
  const stepX = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${i * stepX},${height - (v / max) * (height - 6) - 3}`).join(" ");
  return (
    <polyline fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? "5 4" : "0"} points={pts} />
  );
};

const TrendChip = ({ value }) => {
  if (value === null || value === undefined || !isFinite(value)) return null;
  const pos = value >= 0;
  return (
    <span className={`text-[0.65rem] font-bold font-mono px-1.5 py-0.5 rounded-full flex items-center gap-1 w-fit ${pos ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {pos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pos ? "+" : ""}{value.toFixed(0)}%
    </span>
  );
};

export default function Earning() {
  const [data, setData] = useState({ by_month: [], by_platform_month: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("monthly");
  const [month, setMonth] = useState(currentMonth());
  const { fmt, convert, display } = useCurrency();

  useEffect(() => {
    (async () => {
      try { const res = await api.get("/earnings"); setData(res.data); }
      finally { setLoading(false); }
    })();
  }, []);

  const cv = (n) => convert(Number(n) || 0, guessCur(n));
  const cvIdr = (n) => convert(Number(n) || 0, "IDR");

  const months = data.by_month;
  const bulanList = useMemo(() => { const s = new Set(months.map((m) => m.month)); s.add(currentMonth()); return Array.from(s).sort().reverse(); }, [months]);

  const prevMonthKey = (m) => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const cur = months.find((m) => m.month === month) || { gross: 0, fee: 0, net: 0, paid: 0, unpaid: 0, count: 0 };
  const prev = months.find((m) => m.month === prevMonthKey(month)) || { gross: 0, fee: 0, net: 0, paid: 0, unpaid: 0, count: 0 };
  const trend = (a, b) => { if (!b) return null; return ((a - b) / b) * 100; };

  // 6-month trend series
  const series = useMemo(() => {
    const last6 = [];
    const [y, m] = month.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = months.find((mm) => mm.month === k) || { gross: 0, fee: 0, net: 0 };
      last6.push({ month: k, label: d.toLocaleDateString("id-ID", { month: "short" }), gross: cv(row.gross), fee: cvIdr(row.fee), net: cv(row.net) });
    }
    return last6;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, month, display]);
  const seriesMax = Math.max(1, ...series.map((s) => Math.max(s.gross, s.fee, s.net)));

  // platform pivot
  const pivot = useMemo(() => {
    const table = {};
    data.by_platform_month.forEach((row) => {
      if (!table[row.month]) table[row.month] = {};
      table[row.month][row.platform] = row.gross;
    });
    return Object.entries(table).sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  if (loading) return <div className="text-center py-10 text-[var(--ms-text-muted)]">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="earning-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700"><TrendingUp size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Earning</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Rekap pendapatan bulanan & mingguan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--ms-text-muted)]" />
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-4 py-2 rounded-full border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)]" data-testid="earning-month">
            {bulanList.map((b) => <option key={b} value={b}>{monthLabel(b)}{b === currentMonth() ? " — skrg" : ""}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex bg-white rounded-full border border-[var(--ms-border)] p-1" data-testid="earning-tabs">
        <button onClick={() => setTab("monthly")} className={`px-5 py-1.5 rounded-full text-xs font-bold transition-base ${tab === "monthly" ? "text-white" : "text-[var(--ms-text-muted)]"}`} style={tab === "monthly" ? { background: "var(--ms-primary)" } : {}} data-testid="tab-monthly">Bulanan</button>
        <button onClick={() => setTab("weekly")} className={`px-5 py-1.5 rounded-full text-xs font-bold transition-base ${tab === "weekly" ? "text-white" : "text-[var(--ms-text-muted)]"}`} style={tab === "weekly" ? { background: "var(--ms-primary)" } : {}} data-testid="tab-weekly">Mingguan</button>
      </div>

      {tab === "monthly" && (
        <MonthlyTab
          cur={cur} prev={prev} month={month}
          fmt={fmt} cv={cv} cvIdr={cvIdr} display={display} convert={convert}
          trend={trend} series={series} seriesMax={seriesMax}
          months={months} pivot={pivot}
        />
      )}
      {tab === "weekly" && (
        <WeeklyTab month={month} fmt={fmt} convert={convert} display={display} />
      )}
    </div>
  );
}

/* ============ MONTHLY ============ */
function MonthlyTab({ cur, prev, month, fmt, cv, cvIdr, display, convert, trend, series, seriesMax, months, pivot }) {
  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-5" data-testid="earn-current">
          <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-1">Gross bulan ini</div>
          <div className="font-display text-2xl font-extrabold" style={{ color: "var(--ms-primary)" }}>{fmt(cv(cur.gross), display)}</div>
          <div className="text-xs text-[var(--ms-text-muted)] mt-1">{cur.count} order · paid {fmt(cv(cur.paid), display)}</div>
          <div className="mt-2"><TrendChip value={trend(cv(cur.gross), cv(prev.gross))} /></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-5">
          <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-1">Fee Freelance</div>
          <div className="font-display text-2xl font-extrabold text-amber-600">{fmt(cvIdr(cur.fee), display)}</div>
          <div className="text-xs text-[var(--ms-text-muted)] mt-1">Dibayarkan ke artist</div>
          <div className="mt-2"><TrendChip value={trend(cvIdr(cur.fee), cvIdr(prev.fee))} /></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-5">
          <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-1">Net Earning</div>
          <div className="font-display text-2xl font-extrabold text-emerald-700">{fmt(cv(cur.net), display)}</div>
          <div className="text-xs text-[var(--ms-text-muted)] mt-1">Gross − Fee</div>
          <div className="mt-2"><TrendChip value={trend(cv(cur.net), cv(prev.net))} /></div>
        </div>
      </div>

      {/* Trend chart 6 months */}
      <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-5" data-testid="trend-chart">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight">Tren pendapatan 6 bulan terakhir</h2>
          <div className="flex items-center gap-3 text-[0.68rem] font-mono">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#6d4cff" }} /> Gross</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5" style={{ background: "#f59e0b", borderTop: "1px dashed #f59e0b" }} /> Fee</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} /> Net</span>
          </div>
        </div>
        <svg width="100%" viewBox="0 0 620 200" preserveAspectRatio="none" style={{ maxHeight: 220 }}>
          {/* grid */}
          {[0.25, 0.5, 0.75].map((p) => <line key={p} x1="40" x2="600" y1={40 + p * 130} y2={40 + p * 130} stroke="#f1f5f9" strokeWidth="1" />)}
          <line x1="40" x2="600" y1="170" y2="170" stroke="#e2e8f0" strokeWidth="1" />
          {/* y-axis labels */}
          <text x="35" y="45" textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">{fmt(seriesMax, display)}</text>
          <text x="35" y="174" textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">0</text>
          <g transform="translate(40, 40)">
            <Sparkline data={series.map((s) => s.gross)} color="#6d4cff" width={560} height={130} max={seriesMax} />
            <Sparkline data={series.map((s) => s.fee)} color="#f59e0b" dashed width={560} height={130} max={seriesMax} />
            <Sparkline data={series.map((s) => s.net)} color="#10b981" width={560} height={130} max={seriesMax} />
          </g>
          {/* x-axis labels */}
          {series.map((s, i) => (
            <text key={s.month} x={40 + (i / 5) * 560} y="192" textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="monospace" fontWeight={s.month === month ? 700 : 400}>{s.label}</text>
          ))}
        </svg>
      </div>

      {/* Recap table */}
      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="p-5 border-b border-[var(--ms-border)]">
          <h2 className="font-display text-xl font-bold tracking-tight">Rekap per bulan</h2>
          <p className="text-xs text-[var(--ms-text-muted)] mt-0.5">Ringkasan pendapatan bulanan</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--ms-bg)]">
              <tr className="text-left">
                {["Bulan", "Order", "Gross", "Fee Freelance", "Net", "Paid", "Unpaid"].map((h) => <th key={h} className="px-4 py-3 text-[0.66rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)]">{h}</th>)}
              </tr>
            </thead>
            <tbody data-testid="earn-by-month">
              {months.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-[var(--ms-text-muted)]">—</td></tr>}
              {months.map((m) => (
                <tr key={m.month} className="border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)]">
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {monthLabel(m.month)}
                    {m.month === currentMonth() && <span className="ml-2 text-[0.62rem] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Skrg</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{m.count}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{fmt(cv(m.gross), display)}</td>
                  <td className="px-4 py-3 font-mono text-amber-600">{fmt(cvIdr(m.fee), display)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-700">{fmt(cv(m.net), display)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{fmt(cv(m.paid), display)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--ms-text-muted)]">{fmt(cv(m.unpaid), display)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform breakdown with mini bars */}
      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="p-5 border-b border-[var(--ms-border)]">
          <h2 className="font-display text-xl font-bold tracking-tight">Earning per platform</h2>
          <p className="text-xs text-[var(--ms-text-muted)] mt-0.5">Breakdown per akun sumber order</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--ms-bg)]">
              <tr className="text-left">
                <th className="px-4 py-3 text-[0.66rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)]">Bulan</th>
                {PLATFORM_OPTIONS.map((p) => <th key={p} className="px-4 py-3 text-[0.66rem] uppercase tracking-wider font-bold font-mono text-right" style={{ color: PLATFORM_COLORS[p] }}>{PLATFORM_SHORT[p] || p}</th>)}
                <th className="px-4 py-3 text-[0.66rem] uppercase tracking-wider font-bold font-mono text-right" style={{ color: "var(--ms-primary)" }}>Total</th>
              </tr>
            </thead>
            <tbody data-testid="earn-pivot">
              {pivot.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-[var(--ms-text-muted)]">—</td></tr>}
              {pivot.map(([mm, row]) => {
                const rawTotal = PLATFORM_OPTIONS.reduce((s, p) => s + (row[p] || 0), 0);
                return (
                  <tr key={mm} className="border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)] align-top">
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {monthLabel(mm)}
                      {mm === currentMonth() && <span className="ml-2 text-[0.62rem] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Skrg</span>}
                    </td>
                    {PLATFORM_OPTIONS.map((p) => {
                      const val = row[p] || 0;
                      const pct = rawTotal ? (val / rawTotal) * 100 : 0;
                      return (
                        <td key={p} className="px-4 py-3 text-right">
                          <div className="font-mono text-xs font-semibold" style={{ color: val ? "#0f172a" : "#cbd5e1" }}>{val ? fmt(cv(val), display) : "—"}</div>
                          {val > 0 && <div className="mt-1 h-1 rounded-full bg-[var(--ms-bg)] overflow-hidden ml-auto" style={{ maxWidth: 80 }}>
                            <div className="h-full" style={{ width: `${pct}%`, background: PLATFORM_COLORS[p] || "#6d4cff" }} />
                          </div>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 font-mono font-bold text-right" style={{ color: "var(--ms-primary)" }}>{fmt(cv(rawTotal), display)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ============ WEEKLY ============ */
function WeeklyTab({ month, fmt, convert, display }) {
  const [doc, setDoc] = useState({ targets: { magsika: 2000, eirene: 2000 }, groups: { magsika: [], eirene: [], lolicharm_komunitas: [] } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/weekly/${month}`);
      const d = r.data;
      // ensure groups have at least 5 weeks
      WEEKLY_GROUPS.forEach((g) => {
        if (!d.groups[g.key]) d.groups[g.key] = [];
        while (d.groups[g.key].length < 5) {
          d.groups[g.key].push({ week: d.groups[g.key].length + 1, fiverr: 0, etsy: 0, upwork: 0, vgen: 0, komunitas: 0, lain_lain: 0 });
        }
      });
      if (!d.targets) d.targets = { magsika: 2000, eirene: 2000 };
      setDoc(d);
    } catch (e) { toast.error("Gagal memuat weekly"); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const save = async (next) => {
    setSaving(true);
    try {
      await api.put(`/weekly/${month}`, { targets: next.targets, groups: next.groups });
    } catch (e) { toast.error("Gagal simpan"); }
    finally { setSaving(false); }
  };

  const setCell = (gkey, wIdx, col, raw) => {
    const v = Number(raw) || 0;
    const next = { ...doc, groups: { ...doc.groups, [gkey]: doc.groups[gkey].map((w, i) => i === wIdx ? { ...w, [col]: v } : w) } };
    setDoc(next);
    clearTimeout(window.__wkSave);
    window.__wkSave = setTimeout(() => save(next), 600);
  };

  const setTarget = (gkey, raw) => {
    const v = Number(raw) || 0;
    const next = { ...doc, targets: { ...doc.targets, [gkey]: v } };
    setDoc(next);
    clearTimeout(window.__wkSave);
    window.__wkSave = setTimeout(() => save(next), 600);
  };

  const addWeek = (gkey) => {
    const current = doc.groups[gkey] || [];
    const next = { ...doc, groups: { ...doc.groups, [gkey]: [...current, { week: current.length + 1, fiverr: 0, etsy: 0, upwork: 0, vgen: 0, komunitas: 0, lain_lain: 0 }] } };
    setDoc(next);
    save(next);
  };

  // weekly values are stored in USD always (user inputs)
  const rowTotal = (w) => WEEKLY_COLS.reduce((s, c) => s + (Number(w[c]) || 0), 0);
  const groupTotal = (gkey) => (doc.groups[gkey] || []).reduce((s, w) => s + rowTotal(w), 0);
  const groupColTotal = (gkey, col) => (doc.groups[gkey] || []).reduce((s, w) => s + (Number(w[col]) || 0), 0);

  const maxWeeks = Math.max(0, ...WEEKLY_GROUPS.map((g) => (doc.groups[g.key] || []).length));

  // Top stats
  const totalMagsika = groupTotal("magsika");
  const totalEirene = groupTotal("eirene");
  const totalLoli = groupTotal("lolicharm_komunitas");
  const totalAll = totalMagsika + totalEirene + totalLoli;
  const targetMagsika = Number(doc.targets?.magsika) || 0;
  const targetEirene = Number(doc.targets?.eirene) || 0;
  const pctMagsika = targetMagsika ? Math.min(100, (totalMagsika / targetMagsika) * 100) : 0;
  const pctEirene = targetEirene ? Math.min(100, (totalEirene / targetEirene) * 100) : 0;

  if (loading) return <div className="text-center py-8 text-[var(--ms-text-muted)]">Memuat weekly...</div>;

  return (
    <div className="space-y-5" data-testid="weekly-tab">
      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatW label="Total bulan ini" value={fmt(convert(totalAll, "USD"), display)} sub={saving ? "Menyimpan..." : "Akumulasi semua akun"} color="#6d4cff" testid="w-total" />
        <StatW label="Magsika" value={fmt(convert(totalMagsika, "USD"), display)} color="#10b981" testid="w-magsika"
          target={<TargetBar value={totalMagsika} target={targetMagsika} pct={pctMagsika} onChangeTarget={(v) => setTarget("magsika", v)} display={display} fmt={fmt} convert={convert} />}
        />
        <StatW label="Eirene" value={fmt(convert(totalEirene, "USD"), display)} color="#0ea5e9" testid="w-eirene"
          target={<TargetBar value={totalEirene} target={targetEirene} pct={pctEirene} onChangeTarget={(v) => setTarget("eirene", v)} display={display} fmt={fmt} convert={convert} />}
        />
        <StatW label="Lolicharm + Lain" value={fmt(convert(totalLoli, "USD"), display)} color="#f97316" sub="Tanpa target" testid="w-loli" />
      </div>

      {/* Groups */}
      {WEEKLY_GROUPS.map((g) => {
        const rows = doc.groups[g.key] || [];
        const pct = g.key === "magsika" ? pctMagsika : g.key === "eirene" ? pctEirene : null;
        return (
          <div key={g.key} className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden" data-testid={`weekly-group-${g.key}`}>
            <div className="p-4 border-b border-[var(--ms-border)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h3 className="font-display text-lg font-bold tracking-tight">{g.label}</h3>
                {g.hasTarget && <span className="text-[0.68rem] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--ms-primary-soft)]" style={{ color: "var(--ms-primary)" }}>{Math.round(pct)}% dari target ${g.key === "magsika" ? targetMagsika : targetEirene}</span>}
              </div>
              <button onClick={() => addWeek(g.key)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--ms-border)] hover:bg-[var(--ms-bg)] transition-base" data-testid={`add-week-${g.key}`}><Plus size={12} /> Tambah minggu</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--ms-bg)]">
                  <tr className="text-left">
                    <th className="px-3 py-2.5 text-[0.62rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] w-16">MG</th>
                    {WEEKLY_COLS.map((c) => <th key={c} className="px-3 py-2.5 text-[0.62rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] text-center">{WEEKLY_COL_LABELS[c]}</th>)}
                    <th className="px-3 py-2.5 text-[0.62rem] uppercase tracking-wider font-bold font-mono text-right" style={{ color: "var(--ms-primary)" }}>Total/MG</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w, i) => {
                    const rt = rowTotal(w);
                    return (
                      <tr key={i} className="border-t border-[var(--ms-border)]">
                        <td className="px-3 py-2 font-mono text-xs font-bold text-[var(--ms-text-muted)]">MG {i + 1}</td>
                        {WEEKLY_COLS.map((c) => (
                          <td key={c} className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              value={w[c] || ""}
                              onChange={(e) => setCell(g.key, i, c, e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-[var(--ms-border)] focus:border-[var(--ms-primary)] focus:bg-white bg-[var(--ms-bg)] text-sm font-mono text-center focus:outline-none transition-base"
                              data-testid={`w-${g.key}-${i}-${c}`}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "var(--ms-primary)" }}>{fmt(convert(rt, "USD"), display)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-[var(--ms-border)] bg-[var(--ms-bg)]">
                    <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: "var(--ms-primary)" }}>TOTAL</td>
                    {WEEKLY_COLS.map((c) => <td key={c} className="px-3 py-2 font-mono text-xs font-bold text-center">{fmt(convert(groupColTotal(g.key, c), "USD"), display)}</td>)}
                    <td className="px-3 py-2 font-mono font-extrabold text-right" style={{ color: "var(--ms-primary)" }}>{fmt(convert(groupTotal(g.key), "USD"), display)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Accumulation table */}
      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--ms-border)]">
          <h3 className="font-display text-lg font-bold tracking-tight">Earning Mingguan (Akumulasi Semua Akun)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--ms-bg)]">
              <tr className="text-left">
                <th className="px-3 py-2.5 text-[0.62rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)]">Minggu</th>
                <th className="px-3 py-2.5 text-[0.62rem] uppercase tracking-wider font-bold font-mono text-right" style={{ color: "var(--ms-primary)" }}>Akumulasi</th>
                {WEEKLY_COLS.map((c) => <th key={c} className="px-3 py-2.5 text-[0.62rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] text-right">{WEEKLY_COL_LABELS[c]}</th>)}
              </tr>
            </thead>
            <tbody data-testid="weekly-accum">
              {Array.from({ length: maxWeeks }).map((_, i) => {
                let acc = 0;
                const perCol = {};
                WEEKLY_COLS.forEach((c) => { perCol[c] = 0; });
                for (let j = 0; j <= i; j++) {
                  WEEKLY_GROUPS.forEach((g) => {
                    const w = doc.groups[g.key]?.[j];
                    if (!w) return;
                    WEEKLY_COLS.forEach((c) => { acc += Number(w[c]) || 0; perCol[c] += Number(w[c]) || 0; });
                  });
                }
                return (
                  <tr key={i} className="border-t border-[var(--ms-border)]">
                    <td className="px-3 py-2 font-semibold">Minggu {i + 1}</td>
                    <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "var(--ms-primary)" }}>{fmt(convert(acc, "USD"), display)}</td>
                    {WEEKLY_COLS.map((c) => <td key={c} className="px-3 py-2 font-mono text-xs text-right text-[var(--ms-text-muted)]">{perCol[c] ? fmt(convert(perCol[c], "USD"), display) : "—"}</td>)}
                  </tr>
                );
              })}
              {/* Final total row */}
              {maxWeeks > 0 && (
                <tr className="border-t-2 border-[var(--ms-border)] bg-[var(--ms-bg)]">
                  <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: "var(--ms-primary)" }}>TOTAL</td>
                  <td className="px-3 py-2 font-mono font-extrabold text-right" style={{ color: "var(--ms-primary)" }}>{fmt(convert(totalAll, "USD"), display)}</td>
                  {WEEKLY_COLS.map((c) => {
                    const t = WEEKLY_GROUPS.reduce((s, g) => s + groupColTotal(g.key, c), 0);
                    return <td key={c} className="px-3 py-2 font-mono text-xs font-bold text-right">{t ? fmt(convert(t, "USD"), display) : "—"}</td>;
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-[0.68rem] font-mono text-[var(--ms-text-muted)] border-t border-[var(--ms-border)]">
          * Data ini bersifat rahasia · * Dilarang mempublikasikan dalam bentuk apapun
        </div>
      </div>
    </div>
  );
}

const StatW = ({ label, value, sub, color, testid, target }) => (
  <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-4" data-testid={testid}>
    <div className="text-[0.62rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-1">{label}</div>
    <div className="font-display text-xl font-extrabold" style={{ color }}>{value}</div>
    {sub && <div className="text-[0.68rem] text-[var(--ms-text-muted)] mt-1">{sub}</div>}
    {target}
  </div>
);

const TargetBar = ({ value, target, pct, onChangeTarget, display, fmt, convert }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(target);
  useEffect(() => { setVal(target); }, [target]);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 text-[0.62rem] font-mono text-[var(--ms-text-muted)]">
        <Target size={10} /> Target
        {editing ? (
          <>
            <input type="number" value={val} onChange={(e) => setVal(e.target.value)} className="w-16 px-1 py-0 border border-[var(--ms-border)] rounded text-[0.68rem] font-mono" />
            <button onClick={() => { onChangeTarget(val); setEditing(false); }} className="text-emerald-700 font-bold">OK</button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="font-bold hover:underline" data-testid="edit-target">${target}</button>
        )}
        <span className="ml-auto font-bold" style={{ color: "var(--ms-primary)" }}>{Math.round(pct)}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-[var(--ms-bg)] overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--ms-primary)" }} />
      </div>
    </div>
  );
};
