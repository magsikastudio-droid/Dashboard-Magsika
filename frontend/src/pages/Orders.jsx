import React, { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileDown, ClipboardList, Search, Trash2, Pencil, AlertTriangle, CheckSquare, Square, Receipt, Upload } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { JENIS_COLORS, statusColor, PLATFORM_COLORS, MARKETER_COLORS, PLATFORM_OPTIONS, MARKETER_OPTIONS, STATUS_OPTIONS, DONE_STATUSES } from "../lib/constants";
import { fmtDate, isLate, monthKey, monthLabel, currentMonth, isArchived } from "../lib/format";
import Pill from "../components/Pill";
import OrderModal from "../components/OrderModal";
import ImportCSVModal from "../components/ImportCSVModal";
import { toast } from "sonner";

const daysToDeadline = (deadlineIso) => {
  if (!deadlineIso) return null;
  const d = new Date(deadlineIso); d.setHours(23, 59, 0, 0);
  return Math.ceil((d - new Date()) / 86400000);
};

const deadlineColor = (deadline, status) => {
  if (DONE_STATUSES.has((status || "").toLowerCase())) return "text-[var(--ms-text-muted)]";
  const d = daysToDeadline(deadline);
  if (d === null) return "";
  if (d < 0) return "text-rose-600 font-bold";
  if (d < 3) return "text-rose-600 font-bold";
  if (d < 5) return "text-amber-600 font-semibold";
  return "text-[var(--ms-text-muted)]";
};

export default function Orders() {
  const { orders, deleteOrder, updateOrder, fetchOrders } = useOrders();
  const { fmt } = useCurrency();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [q, setQ] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [marketerFilter, setMarketerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bulanFilter, setBulanFilter] = useState(currentMonth());
  const [paidFilter, setPaidFilter] = useState("all");

  const bulanList = useMemo(() => { const m = new Set(orders.map((o) => monthKey(o.tanggal)).filter(Boolean)); m.add(currentMonth()); return Array.from(m).sort().reverse(); }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (isArchived(o) && bulanFilter === currentMonth()) return false;
      if (bulanFilter !== "all" && monthKey(o.tanggal) !== bulanFilter) return false;
      if (q) {
        const blob = `${o.klien} ${o.project} ${(o.artists || []).join(" ")} ${o.order_id || ""} ${o.folder_code || ""} ${o.platform || ""} ${o.marketer || ""}`.toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      if (platformFilter !== "all" && o.platform !== platformFilter) return false;
      if (marketerFilter !== "all" && o.marketer !== marketerFilter) return false;
      if (statusFilter !== "all" && (o.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (paidFilter === "paid" && !o.paid) return false;
      if (paidFilter === "unpaid" && o.paid) return false;
      return true;
    }).sort((a, b) => {
      const ad = DONE_STATUSES.has((a.status || "").toLowerCase());
      const bd = DONE_STATUSES.has((b.status || "").toLowerCase());
      if (ad !== bd) return ad ? 1 : -1; // done at bottom
      return (a.deadline || "").localeCompare(b.deadline || ""); // nearest deadline first
    });
  }, [orders, q, platformFilter, marketerFilter, statusFilter, bulanFilter, paidFilter]);

  const exportCSV = () => {
    const rows = [["Tanggal", "Platform", "Marketer", "Order ID", "Folder Code", "Klien", "Project", "Jenis", "Artist", "Deadline", "Value", "Currency", "Fee", "Status", "Bayar"]];
    filtered.forEach((o) => rows.push([o.tanggal, o.platform, o.marketer, o.order_id, o.folder_code, o.klien, o.project, o.jenis, (o.artists || []).join("; "), o.deadline, o.value, o.currency || "USD", o.fee_freelance, o.status, o.paid ? "LUNAS" : "BELUM"]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `magsika-orders-${bulanFilter}.csv`; a.click();
    toast.success("CSV diexport");
  };

  const togglePaid = async (o) => { try { await updateOrder(o.id, { ...o, paid: !o.paid }); toast.success(!o.paid ? "LUNAS" : "BELUM"); } catch { toast.error("Gagal"); } };
  const handleDelete = async (o) => { if (!window.confirm(`Hapus "${o.project}"?`)) return; try { await deleteOrder(o.id); toast.success("Dihapus"); } catch { toast.error("Gagal"); } };

  const handleStatusChange = async (o, newStatus) => {
    try {
      await updateOrder(o.id, { ...o, status: newStatus });
      toast.success(`Status: ${newStatus}`);
    } catch { toast.error("Gagal update status"); }
  };

  const sel = "px-3 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm font-medium focus:outline-none focus:border-[var(--ms-primary)]";
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}><ClipboardList size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Semua Order 3D</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">{filtered.length} dari {orders.length} order · <span className="font-mono">{monthLabel(bulanFilter)}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[var(--ms-border)] text-sm font-semibold hover:bg-[var(--ms-bg)] transition-base" data-testid="import-csv-btn"><Upload size={15} /> Import CSV</button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[var(--ms-border)] text-sm font-semibold hover:bg-[var(--ms-bg)] transition-base" data-testid="export-csv-btn"><FileDown size={15} /> Export CSV</button>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-sm font-semibold transition-base hover:opacity-90" style={{ background: "var(--ms-primary)" }} data-testid="add-order-btn"><Plus size={15} /> Tambah Order</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari project, klien, order ID..." className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)]" data-testid="search-input" />
        </div>
        <select className={sel} value={bulanFilter} onChange={(e) => setBulanFilter(e.target.value)} data-testid="filter-bulan">
          <option value="all">Semua Bulan</option>
          {bulanList.map((b) => <option key={b} value={b}>{monthLabel(b)}{b === currentMonth() ? " (skrg)" : ""}</option>)}
        </select>
        <select className={sel} value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} data-testid="filter-platform">
          <option value="all">Semua Platform</option>
          {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
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
          <table className="w-full text-sm" data-testid="orders-table" style={{ tableLayout: "fixed", minWidth: 1280 }}>
            <colgroup>
              <col style={{ width: 30 }} /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 180 }} /><col style={{ width: 110 }} /><col /><col style={{ width: 80 }} /><col style={{ width: 100 }} /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 130 }} /><col style={{ width: 70 }} /><col style={{ width: 90 }} />
            </colgroup>
            <thead className="bg-[var(--ms-primary-soft)]">
              <tr className="text-left">
                {["#", "Tanggal", "Platform", "Marketer", "Order ID", "Folder Code", "Klien", "Project", "Jenis", "Artist", "Deadline", "Value", "Status Pekerjaan", "Bayar", "Aksi"].map((h) => (
                  <th key={h} className="px-2 py-3 text-[0.66rem] uppercase tracking-wider font-bold font-mono whitespace-nowrap truncate" style={{ color: "var(--ms-primary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={15} className="text-center py-10 text-[var(--ms-text-muted)]">Tidak ada order.</td></tr>}
              {filtered.map((o, idx) => {
                const sc = statusColor(o.status);
                const jc = JENIS_COLORS[o.jenis] || JENIS_COLORS.Modeling;
                const dlColor = deadlineColor(o.deadline, o.status);
                const isDone = DONE_STATUSES.has((o.status || "").toLowerCase());
                return (
                  <tr key={o.id} className={`border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)] transition-base ${isDone ? "opacity-60" : ""}`} data-testid={`order-row-${o.id}`}>
                    <td className="px-2 py-3 font-mono text-xs text-[var(--ms-text-muted)]">{idx + 1}</td>
                    <td className="px-2 py-3 font-mono text-xs whitespace-nowrap">{fmtDate(o.tanggal)}</td>
                    <td className="px-2 py-3 truncate"><span className="text-[0.68rem] font-bold font-mono px-1.5 py-0.5 rounded" style={{ background: `${PLATFORM_COLORS[o.platform] || "#6d4cff"}1a`, color: PLATFORM_COLORS[o.platform] || "#6d4cff" }}>{o.platform || "-"}</span></td>
                    <td className="px-2 py-3 text-xs truncate">{o.marketer ? <span className="font-semibold" style={{ color: MARKETER_COLORS[o.marketer] || "#475569" }}>{o.marketer}</span> : "—"}</td>
                    <td className="px-2 py-3 font-mono text-xs truncate">{o.order_id || "—"}</td>
                    <td className="px-2 py-3 font-mono text-[0.66rem] truncate" title={o.folder_code}>{o.folder_code || "—"}</td>
                    <td className="px-2 py-3 text-xs font-semibold truncate">{o.klien}</td>
                    <td className="px-2 py-3 font-semibold text-sm truncate" title={o.project}>{o.project}</td>
                    <td className="px-2 py-3 truncate"><Pill label={o.jenis} bg={jc.bg} text={jc.text} /></td>
                    <td className="px-2 py-3 text-xs text-[var(--ms-text-muted)] truncate">{(o.artists || []).join(", ")}</td>
                    <td className={`px-2 py-3 font-mono text-xs whitespace-nowrap ${dlColor}`} title={o.deadline}>
                      {dlColor.includes("rose") && <AlertTriangle size={10} className="inline mr-0.5" />}
                      {fmtDate(o.deadline)}
                    </td>
                    <td className="px-2 py-3 font-mono text-xs whitespace-nowrap font-semibold">{fmt(o.value, o.currency || "USD")}</td>
                    <td className="px-2 py-3 truncate">
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 rounded-full text-[0.68rem] font-bold font-mono cursor-pointer border-0 focus:ring-2 focus:ring-[var(--ms-primary)]/40 focus:outline-none appearance-none"
                        style={{ background: sc.bg, color: sc.text }}
                        data-testid={`status-select-${o.id}`}
                        title="Klik untuk ubah status"
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s} style={{ background: "white", color: "#0f172a" }}>{cap(s)}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => togglePaid(o)} className="flex items-center gap-1 text-[0.66rem] font-bold font-mono" data-testid={`paid-toggle-${o.id}`}>
                        {o.paid ? <CheckSquare size={13} className="text-emerald-600" /> : <Square size={13} className="text-[var(--ms-text-muted)]" />}
                        <span style={{ color: o.paid ? "#15803d" : "#94a3b8" }}>{o.paid ? "LUNAS" : "BELUM"}</span>
                      </button>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex gap-0.5">
                        <button onClick={() => navigate(`/invoice?orderId=${o.id}`)} className="p-1 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50" data-testid={`invoice-btn-${o.id}`} title="Invoice"><Receipt size={12} /></button>
                        <button onClick={() => { setEditing(o); setModalOpen(true); }} className="p-1 rounded-lg border border-[var(--ms-border)] hover:bg-[var(--ms-bg)]" data-testid={`edit-btn-${o.id}`} title="Edit"><Pencil size={12} /></button>
                        <button onClick={() => handleDelete(o)} className="p-1 rounded-lg bg-rose-500 text-white hover:bg-rose-600" data-testid={`delete-btn-${o.id}`} title="Hapus"><Trash2 size={12} /></button>
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
      <ImportCSVModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => { fetchOrders(); }} />
    </div>
  );
}
