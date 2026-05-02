import React, { useMemo, useState } from "react";
import { KanbanSquare, Calendar, AlertTriangle } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { ARTIST_COLORS, STATUS_COLORS } from "../lib/constants";
import { fmtDate, isLate } from "../lib/format";
import Pill from "../components/Pill";

export default function Board() {
  const { orders } = useOrders();
  const [statusFilter, setStatusFilter] = useState("active");

  const grouped = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      if (statusFilter === "active" && o.status === "Done") return;
      if (statusFilter !== "all" && statusFilter !== "active" && o.status !== statusFilter) return;
      (o.artists || []).forEach((a) => {
        if (!a) return;
        if (!map[a]) map[a] = [];
        map[a].push(o);
      });
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.deadline.localeCompare(b.deadline)));
    return map;
  }, [orders, statusFilter]);

  const sortedArtists = Object.keys(grouped).sort();

  return (
    <div className="space-y-6" data-testid="board-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700"><KanbanSquare size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Board per Artist</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">{sortedArtists.length} artist aktif</p>
          </div>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 rounded-full border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)] transition-base" data-testid="board-filter-status">
          <option value="active">Active (non-Done)</option>
          <option value="all">Semua Status</option>
          <option value="Modeling">Modeling</option>
          <option value="Rigging">Rigging</option>
          <option value="Texturing">Texturing</option>
          <option value="Rendering">Rendering</option>
          <option value="Delivery">Delivery</option>
          <option value="Done">Done</option>
        </select>
      </div>

      {sortedArtists.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-10 text-center text-[var(--ms-text-muted)]">Belum ada project untuk artist mana pun.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {sortedArtists.map((artist) => {
            const color = ARTIST_COLORS[artist] || ARTIST_COLORS.Default;
            const items = grouped[artist];
            const active = items.filter((i) => i.status !== "Done").length;
            return (
              <div key={artist} className="bg-[var(--ms-primary-soft)]/40 rounded-2xl p-4 border border-[var(--ms-border)]" data-testid={`artist-column-${artist}`}>
                <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-dashed" style={{ borderColor: `${color}40` }}>
                  <h2 className="font-display text-xl font-extrabold tracking-tight" style={{ color }}>{artist}</h2>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-white border border-[var(--ms-border)]">{active} aktif</span>
                </div>
                <div className="space-y-3">
                  {items.map((o) => {
                    const late = isLate(o.deadline, o.status);
                    const done = o.status === "Done";
                    const sc = STATUS_COLORS[o.status] || STATUS_COLORS.Modeling;
                    return (
                      <div key={`${artist}-${o.id}`} className={`bg-white rounded-xl p-3.5 border-t-[3px] card-hover transition-base ${done ? "opacity-60" : ""}`} style={{ borderTopColor: color, borderRight: "1px solid var(--ms-border)", borderBottom: "1px solid var(--ms-border)", borderLeft: "1px solid var(--ms-border)" }} data-testid={`board-card-${o.id}`}>
                        <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">{o.klien}</div>
                        <div className="font-bold text-sm leading-snug mb-2.5">{o.project}</div>
                        <div className="flex items-center justify-between gap-2">
                          <Pill label={o.status} bg={sc.bg} text={sc.text} />
                          <div className={`flex items-center gap-1 text-[0.7rem] font-mono font-semibold ${late ? "text-rose-600" : done ? "text-emerald-700" : "text-[var(--ms-text-muted)]"}`}>
                            {late ? <AlertTriangle size={11} /> : <Calendar size={11} />}
                            {fmtDate(o.deadline)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
