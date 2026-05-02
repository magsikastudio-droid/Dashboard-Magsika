import React, { useMemo, useState } from "react";
import { Plus, Zap, FileDown, ClipboardList, Search, Trash2, Pencil, AlertTriangle, CheckSquare, Square } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { JENIS_COLORS, STATUS_COLORS, KLIEN_COLORS, JENIS_OPTIONS, STATUS_OPTIONS } from "../lib/constants";
import { fmtRp, fmtDate, isLate, monthKey, monthLabel } from "../lib/format";
import Pill from "../components/Pill";
import OrderModal from "../components/OrderModal";
import { toast } from "sonner";

export default function Orders() {
  const { orders, deleteOrder, updateOrder } = useOrders();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [q, setQ] = useState("");
  const [klienFilter, setKlienFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bulanFilter, setBulanFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState("all");

  const klienList = useMemo(() => Array.from(new Set(orders.map((o) => o.klien))).filter(Boolean), [orders]);
  const bulanList = useMemo(() => Array.from(new Set(orders.map((o) => monthKey(o.tanggal)))).filter(Boolean).sort().reverse(), [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (q && !`${o.klien} ${o.project} ${(o.artists || []).join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (klienFilter !== "all" && o.klien !== klienFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (bulanFilter !== "all" && monthKey(o.tanggal) !== bulanFilter) return false;
      if (paidFilter === "paid" && !o.paid) return false;
      if (paidFilter === "unpaid" && o.paid) return false;
      return true;
    }).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [orders, q, klienFilter, statusFilter, bulanFilter, paidFilter]);

  const exportCSV = () => {
    const rows = [["Tanggal", "Klien", "Project", "Jenis", "Artist", "Deadline", "Value", "Status", "Bayar", "Catatan"]];
    filtered.forEach((o) => rows.push([o.tanggal, o.klien, o.project, o.jenis, (o.artists || []).join("; "), o.deadline, o.value, o.status, o.paid ? "LUNAS" : "BELUM", o.catatan || ""]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `magsika-orders-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV diexport");
  };

  const quickAdd = async () => {
    setEditing(null);
    setModalOpen(true);
  };

  const togglePaid = async (o) => {
    try {
      await updateOrder(o.id, { ...o, paid: !o.paid });
      toast.success(!o.paid ? "Ditandai LUNAS" : "Ditandai belum bayar");
    } catch { toast.error("Gagal update"); }
  };

  const handleDelete = async (o) => {
    if (!window.confirm(`Hapus order "${o.project}" dari ${o.klien}?`)) return;
    try { await deleteOrder(o.id); toast.success("Order dihapus"); } catch { toast.error("Gagal hapus"); }
  };

  const sel = "px-3.5 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm font-medium focus:outline-none focus:border-[var(--ms-primary)] transition-base";

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}>
            <ClipboardList size={20} />
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Semua Order 3D</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">{filtered.length} dari {orders.length} order</p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-emerald-300 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-base" data-testid="export-csv-btn"><FileDown size={15} /> Export CSV</button>
          <button onClick={quickAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--ms-border)] text-sm font-semibold hover:bg-[var(--ms-bg)] transition-base" data-testid="quick-add-btn"><Zap size={15} className="text-amber-500" /> Quick Add</button>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-semibold transition-base hover:opacity-90" style={{ background: "var(--ms-primary)" }} data-testid="add-order-btn"><Plus size={15} /> Tambah Order</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-4 flex flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari klien, project, artist..." className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)] transition-base" data-testid="search-input" />
        </div>
        <select className={sel} value={klienFilter} onChange={(e) => setKlienFilter(e.target.value)} data-testid="filter-klien">
          <option value="all">Semua Klien</option>
          {klienList.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className={sel} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="filter-status">
          <option value="all">Semua Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={sel} value={bulanFilter} onChange={(e) => setBulanFilter(e.target.value)} data-testid="filter-bulan">
          <option value="all">Semua Bulan</option>
          {bulanList.map((b) => <option key={b} value={b}>{monthLabel(b)}</option>)}
        </select>
        <select className={sel} value={paidFilter} onChange={(e) => setPaidFilter(e.target.value)} data-testid="filter-paid">
          <option value="all">Semua Transfer</option>
          <option value="paid">Sudah Lunas</option>
          <option value="unpaid">Belum Lunas</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="orders-table">
            <thead className="bg-[var(--ms-primary-soft)]">
              <tr className="text-left">
                {["#", "Tanggal", "Klien", "Project / Karakter", "Jenis", "Artist", "Deadline", "Value", "Status", "Bayar", "Aksi"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[0.7rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={11} className="text-center py-10 text-[var(--ms-text-muted)]">Tidak ada order yang cocok.</td></tr>}
              {filtered.map((o, idx) => {
                const late = isLate(o.deadline, o.status);
                const done = o.status === "Done";
                const jc = JENIS_COLORS[o.jenis] || JENIS_COLORS.Modeling;
                const sc = STATUS_COLORS[o.status] || STATUS_COLORS.Modeling;
                return (
                  <tr key={o.id} className={`border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)] transition-base ${done ? "opacity-60" : ""} ${late ? "bg-rose-50/40" : ""}`} data-testid={`order-row-${o.id}`}>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--ms-text-muted)]">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{fmtDate(o.tanggal)}</td>
                    <td className="px-4 py-3"><span className="px-2.5 py-1 rounded-md text-[0.72rem] font-bold font-mono" style={{ background: `${KLIEN_COLORS[o.klien] || "#94a3b8"}1a`, color: KLIEN_COLORS[o.klien] || "#475569" }}>{o.klien}</span></td>
                    <td className="px-4 py-3 font-semibold">{o.project}</td>
                    <td className="px-4 py-3"><Pill label={o.jenis} bg={jc.bg} text={jc.text} /></td>
                    <td className="px-4 py-3 text-xs text-[var(--ms-text-muted)] whitespace-nowrap">{(o.artists || []).join(", ") || "-"}</td>
                    <td className={`px-4 py-3 font-mono text-xs whitespace-nowrap ${late ? "text-rose-600 font-bold" : ""}`}>{late && <AlertTriangle size={12} className="inline mr-1" />}{fmtDate(o.deadline)}</td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap font-semibold">{fmtRp(o.value)}</td>
                    <td className="px-4 py-3"><Pill label={o.status} bg={sc.bg} text={sc.text} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => togglePaid(o)} className="flex items-center gap-1.5 text-xs font-bold font-mono" data-testid={`paid-toggle-${o.id}`}>
                        {o.paid ? <CheckSquare size={15} className="text-emerald-600" /> : <Square size={15} className="text-[var(--ms-text-muted)]" />}
                        <span style={{ color: o.paid ? "#15803d" : "#94a3b8" }}>{o.paid ? "LUNAS" : "BELUM"}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => { setEditing(o); setModalOpen(true); }} className="p-1.5 rounded-lg border border-[var(--ms-border)] hover:bg-[var(--ms-bg)] transition-base" data-testid={`edit-btn-${o.id}`} title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(o)} className="p-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-base" data-testid={`delete-btn-${o.id}`} title="Hapus"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <OrderModal open={modalOpen} onClose={() => setModalOpen(false)} order={editing} />
    </div>
  );
}
