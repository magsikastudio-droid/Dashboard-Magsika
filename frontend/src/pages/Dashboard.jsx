import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dice5, Gem, CheckCircle2, Hourglass, Wallet, AlertTriangle, Briefcase, ArrowRight, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { isLate, monthKey, monthLabel, currentMonth } from "../lib/format";
import { PLATFORM_COLORS, DONE_STATUSES } from "../lib/constants";

const StatCard = ({ icon: Icon, label, value, sub, accent, testid, trend }) => (
  <div className="relative bg-white rounded-2xl border border-[var(--ms-border)] p-5 card-hover transition-base overflow-hidden" data-testid={testid}>
    <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />
    <div className="flex items-start justify-between mb-3">
      <div className="text-[0.65rem] uppercase tracking-[0.12em] font-bold text-[var(--ms-text-muted)] font-mono">{label}</div>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}1a`, color: accent }}>
        <Icon size={18} />
      </div>
    </div>
    <div className="font-display text-[1.65rem] font-extrabold tracking-tight leading-none truncate" data-testid={`${testid}-value`}>{value}</div>
    <div className="mt-2 flex items-center justify-between gap-2">
      {sub && <div className="text-xs text-[var(--ms-text-muted)] font-medium truncate">{sub}</div>}
      {trend !== undefined && trend !== null && (
        <span className={`text-[0.65rem] font-bold font-mono px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 ${trend >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {trend >= 0 ? "+" : ""}{trend.toFixed(0)}%
        </span>
      )}
    </div>
  </div>
);

const prevMonthKey = (m) => {
  if (!m) return "";
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function Dashboard() {
  const { orders } = useOrders();
  const { fmt, convert, display } = useCurrency();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());

  const bulanList = useMemo(() => {
    const m = new Set(orders.map((o) => monthKey(o.tanggal)).filter(Boolean));
    m.add(currentMonth());
    return Array.from(m).sort().reverse();
  }, [orders]);

  const monthOrders = useMemo(() => orders.filter((o) => monthKey(o.tanggal) === month), [orders, month]);
  const prevOrders = useMemo(() => orders.filter((o) => monthKey(o.tanggal) === prevMonthKey(month)), [orders, month]);

  const sumValue = (arr) => arr.reduce((s, o) => s + convert(o.value || 0, o.currency || "USD"), 0);
  const sumFee = (arr) => arr.reduce((s, o) => s + convert(o.fee_freelance || 0, "IDR"), 0);

  const isDone = (s) => DONE_STATUSES.has((s || "").toLowerCase());

  const stats = useMemo(() => {
    const total = monthOrders.length;
    const doneOrders = monthOrders.filter((o) => isDone(o.status));
    const done = doneOrders.length;
    const onProgress = total - done;
    const totalValue = sumValue(monthOrders);
    const doneValue = sumValue(doneOrders);
    const onProgressValue = totalValue - doneValue;
    const unpaid = sumValue(monthOrders.filter((o) => !o.paid));
    const totalFee = sumFee(monthOrders);
    const late = monthOrders.filter((o) => isLate(o.deadline, o.status));
    return { total, done, onProgress, totalValue, doneValue, onProgressValue, unpaid, late, totalFee, net: totalValue - totalFee };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOrders, display]);

  const prevStats = useMemo(() => {
    const totalValue = sumValue(prevOrders);
    const totalFee = sumFee(prevOrders);
    return { total: prevOrders.length, totalValue, net: totalValue - totalFee };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevOrders, display]);

  const trend = (cur, prev) => {
    if (!prev) return null;
    return ((cur - prev) / prev) * 100;
  };

  const perKlien = useMemo(() => {
    const map = {};
    monthOrders.forEach((o) => {
      if (!map[o.klien]) map[o.klien] = { count: 0, total: 0, done: 0, platforms: new Set() };
      map[o.klien].count += 1;
      map[o.klien].total += convert(o.value || 0, o.currency || "USD");
      if (isDone(o.status)) map[o.klien].done += convert(o.value || 0, o.currency || "USD");
      if (o.platform) map[o.klien].platforms.add(o.platform);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOrders, display]);

  const perPlatform = useMemo(() => {
    const map = {};
    monthOrders.forEach((o) => {
      const p = o.platform || "Direct";
      if (!map[p]) map[p] = { count: 0, total: 0 };
      map[p].count += 1;
      map[p].total += convert(o.value || 0, o.currency || "USD");
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOrders, display]);

  const platformTotal = perPlatform.reduce((s, [, v]) => s + v.total, 0);

  // Mini donut SVG
  const Donut = ({ entries, size = 140 }) => {
    const total = entries.reduce((s, [, v]) => s + v.total, 0) || 1;
    const r = size / 2 - 14;
    const cx = size / 2, cy = size / 2;
    let acc = 0;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {entries.map(([p, v]) => {
          const frac = v.total / total;
          const len = 2 * Math.PI * r;
          const dash = len * frac;
          const offset = -len * acc;
          acc += frac;
          return (
            <circle key={p} cx={cx} cy={cy} r={r} fill="none"
              stroke={PLATFORM_COLORS[p] || "#6d4cff"} strokeWidth="14"
              strokeDasharray={`${dash} ${len}`} strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="font-display" style={{ fontSize: 13, fontWeight: 800, fill: "#0f172a" }}>{entries.length}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 9, fill: "#64748b", fontFamily: "monospace" }}>platforms</text>
      </svg>
    );
  };

  return (
    <div className="space-y-7" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-[var(--ms-text-muted)] mt-1 text-sm">Ringkasan order <span className="font-bold" style={{ color: "var(--ms-primary)" }}>{monthLabel(month)}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--ms-text-muted)]" />
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-4 py-2.5 rounded-full border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)] transition-base" data-testid="dashboard-month">
            {bulanList.map((b) => <option key={b} value={b}>{monthLabel(b)}{b === currentMonth() ? " — skrg" : ""}</option>)}
          </select>
        </div>
      </div>

      {stats.late.length > 0 && month === currentMonth() && (
        <div className="flex gap-3 items-start bg-rose-50 border border-rose-200 rounded-2xl p-4" data-testid="late-banner">
          <div className="w-9 h-9 rounded-xl bg-rose-100 flex-shrink-0 flex items-center justify-center text-rose-600">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 text-sm text-rose-800 leading-relaxed">
            <strong className="font-bold">{stats.late.length} project LEWAT deadline!</strong>{" "}
            <span className="text-rose-700">{stats.late.map((o) => o.project).join(", ")}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard testid="stat-total-project" icon={Dice5} label="Total Project" value={stats.total} sub={`${stats.done} selesai · ${stats.onProgress} aktif`} accent="#6d4cff" trend={trend(stats.total, prevStats.total)} />
        <StatCard testid="stat-total-equity" icon={Gem} label="Total Equity" value={fmt(stats.totalValue, display)} sub={monthLabel(month)} accent="#3a8dff" trend={trend(stats.totalValue, prevStats.totalValue)} />
        <StatCard testid="stat-done" icon={CheckCircle2} label="Done / Selesai" value={fmt(stats.doneValue, display)} sub={`${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}% completion`} accent="#16a34a" />
        <StatCard testid="stat-net" icon={Hourglass} label="Net (— Fee)" value={fmt(stats.net, display)} sub={`Fee: ${fmt(stats.totalFee, display)}`} accent="#f59e0b" trend={trend(stats.net, prevStats.net)} />
        <StatCard testid="stat-unpaid" icon={Wallet} label="Belum Dibayar" value={fmt(stats.unpaid, display)} sub="Outstanding" accent="#ef4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[var(--ms-border)] p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}>
                <Briefcase size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Total per Klien</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="klien-grid">
            {perKlien.length === 0 && <div className="text-sm text-[var(--ms-text-muted)] col-span-full text-center py-8">Belum ada order di bulan ini.</div>}
            {perKlien.map(([klien, v]) => (
              <div key={klien} className="bg-[var(--ms-bg)] rounded-2xl p-4 border border-[var(--ms-border)] card-hover transition-base" data-testid={`klien-card-${klien}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-display text-base font-bold tracking-tight truncate">{klien}</h3>
                  <span className="text-[0.65rem] font-bold font-mono px-2 py-0.5 rounded-full bg-white border border-[var(--ms-border)]">{v.count}</span>
                </div>
                <div className="font-display text-lg font-extrabold mb-1" style={{ color: "var(--ms-primary)" }}>{fmt(v.total, display)}</div>
                <div className="text-xs text-emerald-700 font-medium mb-3">✓ Done: {fmt(v.done, display)}</div>
                <button onClick={() => navigate(`/invoice?klien=${encodeURIComponent(klien)}&bulan=${month}`)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-[0.7rem] font-semibold transition-base hover:opacity-90" style={{ background: "var(--ms-blue)" }} data-testid={`invoice-link-${klien}`}>
                  Invoice <ArrowRight size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-6">
          <h2 className="font-display text-xl font-bold tracking-tight mb-4">Per Platform</h2>
          {perPlatform.length > 0 && (
            <div className="flex justify-center mb-4" data-testid="platform-donut">
              <Donut entries={perPlatform} />
            </div>
          )}
          <div className="space-y-2.5">
            {perPlatform.length === 0 && <div className="text-sm text-[var(--ms-text-muted)] text-center py-6">—</div>}
            {perPlatform.map(([p, v]) => {
              const color = PLATFORM_COLORS[p] || "#6d4cff";
              const pct = platformTotal ? Math.round((v.total / platformTotal) * 100) : 0;
              return (
                <div key={p} className="flex items-center justify-between p-3 rounded-xl bg-[var(--ms-bg)] border border-[var(--ms-border)]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <div>
                      <div className="font-semibold text-sm">{p}</div>
                      <div className="text-[0.68rem] text-[var(--ms-text-muted)] font-mono">{v.count} order · {pct}%</div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-sm">{fmt(v.total, display)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
