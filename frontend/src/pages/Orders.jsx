import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Zap, FileDown, ClipboardList, Search, Trash2, Pencil, AlertTriangle, CheckSquare, Square, Receipt, Archive } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { JENIS_COLORS, STATUS_COLORS, PLATFORM_COLORS, MARKETER_COLORS, PLATFORM_OPTIONS, MARKETER_OPTIONS, STATUS_OPTIONS } from "../lib/constants";
import { fmtRp, fmtDate, isLate, monthKey, monthLabel, currentMonth, isArchived } from "../lib/format";
import Pill from "../components/Pill";
import OrderModal from "../components/OrderModal";
import { toast } from "sonner";

export default function Orders() {
  const { orders, deleteOrder, updateOrder } = useOrders();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [q, setQ] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [marketerFilter, setMarketerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bulanFilter, setBulanFilter] = useState(currentMonth());
  const [paidFilter, setPaidFilter] = useState("all");

  const bulanList = useMemo(() => {
    const m = new Set(orders.map((o) => monthKey(o.tanggal)).filter(Boolean));
    m.add(currentMonth());
    return Array.from(m).sort().reverse();
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      // Hide archived from main view (done+past-month)
      if (isArchived(o) && bulanFilter === currentMonth()) return false;
      if (bulanFilter !== "all" && monthKey(o.tanggal) !== bulanFilter) return false;
      if (q) {
        const blob = `${o.klien} ${o.project} ${(o.artists || []).join(" ")} ${o.order_id || ""} ${o.folder_code || ""} ${o.platform || ""} ${o.marketer || ""}`.toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      if (platformFilter !== "all" && o.platform !== platformFilter) return false;
      if (marketerFilter !== "all" && o.marketer !== marketerFilter) return false;
      if (statusFilter !== "all" && (o.status || "").toLowerCase() !== statusFilter) return false;
      if (paidFilter === "paid" && !o.paid) return false;
      if (paidFilter === "unpaid" && o.paid) return false;
      return true;
    }).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [orders, q, platformFilter, marketerFilter, statusFilter, bulanFilter, paidFilter]);

  const exportCSV = () => {
    const rows = [["Tanggal", "Platform", "Marketer", "Order ID", "Folder Code", "Klien", "Project", "Jenis", "Artist", "Deadline", "Value", "Fee Freelance", "Status", "Bayar", "Catatan"]];
    filtered.forEach((o) => rows.push([o.tanggal, o.platform, o.marketer, o.order_id, o.folder_code, o.klien, o.project, o.jenis, (o.artists || []).join("; "), o.deadline, o.value, o.fee_freelance, o.status, o.paid ? "LUNAS" : "BELUM", o.catatan || ""]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `magsika-orders-${bulanFilter}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV diexport");
  };

  const togglePaid = async (o) => {
    try { await updateOrder(o.id, { ...o, paid: !o.paid }); toast.success(!o.paid ? "Ditandai LUNAS" : "Ditandai BELUM"); } catch { toast.error("Gagal update"); }
  };

  const handleDelete = async (o) => {
    if (!window.confirm(`Hapus order "${o.project}" dari ${o.klien}?`)) return;
    try { await deleteOrder(o.id); toast.success("Order dihapus"); } catch { toast.error("Gagal hapus"); }
  };

  const sel = "px-3 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm font-medium focus:outline-none focus:border-[var(--ms-primary)] transition-base";

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}>
            <ClipboardList size={20} />
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Semua Order 3D</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">{filtered.length} dari {orders.length} · <span className="font-mono">{monthLabel(bulanFilter)}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/archive")} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--ms-border)] text-sm font-semibold hover:bg-[var(--ms-bg)] transition-base" data-testid="go-archive-btn"><Archive size={15} /> Arsip</button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-emerald-300 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-base" data-testid="export-csv-btn"><FileDown size={15} /> Export CSV</button>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--ms-border)] text-sm font-semibold hover:bg-[var(--ms-bg)] transition-base" data-testid="quick-add-btn"><Zap size={15} className="text-amber-500" /> Quick Add</button>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-semibold transition-base hover:opacity-90" style={{ background: "var(--ms-primary)" }} data-testid="add-order-btn"><Plus size={15} /> Tambah Order</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari project, klien, folder, order ID..." className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)] transition-base" data-testid="search-input" />
        </div>
        <select className={sel} value={bulanFilter} onChange={(e) => setBulanFilter(e.target.value)} data-testid="filter-bulan">
          <option value="all">Semua Bulan</option>
          {bulanList.map((b) => <option key={b} value={b}>{monthLabel(b)}{b === currentMonth() ? " (skrg)" : ""}</option>)}
        </select>
        <select className={sel} value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} data-testid="filter-platform">
          <option value="all">Semua Platform</option>
          {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={sel} value={marketerFilter} onChange={(e) => setMarketerFilter(e.target.value)} data-testid="filter-marketer">
          <option value="all">Semua Marketer</option>
          {MARKETER_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className={sel} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="filter-status">
          <option value="all">Semua Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={sel} value={paidFilter} onChange={(e) => setPaidFilter(e.target.value)} data-testid="filter-paid">
          <option value="all">Semua Bayar</option>
          <option value="paid">Lunas</option>
          <option value="unpaid">Belum Lunas</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="orders-table">
            <thead className="bg-[var(--ms-primary-soft)]">
              <tr className="text-left">
                {["#", "Tanggal", "Platform", "Marketer", "Order ID", "Folder Code", "Klien", "Project", "Jenis", "Artist", "Deadline", "Value", "Fee", "Status", "Bayar", "Aksi"].map((h) => (
                  <th key={h} className="px-3 py-3 text-[0.68rem] uppercase tracking-wider font-bold font-mono whitespace-nowrap" style={{ color: "var(--ms-primary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={16} className="text-center py-10 text-[var(--ms-text-muted)]">Tidak ada order di bulan ini.</td></tr>}
              {filtered.map((o, idx) => {
                const late = isLate(o.deadline, o.status);
                const sc = STATUS_COLORS[(o.status || "").toLowerCase()] || STATUS_COLORS.modeling;
                const jc = JENIS_COLORS[o.jenis] || JENIS_COLORS.Modeling;
                return (
                  <tr key={o.id} className={`border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)] transition-base ${late ? "bg-rose-50/40" : ""}`} data-testid={`order-row-${o.id}`}>
                    <td className="px-3 py-3 font-mono text-xs text-[var(--ms-text-muted)]">{idx + 1}</td>
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{fmtDate(o.tanggal)}</td>
                    <td className="px-3 py-3"><span className="text-[0.7rem] font-bold font-mono px-2 py-0.5 rounded-md" style={{ background: `${PLATFORM_COLORS[o.platform] || "#6d4cff"}1a`, color: PLATFORM_COLORS[o.platform] || "#6d4cff" }}>{o.platform || "-"}</span></td>
                    <td className="px-3 py-3 text-xs">{o.marketer ? <span className="font-semibold" style={{ color: MARKETER_COLORS[o.marketer] || "#475569" }}>{o.marketer}</span> : <span className="text-[var(--ms-text-muted)]">—</span>}</td>
                    <td className="px-3 py-3 font-mono text-xs">{o.order_id || "—"}</td>
                    <td className="px-3 py-3"><span className="font-mono text-[0.68rem] bg-[var(--ms-bg)] px-1.5 py-0.5 rounded border border-[var(--ms-border)]" title={o.folder_code}>{o.folder_code || "—"}</span></td>
                    <td className="px-3 py-3 text-xs font-semibold whitespace-nowrap max-w-[140px] truncate">{o.klien}</td>
                    <td className="px-3 py-3 font-semibold text-sm max-w-[180px] truncate" title={o.project}>{o.project}</td>
                    <td className="px-3 py-3"><Pill label={o.jenis} bg={jc.bg} text={jc.text} /></td>
                    <td className="px-3 py-3 text-xs text-[var(--ms-text-muted)] whitespace-nowrap max-w-[100px] truncate">{(o.artists || []).join(", ") || "-"}</td>
                    <td className={`px-3 py-3 font-mono text-xs whitespace-nowrap ${late ? "text-rose-600 font-bold" : ""}`}>{late && <AlertTriangle size={11} className="inline mr-1" />}{fmtDate(o.deadline)}</td>
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap font-semibold">{fmtRp(o.value)}</td>
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap text-[var(--ms-text-muted)]">{fmtRp(o.fee_freelance || 0)}</td>
                    <td className="px-3 py-3"><Pill label={o.status} bg={sc.bg} text={sc.text} /></td>
                    <td className="px-3 py-3">
                      <button onClick={() => togglePaid(o)} className="flex items-center gap-1 text-xs font-bold font-mono" data-testid={`paid-toggle-${o.id}`}>
                        {o.paid ? <CheckSquare size={14} className="text-emerald-600" /> : <Square size={14} className="text-[var(--ms-text-muted)]" />}
                        <span style={{ color: o.paid ? "#15803d" : "#94a3b8" }}>{o.paid ? "LUNAS" : "BELUM"}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => navigate(`/invoice?orderId=${o.id}`)} className="p-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-base" data-testid={`invoice-btn-${o.id}`} title="Buat Invoice"><Receipt size={13} /></button>
                        <button onClick={() => { setEditing(o); setModalOpen(true); }} className="p-1.5 rounded-lg border border-[var(--ms-border)] hover:bg-[var(--ms-bg)] transition-base" data-testid={`edit-btn-${o.id}`} title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(o)} className="p-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-base" data-testid={`delete-btn-${o.id}`} title="Hapus"><Trash2 size={13} /></button>
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
