import React, { useMemo, useState } from "react";
import { KanbanSquare, Calendar, AlertTriangle, Users, Layers, GripVertical, CheckCircle2 } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { ARTIST_COLORS, STATUS_COLORS, STATUS_OPTIONS, DONE_STATUSES } from "../lib/constants";
import { fmtDate, isLate, isArchived } from "../lib/format";
import Pill from "../components/Pill";
import { toast } from "sonner";

const ACTIVE_STATUSES = STATUS_OPTIONS.filter((s) => !DONE_STATUSES.has(s));

export default function Board() {
  const { orders, reassignOrder } = useOrders();
  const [viewMode, setViewMode] = useState("artist");
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Split active vs done (ignore archived ones from past months)
  const active = useMemo(() => orders.filter((o) => !DONE_STATUSES.has((o.status || "").toLowerCase())), [orders]);
  const doneThisMonth = useMemo(() => orders.filter((o) => DONE_STATUSES.has((o.status || "").toLowerCase()) && !isArchived(o)), [orders]);

  const groupedByArtist = useMemo(() => {
    const map = {};
    active.forEach((o) => {
      (o.artists && o.artists.length ? o.artists : ["(Unassigned)"]).forEach((a) => {
        if (!map[a]) map[a] = [];
        map[a].push(o);
      });
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.deadline.localeCompare(b.deadline)));
    return map;
  }, [active]);

  const groupedByStatus = useMemo(() => {
    const map = {};
    ACTIVE_STATUSES.forEach((s) => (map[s] = []));
    active.forEach((o) => {
      const s = (o.status || "").toLowerCase();
      if (map[s]) map[s].push(o);
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.deadline.localeCompare(b.deadline)));
    return map;
  }, [active]);

  const handleDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); };
  const handleDragOver = (e, k) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(k); };
  const handleDrop = async (e, colKey) => {
    e.preventDefault(); setDragOver(null);
    const id = dragId || e.dataTransfer.getData("text/plain"); setDragId(null);
    const o = orders.find((x) => x.id === id); if (!o) return;
    if (viewMode === "status") {
      if ((o.status || "").toLowerCase() === colKey) return;
      try { await reassignOrder(o.id, { status: colKey }); toast.success(`Status → ${colKey}`); } catch { toast.error("Gagal"); }
    } else {
      if (colKey === "(Unassigned)") return;
      const cur = o.artists || [];
      if (cur.length === 1 && cur[0] === colKey) return;
      try { await reassignOrder(o.id, { artists: [colKey] }); toast.success(`Diassign ke ${colKey}`); } catch { toast.error("Gagal"); }
    }
  };

  const renderCard = (o, columnColor) => {
    const late = isLate(o.deadline, o.status);
    const sc = STATUS_COLORS[(o.status || "").toLowerCase()] || STATUS_COLORS.modeling;
    const artistColor = ARTIST_COLORS[(o.artists || [])[0]] || ARTIST_COLORS.Default;
    const topColor = viewMode === "status" ? artistColor : columnColor;
    return (
      <div key={o.id} draggable onDragStart={(e) => handleDragStart(e, o.id)} onDragEnd={() => { setDragId(null); setDragOver(null); }}
        className={`group bg-white rounded-xl p-3.5 border-t-[3px] cursor-grab active:cursor-grabbing card-hover transition-base ${dragId === o.id ? "opacity-40" : ""}`}
        style={{ borderTopColor: topColor, borderRight: "1px solid var(--ms-border)", borderBottom: "1px solid var(--ms-border)", borderLeft: "1px solid var(--ms-border)" }}
        data-testid={`board-card-${o.id}`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-[0.62rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)]">{o.klien}</div>
          <GripVertical size={13} className="text-[var(--ms-text-muted)] opacity-0 group-hover:opacity-60 flex-shrink-0" />
        </div>
        <div className="font-bold text-sm leading-snug mb-2">{o.project}</div>
        <div className="text-[0.62rem] font-mono text-[var(--ms-text-muted)] mb-2 truncate" title={o.folder_code}>{o.folder_code}</div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {viewMode === "status" ? (
            <div className="flex items-center gap-1 text-[0.68rem] font-mono font-semibold" style={{ color: artistColor }}>
              <Users size={11} /> {(o.artists || []).join(", ") || "Unassigned"}
            </div>
          ) : (
            <Pill label={o.status} bg={sc.bg} text={sc.text} />
          )}
          <div className={`flex items-center gap-1 text-[0.68rem] font-mono font-semibold ${late ? "text-rose-600" : "text-[var(--ms-text-muted)]"}`}>
            {late ? <AlertTriangle size={11} /> : <Calendar size={11} />}
            {fmtDate(o.deadline)}
          </div>
        </div>
      </div>
    );
  };

  const renderColumn = (key, items, color) => {
    const isOver = dragOver === key;
    return (
      <div key={key} onDragOver={(e) => handleDragOver(e, key)} onDragLeave={() => setDragOver(null)} onDrop={(e) => handleDrop(e, key)}
        className={`rounded-2xl p-4 border transition-base ${isOver ? "bg-[var(--ms-primary-soft)] border-[var(--ms-primary)]" : "bg-[var(--ms-primary-soft)]/40 border-[var(--ms-border)]"}`} data-testid={`column-${key}`}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-dashed" style={{ borderColor: `${color}40` }}>
          <h2 className="font-display text-lg font-extrabold tracking-tight capitalize" style={{ color }}>{key}</h2>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-white border border-[var(--ms-border)]">{items.length}</span>
        </div>
        <div className="space-y-3 min-h-[40px]">
          {items.length === 0 && <div className="text-xs text-[var(--ms-text-muted)] italic text-center py-4 border-2 border-dashed border-[var(--ms-border)] rounded-xl">Drop di sini</div>}
          {items.map((o) => renderCard(o, color))}
        </div>
      </div>
    );
  };

  const columns = viewMode === "artist"
    ? Object.keys(groupedByArtist).sort().map((a) => [a, groupedByArtist[a], ARTIST_COLORS[a] || ARTIST_COLORS.Default])
    : ACTIVE_STATUSES.map((s) => {
        const sc = STATUS_COLORS[s] || STATUS_COLORS.modeling;
        return [s, groupedByStatus[s] || [], sc.text];
      });

  return (
    <div className="space-y-6" data-testid="board-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700"><KanbanSquare size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Board</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Drag card untuk {viewMode === "artist" ? "reassign artist" : "ubah status"}.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-[var(--ms-border)]" data-testid="view-mode-toggle">
          <button onClick={() => setViewMode("artist")} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-base ${viewMode === "artist" ? "text-white" : "text-[var(--ms-text-muted)]"}`} style={viewMode === "artist" ? { background: "var(--ms-primary)" } : {}} data-testid="view-artist-btn"><Users size={13} /> per Artist</button>
          <button onClick={() => setViewMode("status")} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-base ${viewMode === "status" ? "text-white" : "text-[var(--ms-text-muted)]"}`} style={viewMode === "status" ? { background: "var(--ms-primary)" } : {}} data-testid="view-status-btn"><Layers size={13} /> per Status</button>
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-10 text-center text-[var(--ms-text-muted)]">Belum ada project aktif.</div>
      ) : (
        <div className={`grid gap-4 ${viewMode === "status" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
          {columns.map(([key, items, color]) => renderColumn(key, items, color))}
        </div>
      )}

      {doneThisMonth.length > 0 && (
        <section className="bg-white rounded-2xl border border-[var(--ms-border)] p-5" data-testid="done-section">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700"><CheckCircle2 size={18} /></div>
            <h2 className="font-display text-xl font-bold tracking-tight">Selesai bulan ini</h2>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">{doneThisMonth.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {doneThisMonth.map((o) => {
              const sc = STATUS_COLORS[(o.status || "").toLowerCase()] || STATUS_COLORS.done;
              return (
                <div key={o.id} className="bg-[var(--ms-bg)] rounded-xl p-3 border border-[var(--ms-border)] opacity-75" data-testid={`done-card-${o.id}`}>
                  <div className="text-[0.62rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">{o.klien}</div>
                  <div className="font-semibold text-sm mb-2 truncate" title={o.project}>{o.project}</div>
                  <div className="flex items-center justify-between">
                    <Pill label={o.status} bg={sc.bg} text={sc.text} />
                    <span className="text-[0.68rem] font-mono text-[var(--ms-text-muted)]">{fmtDate(o.deadline)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
