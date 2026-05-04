import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Award, Calendar, TrendingUp, Clock, Target, User as UserIcon } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { monthLabel, currentMonth } from "../lib/format";

const AVATAR_COLORS = ["#6d4cff", "#0ea5e9", "#f97316", "#10b981", "#ec4899", "#f59e0b", "#8b5cf6", "#06b6d4"];
const avatarColor = (name) => AVATAR_COLORS[((name || "?").split("").reduce((s, c) => s + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];

const fmtHours = (h) => {
  if (!h) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}j`;
};

export default function Performance() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState({ members: [] });
  const [loading, setLoading] = useState(true);
  const [filterName, setFilterName] = useState("");

  const isTalent = user?.role === "talent";

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/performance`, { params: { month } }); setData(r.data); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const members = data.members || [];

  // Talent only sees themselves
  const visible = useMemo(() => {
    let rows = members;
    if (isTalent) {
      const myName = (user?.name || "").toLowerCase();
      const myHandle = (user?.email || "").split("@")[0].toLowerCase();
      rows = rows.filter((m) => (m.assignee || "").toLowerCase() === myName || (m.assignee || "").toLowerCase() === myHandle);
    }
    if (filterName) {
      const q = filterName.toLowerCase();
      rows = rows.filter((m) => (m.assignee || "").toLowerCase().includes(q));
    }
    return rows;
  }, [members, filterName, isTalent, user]);

  const totals = useMemo(() => {
    const t = members.reduce((acc, m) => ({
      done: acc.done + m.tasks_done,
      pending: acc.pending + m.tasks_pending,
      inProgress: acc.inProgress + m.tasks_in_progress,
      credits: acc.credits + (m.credit_points || 0),
      timedTasks: acc.timedTasks + (m.timed_task_count || 0),
      durationSec: acc.durationSec + (m.total_duration_sec || 0),
    }), { done: 0, pending: 0, inProgress: 0, credits: 0, timedTasks: 0, durationSec: 0 });
    const avgHours = t.timedTasks ? (t.durationSec / t.timedTasks / 3600) : 0;
    return { ...t, avgHours };
  }, [members]);

  const maxDone = Math.max(1, ...visible.map((m) => m.tasks_done));
  const monthOptions = useMemo(() => {
    const arr = [];
    const [y, m] = currentMonth().split("-").map(Number);
    for (let i = 0; i < 12; i++) {
      const d = new Date(y, m - 1 - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return arr;
  }, []);

  return (
    <div className="space-y-6" data-testid="performance-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700"><Award size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Performance</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Metrik berdasarkan task To Do {monthLabel(month)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--ms-text-muted)]" />
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-4 py-2 rounded-full border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)]" data-testid="perf-month">
            {monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m)}{m === currentMonth() ? " — skrg" : ""}</option>)}
          </select>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Task Selesai" value={totals.done} sub={`${totals.pending} pending · ${totals.inProgress} aktif`} icon={TrendingUp} color="#10b981" testid="stat-done" />
        <Stat label="Avg Kecepatan" value={fmtHours(totals.avgHours)} sub={`${totals.timedTasks} task ber-timer`} icon={Clock} color="#f59e0b" testid="stat-speed" />
        <Stat label="Credit Points" value={totals.credits.toFixed(2)} sub="Dari order Done × kontribusi" icon={Award} color="#6d4cff" testid="stat-credits" />
        <Stat label="Anggota Aktif" value={members.length} sub="Bulan ini" icon={Target} color="#0ea5e9" testid="stat-members" />
      </div>

      {!isTalent && (
        <div className="flex gap-2">
          <input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Filter nama anggota..." className="px-4 py-2 rounded-full border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)] w-full sm:w-72" data-testid="filter-name" />
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-[var(--ms-text-muted)]">Memuat...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[var(--ms-border)] rounded-2xl text-[var(--ms-text-muted)]">
          <Award size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Belum ada task selesai di bulan ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((m) => {
            const color = avatarColor(m.assignee);
            const donePct = maxDone ? (m.tasks_done / maxDone) * 100 : 0;
            return (
              <div key={m.assignee} className="bg-white rounded-2xl border border-[var(--ms-border)] p-4 card-hover transition-base" data-testid={`perf-card-${m.assignee}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-display font-bold" style={{ background: color }}>{m.assignee[0]?.toUpperCase() || "?"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base font-bold truncate">{m.assignee}</div>
                    <div className="text-[0.65rem] font-mono text-[var(--ms-text-muted)]">{m.tasks_done + m.tasks_in_progress + m.tasks_pending} total task</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Metric label="Task selesai" value={m.tasks_done} color="#10b981" pct={donePct} />
                  <div className="flex justify-between text-[0.7rem]">
                    <span className="text-[var(--ms-text-muted)]">Avg kecepatan</span>
                    <span className="font-mono font-bold">{fmtHours(m.avg_speed_hours)}</span>
                  </div>
                  <div className="flex justify-between text-[0.7rem]">
                    <span className="text-[var(--ms-text-muted)]">Credit points (order)</span>
                    <span className="font-mono font-bold" style={{ color: "var(--ms-primary)" }}>{(m.credit_points || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[0.7rem]">
                    <span className="text-[var(--ms-text-muted)]">Pending / In progress</span>
                    <span className="font-mono">{m.tasks_pending}/{m.tasks_in_progress}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const Stat = ({ label, value, sub, icon: Icon, color, testid }) => (
  <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-4" data-testid={testid}>
    <div className="flex items-start justify-between mb-2">
      <div className="text-[0.62rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono">{label}</div>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}1a`, color }}><Icon size={14} /></div>
    </div>
    <div className="font-display text-2xl font-extrabold" style={{ color }}>{value}</div>
    {sub && <div className="text-[0.68rem] text-[var(--ms-text-muted)] mt-1">{sub}</div>}
  </div>
);

const Metric = ({ label, value, color, pct }) => (
  <div>
    <div className="flex items-center justify-between text-[0.7rem] mb-1">
      <span className="text-[var(--ms-text-muted)]">{label}</span>
      <span className="font-mono font-bold" style={{ color }}>{value}</span>
    </div>
    <div className="h-1.5 rounded-full bg-[var(--ms-bg)] overflow-hidden">
      <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  </div>
);
