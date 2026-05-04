import React, { useEffect, useState, useMemo, useCallback } from "react";
import { ClipboardList, Plus, Play, Pause, CheckCircle2, Circle, RotateCcw, Calendar, ChevronLeft, ChevronRight, X, Search, Users, Palette } from "lucide-react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useOrders } from "../context/OrdersContext";
import { fmtDate } from "../lib/format";
import { toast } from "sonner";

const STATUS_META = {
  pending: { label: "Pending", bg: "bg-slate-100", text: "text-slate-700", dot: "#64748b", icon: Circle },
  in_progress: { label: "In Progress", bg: "bg-amber-100", text: "text-amber-700", dot: "#f59e0b", icon: Play },
  done: { label: "Done", bg: "bg-emerald-100", text: "text-emerald-700", dot: "#10b981", icon: CheckCircle2 },
};

const fmtDuration = (sec) => {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const shiftDate = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

export default function Todo() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const canAdd = user?.role === "admin" || user?.role === "pm";
  const isTalent = user?.role === "talent";

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/tasks/${date}`); setTasks(r.data); }
    catch { toast.error("Gagal memuat task"); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // Filter for Talent: only tasks where assignee matches their name or email prefix
  const visible = useMemo(() => {
    if (!isTalent) return tasks;
    const myName = (user?.name || "").toLowerCase();
    const myHandle = (user?.email || "").split("@")[0].toLowerCase();
    return tasks.filter((t) => {
      const a = (t.assignee || "").toLowerCase();
      return a === myName || a === myHandle;
    });
  }, [tasks, isTalent, user]);

  const grouped = useMemo(() => {
    const tim = {}; const free = {};
    visible.forEach((t) => {
      const bucket = t.assignee_type === "freelance" ? free : tim;
      const a = t.assignee || "Unassigned";
      if (!bucket[a]) bucket[a] = [];
      bucket[a].push(t);
    });
    return { tim, free };
  }, [visible]);

  const canEditTask = (t) => {
    if (user?.role === "admin" || user?.role === "pm") return true;
    if (user?.role === "talent") {
      const myName = (user?.name || "").toLowerCase();
      const myHandle = (user?.email || "").split("@")[0].toLowerCase();
      return (t.assignee || "").toLowerCase() === myName || (t.assignee || "").toLowerCase() === myHandle;
    }
    return false;
  };

  const setTaskStatus = async (t, newStatus) => {
    if (!canEditTask(t)) return;
    try {
      const r = await api.patch(`/tasks/${t.id}`, { status: newStatus });
      setTasks((prev) => prev.map((x) => x.id === t.id ? r.data : x));
      toast.success(STATUS_META[newStatus].label);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal");
    }
  };

  const removeTask = async (t) => {
    if (!canAdd) return;
    if (!window.confirm(`Hapus task "${t.title}"?`)) return;
    try { await api.delete(`/tasks/${t.id}`); setTasks((prev) => prev.filter((x) => x.id !== t.id)); } catch { toast.error("Gagal"); }
  };

  const stats = useMemo(() => ({
    total: visible.length,
    done: visible.filter((t) => t.status === "done").length,
    inProgress: visible.filter((t) => t.status === "in_progress").length,
    pending: visible.filter((t) => t.status === "pending").length,
  }), [visible]);

  return (
    <div className="space-y-5" data-testid="todo-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}><ClipboardList size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">To Do</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">{isTalent ? "Task yang ditugaskan ke kamu" : "Task harian tim — auto-generate dari order aktif"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(shiftDate(date, -1))} className="p-2 rounded-full border border-[var(--ms-border)] hover:bg-[var(--ms-bg)]" data-testid="date-prev"><ChevronLeft size={14} /></button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--ms-border)] bg-white">
            <Calendar size={13} className="text-[var(--ms-text-muted)]" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm font-semibold focus:outline-none bg-transparent" data-testid="date-picker" />
          </div>
          <button onClick={() => setDate(shiftDate(date, 1))} className="p-2 rounded-full border border-[var(--ms-border)] hover:bg-[var(--ms-bg)]" data-testid="date-next"><ChevronRight size={14} /></button>
          {date !== todayStr() && <button onClick={() => setDate(todayStr())} className="px-3 py-2 rounded-full text-xs font-semibold bg-[var(--ms-primary-soft)]" style={{ color: "var(--ms-primary)" }} data-testid="date-today">Hari ini</button>}
          {canAdd && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-semibold" style={{ background: "var(--ms-primary)" }} data-testid="add-task-btn"><Plus size={14} /> Task</button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatC label="Total" value={stats.total} color="#6d4cff" />
        <StatC label="Pending" value={stats.pending} color="#64748b" />
        <StatC label="In Progress" value={stats.inProgress} color="#f59e0b" />
        <StatC label="Done" value={stats.done} color="#10b981" />
      </div>

      {loading ? (
        <div className="text-center py-10 text-[var(--ms-text-muted)]">Memuat...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[var(--ms-border)] rounded-2xl text-[var(--ms-text-muted)]">
          <ClipboardList size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{isTalent ? "Belum ada task untukmu pada tanggal ini." : `Belum ada task untuk ${fmtDate(date)}.`}</p>
          {date === todayStr() && canAdd && <button onClick={load} className="mt-3 text-xs font-semibold underline" style={{ color: "var(--ms-primary)" }}>Muat ulang / Auto-generate</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <GroupSection title="Tim Internal" icon={Users} color="#6d4cff" groups={grouped.tim} setTaskStatus={setTaskStatus} removeTask={removeTask} canEditTask={canEditTask} canAdd={canAdd} />
          <GroupSection title="Freelance" icon={Palette} color="#f59e0b" groups={grouped.free} setTaskStatus={setTaskStatus} removeTask={removeTask} canEditTask={canEditTask} canAdd={canAdd} />
        </div>
      )}

      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} date={date} onSaved={(t) => { setTasks((prev) => [...prev, t]); setShowAdd(false); }} />}
    </div>
  );
}

const StatC = ({ label, value, color }) => (
  <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-4">
    <div className="text-[0.62rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">{label}</div>
    <div className="font-display text-2xl font-extrabold" style={{ color }}>{value}</div>
  </div>
);

function GroupSection({ title, icon: Icon, color, groups, setTaskStatus, removeTask, canEditTask, canAdd }) {
  const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden" data-testid={`section-${title.toLowerCase().replace(" ", "-")}`}>
      <div className="p-4 border-b border-[var(--ms-border)] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}1a`, color }}><Icon size={14} /></div>
        <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
        <span className="ml-auto text-[0.65rem] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--ms-bg)]">{entries.length} org · {Object.values(groups).flat().length} task</span>
      </div>
      {entries.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--ms-text-muted)]">Tidak ada task {title.toLowerCase()}</div>
      ) : (
        <div className="divide-y divide-[var(--ms-border)]">
          {entries.map(([name, list]) => (
            <div key={name} className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-display font-bold text-xs" style={{ background: color }}>{name[0]?.toUpperCase()}</div>
                <span className="font-semibold text-sm">{name}</span>
                <span className="text-[0.6rem] font-mono text-[var(--ms-text-muted)]">· {list.length} task</span>
              </div>
              <div className="space-y-1.5 pl-9">
                {list.map((t) => <TaskRow key={t.id} task={t} setTaskStatus={setTaskStatus} removeTask={removeTask} canEdit={canEditTask(t)} canDelete={canAdd} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, setTaskStatus, removeTask, canEdit, canDelete }) {
  const meta = STATUS_META[task.status] || STATUS_META.pending;
  const elapsed = task.status === "in_progress" && task.started_at ? Math.floor((Date.now() - new Date(task.started_at).getTime()) / 1000) : task.duration_seconds;
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--ms-bg)] hover:bg-white hover:shadow-sm transition-base" data-testid={`task-${task.id}`}>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.62rem] font-bold ${meta.bg} ${meta.text}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />{meta.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" title={task.title}>{task.title}</div>
        {task.folder_code && <div className="text-[0.6rem] font-mono text-[var(--ms-text-muted)] truncate">{task.folder_code}</div>}
      </div>
      {elapsed > 0 && <span className="text-[0.62rem] font-mono text-[var(--ms-text-muted)] whitespace-nowrap">{fmtDuration(elapsed)}</span>}
      {canEdit && (
        <div className="flex gap-0.5">
          {task.status !== "pending" && <button onClick={() => setTaskStatus(task, "pending")} className="p-1 rounded hover:bg-slate-200" title="Reset ke Pending" data-testid={`btn-pending-${task.id}`}><RotateCcw size={11} /></button>}
          {task.status !== "in_progress" && <button onClick={() => setTaskStatus(task, "in_progress")} className="p-1 rounded hover:bg-amber-100 text-amber-700" title="Mulai" data-testid={`btn-start-${task.id}`}><Play size={11} /></button>}
          {task.status !== "done" && <button onClick={() => setTaskStatus(task, "done")} className="p-1 rounded hover:bg-emerald-100 text-emerald-700" title="Selesai" data-testid={`btn-done-${task.id}`}><CheckCircle2 size={11} /></button>}
          {canDelete && <button onClick={() => removeTask(task)} className="p-1 rounded hover:bg-rose-100 text-rose-600" title="Hapus"><X size={11} /></button>}
        </div>
      )}
    </div>
  );
}

function AddTaskModal({ onClose, date, onSaved }) {
  const { orders } = useOrders();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [assigneeType, setAssigneeType] = useState("tim");
  const [orderQ, setOrderQ] = useState("");
  const [linkedOrder, setLinkedOrder] = useState(null);
  const [saving, setSaving] = useState(false);

  const results = useMemo(() => {
    if (!orderQ.trim()) return orders.slice(0, 8);
    const s = orderQ.toLowerCase();
    return orders.filter((o) => `${o.project} ${o.klien} ${o.folder_code || ""} ${o.order_id || ""}`.toLowerCase().includes(s)).slice(0, 12);
  }, [orderQ, orders]);

  const pickOrder = (o) => {
    setLinkedOrder(o);
    setOrderQ("");
    if (!title) setTitle(`${o.project} — ${assignee || "…"}`);
  };

  const save = async () => {
    if (!title.trim() || !assignee.trim()) { toast.error("Title & assignee wajib"); return; }
    setSaving(true);
    try {
      const r = await api.post("/tasks", {
        title, date, assignee, assignee_type: assigneeType,
        folder_code: linkedOrder?.folder_code || "",
        order_id: linkedOrder?.id || "",
        status: "pending",
      });
      toast.success("Task dibuat");
      onSaved(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
    finally { setSaving(false); }
  };

  const inp = "w-full px-3 py-2 rounded-lg border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)] focus:ring-2 focus:ring-[var(--ms-primary)]/20";

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="add-task-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg p-6 my-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">Task Baru · {fmtDate(date)}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--ms-bg)]"><X size={16} /></button>
        </div>

        <div>
          <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">Link ke Order (opsional)</div>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
            <input value={orderQ} onChange={(e) => setOrderQ(e.target.value)} placeholder="Cari project / kode folder / order ID..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--ms-border)] bg-white text-sm" data-testid="order-search" />
          </div>
          {!linkedOrder && orderQ && (
            <div className="max-h-40 overflow-y-auto border border-[var(--ms-border)] rounded-lg" data-testid="order-results">
              {results.map((o) => (
                <button key={o.id} onClick={() => pickOrder(o)} className="w-full text-left p-2 hover:bg-[var(--ms-bg)] border-b border-[var(--ms-border)] last:border-0" data-testid={`pick-${o.id}`}>
                  <div className="text-sm font-semibold">{o.project}</div>
                  <div className="text-[0.62rem] font-mono text-[var(--ms-text-muted)]">{o.klien} · {o.folder_code}</div>
                </button>
              ))}
            </div>
          )}
          {linkedOrder && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--ms-primary-soft)] text-xs">
              <span className="font-bold" style={{ color: "var(--ms-primary)" }}>{linkedOrder.project}</span>
              <span className="font-mono text-[var(--ms-text-muted)]">· {linkedOrder.folder_code}</span>
              <button onClick={() => setLinkedOrder(null)} className="ml-auto text-rose-600"><X size={12} /></button>
            </div>
          )}
        </div>

        <div>
          <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">Title</div>
          <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mis: Modeling chest rig" data-testid="task-title" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">Assignee</div>
            <input className={inp} value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Nama" data-testid="task-assignee" />
          </div>
          <div>
            <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">Tipe</div>
            <select className={inp} value={assigneeType} onChange={(e) => setAssigneeType(e.target.value)} data-testid="task-type">
              <option value="tim">Tim Internal</option>
              <option value="freelance">Freelance</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full border border-[var(--ms-border)] text-sm font-semibold">Batal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-full text-white text-sm font-semibold" style={{ background: "var(--ms-primary)" }} data-testid="save-task">{saving ? "..." : "Simpan"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
