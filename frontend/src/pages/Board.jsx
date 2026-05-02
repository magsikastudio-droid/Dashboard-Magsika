import React, { useMemo, useState } from "react";
import { KanbanSquare, Calendar, AlertTriangle, Users, Layers, GripVertical } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { ARTIST_COLORS, STATUS_COLORS, STATUS_OPTIONS } from "../lib/constants";
import { fmtDate, isLate } from "../lib/format";
import Pill from "../components/Pill";
import { toast } from "sonner";

export default function Board() {
  const { orders, reassignOrder } = useOrders();
  const [statusFilter, setStatusFilter] = useState("active");
  const [viewMode, setViewMode] = useState("artist"); // "artist" | "status"
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Group by artist
  const groupedByArtist = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      if (statusFilter === "active" && o.status === "Done") return;
      if (statusFilter !== "active" && statusFilter !== "all" && o.status !== statusFilter) return;
      (o.artists && o.artists.length ? o.artists : ["(Unassigned)"]).forEach((a) => {
        if (!map[a]) map[a] = [];
        map[a].push(o);
      });
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.deadline.localeCompare(b.deadline)));
    return map;
  }, [orders, statusFilter]);

  // Group by status
  const groupedByStatus = useMemo(() => {
    const map = {};
    STATUS_OPTIONS.forEach((s) => (map[s] = []));
    orders.forEach((o) => {
      if (statusFilter === "active" && o.status === "Done") return;
      if (statusFilter !== "active" && statusFilter !== "all" && o.status !== statusFilter) return;
      if (map[o.status]) map[o.status].push(o);
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.deadline.localeCompare(b.deadline)));
    return map;
  }, [orders, statusFilter]);

  const handleDragStart = (e, orderId) => {
    setDragId(orderId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", orderId);
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(colKey);
  };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = async (e, colKey) => {
    e.preventDefault();
    setDragOver(null);
    const orderId = dragId || e.dataTransfer.getData("text/plain");
    setDragId(null);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    if (viewMode === "status") {
      if (order.status === colKey) return;
      try {
        await reassignOrder(order.id, { status: colKey });
        toast.success(`Status → ${colKey}`);
      } catch { toast.error("Gagal pindah status"); }
    } else {
      // artist mode: replace artists with [colKey] (or add if not already)
      if (colKey === "(Unassigned)") return;
      const current = order.artists || [];
      if (current.length === 1 && current[0] === colKey) return;
      try {
        await reassignOrder(order.id, { artists: [colKey] });
        toast.success(`Diassign ke ${colKey}`);
      } catch { toast.error("Gagal reassign"); }
    }
  };

  const renderCard = (o, columnColor, isDraggingOverFromMe = false) => {
    const late = isLate(o.deadline, o.status);
    const done = o.status === "Done";
    const sc = STATUS_COLORS[o.status] || STATUS_COLORS.Modeling;
    const artistColor = ARTIST_COLORS[(o.artists || [])[0]] || ARTIST_COLORS.Default;
    const topColor = viewMode === "status" ? artistColor : columnColor;
    return (
      <div
        key={o.id}
        draggable
        onDragStart={(e) => handleDragStart(e, o.id)}
        onDragEnd={() => { setDragId(null); setDragOver(null); }}
        className={`group bg-white rounded-xl p-3.5 border-t-[3px] cursor-grab active:cursor-grabbing card-hover transition-base ${done ? "opacity-60" : ""} ${dragId === o.id ? "opacity-40" : ""}`}
        style={{ borderTopColor: topColor, borderRight: "1px solid var(--ms-border)", borderBottom: "1px solid var(--ms-border)", borderLeft: "1px solid var(--ms-border)" }}
        data-testid={`board-card-${o.id}`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)]">{o.klien}</div>
          <GripVertical size={13} className="text-[var(--ms-text-muted)] opacity-0 group-hover:opacity-60 transition-base flex-shrink-0" />
        </div>
        <div className="font-bold text-sm leading-snug mb-2.5">{o.project}</div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {viewMode === "status" ? (
            <div className="flex items-center gap-1 text-[0.7rem] font-mono font-semibold" style={{ color: artistColor }}>
              <Users size={11} /> {(o.artists || []).join(", ") || "Unassigned"}
            </div>
          ) : (
            <Pill label={o.status} bg={sc.bg} text={sc.text} />
          )}
          <div className={`flex items-center gap-1 text-[0.7rem] font-mono font-semibold ${late ? "text-rose-600" : done ? "text-emerald-700" : "text-[var(--ms-text-muted)]"}`}>
            {late ? <AlertTriangle size={11} /> : <Calendar size={11} />}
            {fmtDate(o.deadline)}
          </div>
        </div>
      </div>
    );
  };

  const renderColumn = (key, items, color, subLabel) => {
    const active = items.filter((i) => i.status !== "Done").length;
    const isOver = dragOver === key;
    return (
      <div
        key={key}
        onDragOver={(e) => handleDragOver(e, key)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, key)}
        className={`rounded-2xl p-4 border transition-base ${isOver ? "bg-[var(--ms-primary-soft)] border-[var(--ms-primary)]" : "bg-[var(--ms-primary-soft)]/40 border-[var(--ms-border)]"}`}
        data-testid={`column-${key}`}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-dashed" style={{ borderColor: `${color}40` }}>
          <h2 className="font-display text-xl font-extrabold tracking-tight" style={{ color }}>{key}</h2>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-white border border-[var(--ms-border)]">{subLabel || `${active} aktif`}</span>
        </div>
        <div className="space-y-3 min-h-[40px]">
          {items.length === 0 && <div className="text-xs text-[var(--ms-text-muted)] italic text-center py-4 border-2 border-dashed border-[var(--ms-border)] rounded-xl">Drop card di sini</div>}
          {items.map((o) => renderCard(o, color))}
        </div>
      </div>
    );
  };

  const columns = viewMode === "artist"
    ? Object.keys(groupedByArtist).sort().map((a) => [a, groupedByArtist[a], ARTIST_COLORS[a] || ARTIST_COLORS.Default])
    : STATUS_OPTIONS.map((s) => {
        const sc = STATUS_COLORS[s] || STATUS_COLORS.Modeling;
        return [s, groupedByStatus[s] || [], sc.text];
      });

  return (
    <div className="space-y-6" data-testid="board-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700"><KanbanSquare size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Board</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Drag &amp; drop card untuk {viewMode === "artist" ? "reassign artist" : "ubah status"}.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-[var(--ms-border)]" data-testid="view-mode-toggle">
            <button onClick={() => setViewMode("artist")} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-base ${viewMode === "artist" ? "text-white" : "text-[var(--ms-text-muted)]"}`} style={viewMode === "artist" ? { background: "var(--ms-primary)" } : {}} data-testid="view-artist-btn">
              <Users size={13} /> per Artist
            </button>
            <button onClick={() => setViewMode("status")} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-base ${viewMode === "status" ? "text-white" : "text-[var(--ms-text-muted)]"}`} style={viewMode === "status" ? { background: "var(--ms-primary)" } : {}} data-testid="view-status-btn">
              <Layers size={13} /> per Status
            </button>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 rounded-full border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)] transition-base" data-testid="board-filter-status">
            <option value="active">Active (non-Done)</option>
            <option value="all">Semua Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-10 text-center text-[var(--ms-text-muted)]">Belum ada project.</div>
      ) : (
        <div className={`grid gap-5 ${viewMode === "status" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
          {columns.map(([key, items, color]) => renderColumn(key, items, color))}
        </div>
      )}
    </div>
  );
}
