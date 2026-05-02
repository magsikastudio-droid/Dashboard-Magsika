import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dice5, Gem, CheckCircle2, Hourglass, Wallet, AlertTriangle, Briefcase, ArrowRight, Calendar } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { fmtRp, isLate, monthKey, monthLabel, currentMonth } from "../lib/format";
import { PLATFORM_COLORS } from "../lib/constants";

const StatCard = ({ icon: Icon, label, value, sub, accent, testid }) => (
  <div className="relative bg-white rounded-2xl border border-[var(--ms-border)] p-5 card-hover transition-base overflow-hidden" data-testid={testid}>
    <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />
    <div className="flex items-start justify-between mb-3">
      <div className="text-[0.65rem] uppercase tracking-[0.12em] font-bold text-[var(--ms-text-muted)] font-mono">{label}</div>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}1a`, color: accent }}>
        <Icon size={18} />
      </div>
    </div>
    <div className="font-display text-[1.65rem] font-extrabold tracking-tight leading-none truncate" data-testid={`${testid}-value`}>{value}</div>
    {sub && <div className="mt-2 text-xs text-[var(--ms-text-muted)] font-medium">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const { orders } = useOrders();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());

  const bulanList = useMemo(() => {
    const m = new Set(orders.map((o) => monthKey(o.tanggal)).filter(Boolean));
    m.add(currentMonth());
    return Array.from(m).sort().reverse();
  }, [orders]);

  const monthOrders = useMemo(() => orders.filter((o) => monthKey(o.tanggal) === month), [orders, month]);

  const stats = useMemo(() => {
    const total = monthOrders.length;
    const done = monthOrders.filter((o) => ["done", "delivered"].includes((o.status || "").toLowerCase())).length;
    const onProgress = total - done;
    const totalValue = monthOrders.reduce((s, o) => s + (o.value || 0), 0);
    const doneValue = monthOrders.filter((o) => ["done", "delivered"].includes((o.status || "").toLowerCase())).reduce((s, o) => s + (o.value || 0), 0);
    const onProgressValue = totalValue - doneValue;
    const unpaid = monthOrders.filter((o) => !o.paid).reduce((s, o) => s + (o.value || 0), 0);
    const totalFee = monthOrders.reduce((s, o) => s + (o.fee_freelance || 0), 0);
    const late = monthOrders.filter((o) => isLate(o.deadline, o.status));
    return { total, done, onProgress, totalValue, doneValue, onProgressValue, unpaid, late, totalFee, net: totalValue - totalFee };
  }, [monthOrders]);

  const perKlien = useMemo(() => {
    const map = {};
    monthOrders.forEach((o) => {
      if (!map[o.klien]) map[o.klien] = { count: 0, total: 0, done: 0, platforms: new Set() };
      map[o.klien].count += 1;
      map[o.klien].total += o.value || 0;
      if (["done", "delivered"].includes((o.status || "").toLowerCase())) map[o.klien].done += o.value || 0;
      if (o.platform) map[o.klien].platforms.add(o.platform);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [monthOrders]);

  const perPlatform = useMemo(() => {
    const map = {};
    monthOrders.forEach((o) => {
      const p = o.platform || "Direct";
      if (!map[p]) map[p] = { count: 0, total: 0 };
      map[p].count += 1;
      map[p].total += o.value || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [monthOrders]);

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
        <StatCard testid="stat-total-project" icon={Dice5} label="Total Project" value={stats.total} sub={`${stats.done} selesai · ${stats.onProgress} aktif`} accent="#6d4cff" />
        <StatCard testid="stat-total-value" icon={Gem} label="Total Value" value={fmtRp(stats.totalValue)} sub={monthLabel(month)} accent="#3a8dff" />
        <StatCard testid="stat-done" icon={CheckCircle2} label="Done / Selesai" value={fmtRp(stats.doneValue)} sub={`${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}% completion`} accent="#16a34a" />
        <StatCard testid="stat-net" icon={Hourglass} label="Net (— Fee)" value={fmtRp(stats.net)} sub={`Fee: ${fmtRp(stats.totalFee)}`} accent="#f59e0b" />
        <StatCard testid="stat-unpaid" icon={Wallet} label="Belum Dibayar" value={fmtRp(stats.unpaid)} sub="Outstanding" accent="#ef4444" />
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
                <div className="font-display text-lg font-extrabold mb-1" style={{ color: "var(--ms-primary)" }}>{fmtRp(v.total)}</div>
                <div className="text-xs text-emerald-700 font-medium mb-3">✓ Done: {fmtRp(v.done)}</div>
                <button onClick={() => navigate(`/invoice?klien=${encodeURIComponent(klien)}&bulan=${month}`)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-[0.7rem] font-semibold transition-base hover:opacity-90" style={{ background: "var(--ms-blue)" }} data-testid={`invoice-link-${klien}`}>
                  Invoice <ArrowRight size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-6">
          <h2 className="font-display text-xl font-bold tracking-tight mb-4">Per Platform</h2>
          <div className="space-y-2.5">
            {perPlatform.length === 0 && <div className="text-sm text-[var(--ms-text-muted)] text-center py-6">—</div>}
            {perPlatform.map(([p, v]) => {
              const color = PLATFORM_COLORS[p] || "#6d4cff";
              return (
                <div key={p} className="flex items-center justify-between p-3 rounded-xl bg-[var(--ms-bg)] border border-[var(--ms-border)]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <div>
                      <div className="font-semibold text-sm">{p}</div>
                      <div className="text-[0.68rem] text-[var(--ms-text-muted)] font-mono">{v.count} order</div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-sm">{fmtRp(v.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
