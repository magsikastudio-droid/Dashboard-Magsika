import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dice5, Gem, CheckCircle2, Hourglass, Wallet, AlertTriangle, Briefcase, ArrowRight, CalendarPlus } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { fmtRp, isLate } from "../lib/format";
import { KLIEN_COLORS } from "../lib/constants";

const StatCard = ({ icon: Icon, label, value, sub, accent, testid }) => (
  <div className="relative bg-white rounded-2xl border border-[var(--ms-border)] p-5 card-hover transition-base overflow-hidden" data-testid={testid}>
    <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />
    <div className="flex items-start justify-between mb-3">
      <div className="text-[0.65rem] uppercase tracking-[0.12em] font-bold text-[var(--ms-text-muted)] font-mono">{label}</div>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}1a`, color: accent }}>
        <Icon size={18} />
      </div>
    </div>
    <div className="font-display text-[1.85rem] font-extrabold tracking-tight leading-none" data-testid={`${testid}-value`}>{value}</div>
    {sub && <div className="mt-2 text-xs text-[var(--ms-text-muted)] font-medium">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const { orders } = useOrders();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const total = orders.length;
    const done = orders.filter((o) => o.status === "Done").length;
    const onProgress = total - done;
    const totalValue = orders.reduce((s, o) => s + (o.value || 0), 0);
    const doneValue = orders.filter((o) => o.status === "Done").reduce((s, o) => s + (o.value || 0), 0);
    const onProgressValue = totalValue - doneValue;
    const unpaid = orders.filter((o) => !o.paid).reduce((s, o) => s + (o.value || 0), 0);
    const late = orders.filter((o) => isLate(o.deadline, o.status));
    return { total, done, onProgress, totalValue, doneValue, onProgressValue, unpaid, late };
  }, [orders]);

  const perKlien = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      if (!map[o.klien]) map[o.klien] = { count: 0, total: 0, done: 0 };
      map[o.klien].count += 1;
      map[o.klien].total += o.value || 0;
      if (o.status === "Done") map[o.klien].done += o.value || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [orders]);

  return (
    <div className="space-y-7" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-[var(--ms-text-muted)] mt-1 text-sm">Ringkasan administrasi order 3D Magsika Studio.</p>
        </div>
      </div>

      {stats.late.length > 0 && (
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
        <StatCard testid="stat-total-project" icon={Dice5} label="Total Project" value={stats.total} sub={`${stats.done} selesai · ${stats.onProgress} on progress`} accent="#6d4cff" />
        <StatCard testid="stat-total-value" icon={Gem} label="Total Value" value={fmtRp(stats.totalValue)} sub="Akumulasi semua order" accent="#3a8dff" />
        <StatCard testid="stat-done" icon={CheckCircle2} label="Done / Selesai" value={fmtRp(stats.doneValue)} sub={`${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}% completion`} accent="#16a34a" />
        <StatCard testid="stat-on-progress" icon={Hourglass} label="On Progress" value={fmtRp(stats.onProgressValue)} sub={`${stats.onProgress} project aktif`} accent="#f59e0b" />
        <StatCard testid="stat-unpaid" icon={Wallet} label="Belum Dibayar" value={fmtRp(stats.unpaid)} sub="Tagihan outstanding" accent="#ef4444" />
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}>
              <Briefcase size={18} />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Total per Klien</h2>
          </div>
          <button onClick={() => navigate("/orders")} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-semibold transition-base hover:opacity-90" style={{ background: "var(--ms-blue)" }} data-testid="bulan-baru-btn">
            <CalendarPlus size={15} /> Bulan Baru
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="klien-grid">
          {perKlien.length === 0 && <div className="text-sm text-[var(--ms-text-muted)] col-span-full text-center py-8">Belum ada data order.</div>}
          {perKlien.map(([klien, v]) => (
            <div key={klien} className="bg-[var(--ms-bg)] rounded-2xl p-5 border border-[var(--ms-border)] card-hover transition-base" data-testid={`klien-card-${klien}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: KLIEN_COLORS[klien] || "#94a3b8" }} />
                <h3 className="font-display text-lg font-bold tracking-tight">{klien}</h3>
              </div>
              <div className="text-xs text-[var(--ms-text-muted)] mb-3 font-mono">{v.count} project</div>
              <div className="font-display text-xl font-extrabold mb-1" style={{ color: "var(--ms-primary)" }}>{fmtRp(v.total)}</div>
              <div className="text-xs text-emerald-700 font-medium mb-4">✓ Done: {fmtRp(v.done)}</div>
              <button onClick={() => navigate(`/invoice?klien=${encodeURIComponent(klien)}`)} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white text-xs font-semibold transition-base hover:opacity-90" style={{ background: "var(--ms-blue)" }} data-testid={`invoice-link-${klien}`}>
                Invoice <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
