import React, { useMemo, useState } from "react";
import { Archive as ArchiveIcon, FileDown, Search } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { fmtRp, fmtDate, monthKey, monthLabel, isArchived } from "../lib/format";
import { PLATFORM_COLORS, STATUS_COLORS } from "../lib/constants";
import Pill from "../components/Pill";

export default function Archive() {
  const { orders } = useOrders();
  const [q, setQ] = useState("");
  const [bulan, setBulan] = useState("all");

  const archived = useMemo(() => orders.filter(isArchived), [orders]);
  const bulanList = useMemo(() => Array.from(new Set(archived.map((o) => monthKey(o.tanggal)))).sort().reverse(), [archived]);

  const filtered = useMemo(() => archived.filter((o) => {
    if (bulan !== "all" && monthKey(o.tanggal) !== bulan) return false;
    if (q && !`${o.klien} ${o.project} ${o.folder_code} ${o.order_id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => b.tanggal.localeCompare(a.tanggal)), [archived, bulan, q]);

  const exportCSV = () => {
    const rows = [["Tanggal", "Platform", "Marketer", "Order ID", "Folder", "Klien", "Project", "Artist", "Value", "Fee", "Status", "Bayar"]];
    filtered.forEach((o) => rows.push([o.tanggal, o.platform, o.marketer, o.order_id, o.folder_code, o.klien, o.project, (o.artists || []).join("; "), o.value, o.fee_freelance, o.status, o.paid ? "LUNAS" : "BELUM"]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `magsika-archive-${bulan}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="archive-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700"><ArchiveIcon size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Arsip Order</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Rekening koran — project selesai dari bulan-bulan lalu. {filtered.length} dari {archived.length}</p>
          </div>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-emerald-300 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-base" data-testid="archive-export-btn"><FileDown size={15} /> Export CSV</button>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari project / klien / folder..." className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)]" data-testid="archive-search" />
        </div>
        <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="px-4 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm font-semibold" data-testid="archive-month">
          <option value="all">Semua Bulan</option>
          {bulanList.map((b) => <option key={b} value={b}>{monthLabel(b)}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--ms-primary-soft)]">
              <tr className="text-left">
                {["Tanggal", "Platform", "Folder Code", "Klien", "Project", "Artist", "Value", "Fee", "Status", "Bayar"].map((h) => <th key={h} className="px-3 py-3 text-[0.68rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={10} className="text-center py-10 text-[var(--ms-text-muted)]">Belum ada arsip.</td></tr>}
              {filtered.map((o) => {
                const sc = STATUS_COLORS[(o.status || "").toLowerCase()] || STATUS_COLORS.done;
                return (
                  <tr key={o.id} className="border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)]" data-testid={`archive-row-${o.id}`}>
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{fmtDate(o.tanggal)}</td>
                    <td className="px-3 py-3"><span className="text-[0.68rem] font-bold font-mono px-2 py-0.5 rounded-md" style={{ background: `${PLATFORM_COLORS[o.platform] || "#6d4cff"}1a`, color: PLATFORM_COLORS[o.platform] || "#6d4cff" }}>{o.platform}</span></td>
                    <td className="px-3 py-3 font-mono text-[0.68rem]">{o.folder_code}</td>
                    <td className="px-3 py-3 text-xs font-semibold">{o.klien}</td>
                    <td className="px-3 py-3 text-sm font-semibold">{o.project}</td>
                    <td className="px-3 py-3 text-xs text-[var(--ms-text-muted)]">{(o.artists || []).join(", ")}</td>
                    <td className="px-3 py-3 font-mono font-semibold">{fmtRp(o.value)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-[var(--ms-text-muted)]">{fmtRp(o.fee_freelance || 0)}</td>
                    <td className="px-3 py-3"><Pill label={o.status} bg={sc.bg} text={sc.text} /></td>
                    <td className="px-3 py-3 text-xs font-bold font-mono" style={{ color: o.paid ? "#15803d" : "#b91c1c" }}>{o.paid ? "LUNAS" : "BELUM"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
