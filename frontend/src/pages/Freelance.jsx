import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Palette, Plus, Copy, Phone, CreditCard, Pencil, Trash2, X, Send, Calendar, Search, Link2 } from "lucide-react";
import { api } from "../lib/api";
import { useCurrency } from "../context/CurrencyContext";
import { useOrders } from "../context/OrdersContext";
import { monthLabel, currentMonth, fmtDate } from "../lib/format";
import { toast } from "sonner";

const STATUS_BAYAR = { paid: { label: "✓ Paid", bg: "bg-emerald-100", text: "text-emerald-700", dot: "#10b981" }, unpaid: { label: "× Unpaid", bg: "bg-rose-100", text: "text-rose-700", dot: "#ef4444" }, dp_only: { label: "⧗ DP saja", bg: "bg-amber-100", text: "text-amber-700", dot: "#f59e0b" } };
const PROJECT_STATUS = { done: { label: "Done", bg: "bg-emerald-50", text: "text-emerald-700", dot: "#10b981" }, in_progress: { label: "In progress", bg: "bg-indigo-50", text: "text-indigo-700", dot: "#6d4cff" } };
const AVATAR_COLORS = ["#6d4cff", "#0ea5e9", "#f97316", "#10b981", "#ec4899", "#f59e0b", "#8b5cf6"];
const avatarColor = (name) => AVATAR_COLORS[(name || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export default function Freelance() {
  const { fmt, convert, display } = useCurrency();
  const [artists, setArtists] = useState([]);
  const [projects, setProjects] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [artistModal, setArtistModal] = useState(null); // {editing: artist|null}
  const [projectModal, setProjectModal] = useState(null);

  const cvIdr = (n) => convert(Number(n) || 0, "IDR");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p] = await Promise.all([api.get("/freelance/artists"), api.get("/freelance/projects", { params: { month } })]);
      setArtists(a.data);
      setProjects(p.data);
      if (!selectedId && a.data.length) setSelectedId(a.data[0].id);
    } finally { setLoading(false); }
  }, [month, selectedId]);

  useEffect(() => { reload(); }, [reload]);

  const monthList = useMemo(() => { const s = new Set(projects.map((r) => (r.tanggal || "").slice(0, 7)).filter(Boolean)); s.add(currentMonth()); return Array.from(s).sort().reverse(); }, [projects]);

  const monthProjects = projects; // already filtered by backend

  // per-artist stats
  const artistStats = useMemo(() => {
    const map = {};
    artists.forEach((a) => { map[a.id] = { artist: a, total: 0, paid: 0, count: 0 }; });
    monthProjects.forEach((p) => {
      const m = map[p.artist_id];
      if (!m) return;
      m.total += Number(p.fee) || 0;
      m.count += 1;
      if (p.status_bayar === "paid") m.paid += Number(p.fee) || 0;
      else if (p.status_bayar === "dp_only") m.paid += Number(p.dp_amount) || 0;
    });
    return Object.values(map);
  }, [artists, monthProjects]);

  const totals = useMemo(() => {
    let total = 0, paid = 0, count = 0, activeArtists = new Set();
    monthProjects.forEach((p) => {
      total += Number(p.fee) || 0;
      if (p.status_bayar === "paid") paid += Number(p.fee) || 0;
      else if (p.status_bayar === "dp_only") paid += Number(p.dp_amount) || 0;
      count += 1;
      activeArtists.add(p.artist_id);
    });
    return { total, paid, unpaid: total - paid, count, activeArtists: activeArtists.size };
  }, [monthProjects]);

  const selectedArtist = artists.find((a) => a.id === selectedId);
  const selectedProjects = monthProjects.filter((p) => p.artist_id === selectedId);
  const selTotal = selectedProjects.reduce((s, p) => s + (Number(p.fee) || 0), 0);
  const selPaid = selectedProjects.reduce((s, p) => s + (p.status_bayar === "paid" ? Number(p.fee) || 0 : p.status_bayar === "dp_only" ? Number(p.dp_amount) || 0 : 0), 0);

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success("Disalin"); };

  const markPaid = async (p, dateOverride) => {
    const today = dateOverride || new Date().toISOString().slice(0, 10);
    const payload = { artist_id: p.artist_id, tanggal: p.tanggal || "", project: p.project || "", pic: p.pic || "", status_project: p.status_project || "in_progress", platform: p.platform || "", fee: p.fee || 0, dp_amount: p.dp_amount || 0, dp_date: p.dp_date || "", pelunasan_date: today, status_bayar: "paid" };
    try { await api.put(`/freelance/projects/${p.id}`, payload); toast.success("Lunas"); reload(); } catch { toast.error("Gagal"); }
  };

  const removeProject = async (p) => {
    if (!window.confirm(`Hapus project "${p.project}"?`)) return;
    try { await api.delete(`/freelance/projects/${p.id}`); toast.success("Dihapus"); reload(); } catch { toast.error("Gagal"); }
  };

  const removeArtist = async (a) => {
    if (!window.confirm(`Hapus artist ${a.name}? Semua project-nya juga akan dihapus.`)) return;
    try { await api.delete(`/freelance/artists/${a.id}`); toast.success("Dihapus"); if (selectedId === a.id) setSelectedId(null); reload(); } catch { toast.error("Gagal"); }
  };

  if (loading) return <div className="text-center py-10 text-[var(--ms-text-muted)]">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="freelance-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700"><Palette size={20} /></div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Freelance</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Fee yang harus dibayarkan ke artist</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--ms-text-muted)]" />
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-4 py-2 rounded-full border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)]" data-testid="freelance-month">
            {monthList.map((m) => <option key={m} value={m}>{monthLabel(m)}{m === currentMonth() ? " — skrg" : ""}</option>)}
          </select>
          <button onClick={() => setArtistModal({ editing: null })} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--ms-primary)] text-white text-xs font-semibold hover:opacity-90" data-testid="add-artist-btn"><Plus size={13} /> Artist</button>
        </div>
      </div>

      {/* 4 summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SumCard testid="sum-total" label="Total fee bulan ini" value={fmt(cvIdr(totals.total), display)} sub={`${totals.count} project`} color="#6d4cff" />
        <SumCard testid="sum-paid" label="Sudah dibayar" value={fmt(cvIdr(totals.paid), display)} sub={`${monthProjects.filter((p) => p.status_bayar === "paid").length} project lunas`} color="#10b981" />
        <SumCard testid="sum-unpaid" label="Belum dibayar" value={fmt(cvIdr(totals.unpaid), display)} sub={`${monthProjects.filter((p) => p.status_bayar !== "paid").length} project pending`} color="#ef4444" />
        <SumCard testid="sum-active" label="Artist aktif" value={totals.activeArtists} sub="Bulan ini" color="#f59e0b" />
      </div>

      {/* Artist cards */}
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight mb-3">Artist bulan ini</h2>
        {artistStats.length === 0 && <div className="text-center py-10 text-[var(--ms-text-muted)] text-sm border-2 border-dashed border-[var(--ms-border)] rounded-2xl">Belum ada artist. Klik "+ Artist" untuk menambahkan.</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {artistStats.map(({ artist, total, paid, count }) => {
            const unpaid = total - paid;
            const pct = total > 0 ? (paid / total) * 100 : 0;
            const isFull = unpaid === 0 && total > 0;
            const selected = artist.id === selectedId;
            const color = avatarColor(artist.name);
            return (
              <button key={artist.id} onClick={() => setSelectedId(artist.id)} className={`text-left bg-white rounded-2xl border-2 p-4 transition-base hover:shadow-md ${selected ? "border-[var(--ms-primary)] shadow-sm" : "border-[var(--ms-border)]"}`} data-testid={`artist-card-${artist.id}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-display font-bold text-base flex-shrink-0" style={{ background: color }}>{artist.name[0]?.toUpperCase() || "?"}</div>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-base truncate">{artist.name}</div>
                      <div className="text-[0.68rem] text-[var(--ms-text-muted)] font-mono">{count} project</div>
                    </div>
                  </div>
                  <span className={`text-[0.62rem] font-bold font-mono px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${isFull ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {isFull ? "LUNAS" : `UNPAID ${fmt(cvIdr(unpaid), display)}`}
                  </span>
                </div>
                <div className="font-display text-xl font-extrabold mb-2" style={{ color: "var(--ms-primary)" }}>{fmt(cvIdr(total), display)}</div>
                <div className="flex items-start gap-2 text-[0.7rem] text-[var(--ms-text-muted)]">
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1 truncate"><CreditCard size={10} className="flex-shrink-0" /><span className="truncate">{artist.rekening || "—"}{artist.rekening && artist.bank ? ` · ${artist.bank}` : ""}</span></div>
                    <div className="flex items-center gap-1 truncate"><Phone size={10} className="flex-shrink-0" /><span className="truncate">{artist.phone || "—"}</span></div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <span onClick={(e) => { e.stopPropagation(); copy(artist.rekening || ""); }} className="px-2 py-0.5 rounded border border-[var(--ms-border)] text-[0.62rem] font-semibold hover:bg-[var(--ms-bg)] cursor-pointer flex items-center gap-1" data-testid={`copy-${artist.id}`}><Copy size={9} /> salin</span>
                    <span onClick={(e) => { e.stopPropagation(); setArtistModal({ editing: artist }); }} className="p-1 rounded border border-[var(--ms-border)] hover:bg-[var(--ms-bg)] cursor-pointer"><Pencil size={9} /></span>
                    <span onClick={(e) => { e.stopPropagation(); removeArtist(artist); }} className="p-1 rounded border border-rose-300 text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 size={9} /></span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[0.62rem] font-mono mb-1">
                    <span className="text-[var(--ms-text-muted)]">Lunas {Math.round(pct)}%</span>
                    <span className="font-bold">{fmt(cvIdr(paid), display)} / {fmt(cvIdr(total), display)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--ms-bg)] overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: isFull ? "#10b981" : "linear-gradient(90deg, #10b981, #fbbf24)" }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail table */}
      {selectedArtist && (
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden" data-testid="detail-section">
          <div className="p-5 border-b border-[var(--ms-border)] flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">Detail fee per project — <span style={{ color: "var(--ms-primary)" }}>{selectedArtist.name}</span></h2>
              <p className="text-xs text-[var(--ms-text-muted)] mt-0.5 font-mono">{selectedArtist.bank} {selectedArtist.rekening || "—"} · {selectedArtist.phone || "—"} · Total fee {fmt(cvIdr(selTotal), display)}</p>
            </div>
            <button onClick={() => setProjectModal({ editing: null, artist_id: selectedId })} className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--ms-border)] text-xs font-semibold hover:bg-[var(--ms-bg)]" data-testid="add-project-btn"><Plus size={12} /> Tambah project</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--ms-bg)]">
                <tr className="text-left">
                  {["Tanggal", "Project", "PIC", "Status Project", "Fee", "DP", "Pelunasan", "Status Bayar", ""].map((h) => <th key={h} className="px-3 py-2.5 text-[0.62rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)]">{h}</th>)}
                </tr>
              </thead>
              <tbody data-testid="project-rows">
                {selectedProjects.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-[var(--ms-text-muted)]">Belum ada project untuk {selectedArtist.name} di bulan ini.</td></tr>}
                {selectedProjects.map((p) => {
                  const sb = STATUS_BAYAR[p.status_bayar] || STATUS_BAYAR.unpaid;
                  const sp = PROJECT_STATUS[p.status_project] || PROJECT_STATUS.in_progress;
                  return (
                    <tr key={p.id} className="border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)]" data-testid={`project-row-${p.id}`}>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{fmtDate(p.tanggal) || "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold">{p.project || "—"}</div>
                        {p.platform && <div className="text-[0.65rem] text-[var(--ms-text-muted)] font-mono">{p.platform}</div>}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-sm" style={{ color: "var(--ms-primary)" }}>{p.pic || "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.68rem] font-bold ${sp.bg} ${sp.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sp.dot }} />{sp.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap">
                        <div>{fmt(cvIdr(p.fee), display)}</div>
                        {Number(p.dp_amount) > 0 && <div className="text-[0.62rem] text-amber-700 font-normal">DP {fmt(cvIdr(p.dp_amount), display)}</div>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[0.68rem] whitespace-nowrap">
                        {p.dp_date ? (<><div>{fmtDate(p.dp_date)}</div><div className="text-amber-700">{fmt(cvIdr(p.dp_amount), display)}</div></>) : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[0.68rem] whitespace-nowrap">{p.pelunasan_date ? fmtDate(p.pelunasan_date) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.68rem] font-bold ${sb.bg} ${sb.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sb.dot }} />{sb.label}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex gap-1">
                          {p.status_bayar !== "paid" && <button onClick={() => markPaid(p)} className="flex items-center gap-1 px-2 py-1 rounded border border-emerald-300 text-emerald-700 text-[0.68rem] font-bold hover:bg-emerald-50 whitespace-nowrap" data-testid={`mark-paid-${p.id}`}><Send size={10} /> {p.status_bayar === "dp_only" ? "Lunasi" : "Transfer"}</button>}
                          <button onClick={() => setProjectModal({ editing: p })} className="p-1 rounded border border-[var(--ms-border)] hover:bg-[var(--ms-bg)]"><Pencil size={10} /></button>
                          <button onClick={() => removeProject(p)} className="p-1 rounded border border-rose-300 text-rose-600 hover:bg-rose-50"><Trash2 size={10} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {selectedProjects.length > 0 && (
                  <tr className="border-t-2 border-[var(--ms-border)] bg-[var(--ms-bg)] font-bold">
                    <td colSpan={4} className="px-3 py-2.5 text-sm">Total fee {selectedArtist.name}</td>
                    <td className="px-3 py-2.5 font-mono text-sm" style={{ color: "var(--ms-primary)" }}>{fmt(cvIdr(selTotal), display)}</td>
                    <td className="px-3 py-2.5 font-mono text-[0.72rem] text-emerald-700">Paid {fmt(cvIdr(selPaid), display)}</td>
                    <td colSpan={2} className="px-3 py-2.5">
                      <span className={`inline-flex text-[0.68rem] font-bold px-2 py-0.5 rounded-full ${selTotal - selPaid > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>Sisa {fmt(cvIdr(selTotal - selPaid), display)}</span>
                    </td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {artistModal && <ArtistModal data={artistModal.editing} onClose={() => setArtistModal(null)} onSaved={() => { setArtistModal(null); reload(); }} />}
      {projectModal && <ProjectModal data={projectModal.editing} artistId={projectModal.artist_id} artists={artists} onClose={() => setProjectModal(null)} onSaved={() => { setProjectModal(null); reload(); }} />}
    </div>
  );
}

const SumCard = ({ label, value, sub, color, testid }) => (
  <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-4" data-testid={testid}>
    <div className="text-[0.62rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-1">{label}</div>
    <div className="font-display text-xl sm:text-2xl font-extrabold" style={{ color }}>{value}</div>
    <div className="text-[0.68rem] text-[var(--ms-text-muted)] mt-1">{sub}</div>
  </div>
);

function ArtistModal({ data, onClose, onSaved }) {
  const [f, setF] = useState(data || { name: "", bank: "BCA", rekening: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name.trim()) { toast.error("Nama wajib"); return; }
    setSaving(true);
    try {
      if (data?.id) await api.put(`/freelance/artists/${data.id}`, f);
      else await api.post("/freelance/artists", f);
      toast.success("Tersimpan");
      onSaved();
    } catch { toast.error("Gagal"); } finally { setSaving(false); }
  };
  const body = (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="artist-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 my-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">{data ? "Edit Artist" : "Tambah Artist"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--ms-bg)]"><X size={16} /></button>
        </div>
        <Field label="Nama"><input className={INP} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="artist-name" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Bank"><input className={INP} value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} placeholder="BCA / DANA / ..." data-testid="artist-bank" /></Field>
          <Field label="No. Rekening"><input className={INP} value={f.rekening} onChange={(e) => setF({ ...f, rekening: e.target.value })} data-testid="artist-rekening" /></Field>
        </div>
        <Field label="No. Telp"><input className={INP} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="artist-phone" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full border border-[var(--ms-border)] text-sm font-semibold">Batal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-full text-white text-sm font-semibold" style={{ background: "var(--ms-primary)" }} data-testid="save-artist-btn">{saving ? "..." : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
  return createPortal(body, document.body);
}

function ProjectModal({ data, artistId, artists, onClose, onSaved }) {
  const { orders } = useOrders();
  const initial = data || { artist_id: artistId || "", tanggal: new Date().toISOString().slice(0, 10), project: "", pic: "", status_project: "in_progress", platform: "", fee: 0, dp_amount: 0, dp_date: "", pelunasan_date: "", status_bayar: "unpaid", order_ref_id: "" };
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [orderQ, setOrderQ] = useState("");
  const [showOrderPicker, setShowOrderPicker] = useState(false);

  const currentArtist = artists.find((a) => a.id === f.artist_id);

  // Orders that have this artist flagged as Freelance
  const artistOrders = useMemo(() => {
    if (!currentArtist) return [];
    const name = currentArtist.name.toLowerCase();
    return orders.filter((o) => {
      const list = o.artists || [];
      const statuses = o.artist_statuses || [];
      return list.some((an, i) => (an || "").toLowerCase() === name && (statuses[i] || "").toLowerCase() === "freelance");
    });
  }, [orders, currentArtist]);

  const searchOrders = useMemo(() => {
    if (!orderQ.trim()) return artistOrders.slice(0, 10);
    const s = orderQ.toLowerCase();
    return orders.filter((o) => `${o.project} ${o.klien} ${o.folder_code || ""} ${o.order_id || ""}`.toLowerCase().includes(s)).slice(0, 10);
  }, [orderQ, artistOrders, orders]);

  const pickOrder = (o) => {
    // Auto-compute per-artist fee (fee_freelance / number of freelance artists)
    const statuses = o.artist_statuses || [];
    const names = o.artists || [];
    const freelancers = names.filter((_, i) => (statuses[i] || "").toLowerCase() === "freelance");
    const perArtistFee = freelancers.length > 0 ? (Number(o.fee_freelance) || 0) / freelancers.length : (Number(o.fee_freelance) || 0);
    setF({ ...f,
      order_ref_id: o.id,
      project: o.project || "",
      platform: o.platform || "",
      pic: o.marketer || "",
      tanggal: o.tanggal || f.tanggal,
      status_project: ["done", "delivered"].includes((o.status || "").toLowerCase()) ? "done" : "in_progress",
      fee: Math.round(perArtistFee),
    });
    setShowOrderPicker(false);
    setOrderQ("");
    toast.success("Data di-autofill dari order");
  };

  const save = async () => {
    if (!f.project.trim()) { toast.error("Nama project wajib"); return; }
    setSaving(true);
    try {
      if (data?.id) await api.put(`/freelance/projects/${data.id}`, f);
      else await api.post("/freelance/projects", f);
      toast.success("Tersimpan");
      onSaved();
    } catch { toast.error("Gagal"); } finally { setSaving(false); }
  };

  const sectionH = "flex items-center gap-2 text-[0.72rem] uppercase tracking-wider font-bold pt-1 mb-3 pb-2 border-b border-[var(--ms-border)]";

  const body = (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="project-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg my-6">
        <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-[var(--ms-border)]">
          <h3 className="font-display text-xl font-bold">{data ? "Edit Project" : "Tambah Project"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--ms-bg)]"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* INFO PROJECT */}
          <div>
            <div className={sectionH} style={{ color: "var(--ms-primary)" }}>📁 Info Project</div>
            <div className="space-y-3">
              <Field label="Artist">
                <select className={INP} value={f.artist_id} onChange={(e) => setF({ ...f, artist_id: e.target.value, order_ref_id: "" })} data-testid="proj-artist">
                  {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>

              {/* Order picker (only when creating new) */}
              {!data && (
                <div className="bg-[var(--ms-bg)] rounded-xl p-3 border border-[var(--ms-border)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[0.68rem] uppercase tracking-wider font-bold font-mono flex items-center gap-1.5" style={{ color: "var(--ms-primary)" }}>
                      <Link2 size={11} /> Link ke Order
                    </div>
                    <button onClick={() => setShowOrderPicker(!showOrderPicker)} className="text-[0.68rem] font-semibold hover:underline" style={{ color: "var(--ms-primary)" }} data-testid="toggle-order-picker">
                      {showOrderPicker ? "Tutup" : `${artistOrders.length} order utk ${currentArtist?.name || "—"}`}
                    </button>
                  </div>
                  {showOrderPicker && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
                        <input value={orderQ} onChange={(e) => setOrderQ(e.target.value)} placeholder="Cari project / folder code..." className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--ms-border)] bg-white text-xs" data-testid="order-search-input" />
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-[var(--ms-border)] rounded-lg bg-white" data-testid="order-picker-results">
                        {searchOrders.length === 0 && <div className="text-center py-4 text-xs text-[var(--ms-text-muted)]">Tidak ada order cocok.</div>}
                        {searchOrders.map((o) => (
                          <button key={o.id} onClick={() => pickOrder(o)} className="w-full text-left p-2 hover:bg-[var(--ms-bg)] border-b border-[var(--ms-border)] last:border-0 transition-base" data-testid={`order-pick-${o.id}`}>
                            <div className="font-semibold text-xs">{o.project}</div>
                            <div className="text-[0.62rem] text-[var(--ms-text-muted)] font-mono truncate">{o.klien} · {o.platform} · {o.folder_code}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {f.order_ref_id && <div className="mt-2 text-[0.65rem] text-emerald-700 font-mono flex items-center gap-1"><Send size={10} /> Ter-link ke order · data ter-autofill</div>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Field label="Tanggal"><input type="date" className={INP} value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} data-testid="proj-tanggal" /></Field>
                <Field label="Platform"><input className={INP} value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} placeholder="Magsika / Eirene / ..." data-testid="proj-platform" /></Field>
              </div>
              <Field label="Nama Project"><input className={INP} value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} data-testid="proj-name" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="PIC / Marketer"><input className={INP} value={f.pic} onChange={(e) => setF({ ...f, pic: e.target.value })} data-testid="proj-pic" /></Field>
                <Field label="Status Project">
                  <select className={INP} value={f.status_project} onChange={(e) => setF({ ...f, status_project: e.target.value })} data-testid="proj-status">
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </Field>
              </div>
              <Field label="Fee (Rp)"><input type="number" className={INP} value={f.fee} onChange={(e) => setF({ ...f, fee: Number(e.target.value) || 0 })} data-testid="proj-fee" /></Field>
            </div>
          </div>

          {/* PEMBAYARAN */}
          <div>
            <div className={sectionH} style={{ color: "var(--ms-primary)" }}>💰 Pembayaran</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="DP (Rp)"><input type="number" className={INP} value={f.dp_amount} onChange={(e) => setF({ ...f, dp_amount: Number(e.target.value) || 0 })} data-testid="proj-dp" /></Field>
                <Field label="Tanggal DP"><input type="date" className={INP} value={f.dp_date} onChange={(e) => setF({ ...f, dp_date: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tanggal Pelunasan"><input type="date" className={INP} value={f.pelunasan_date} onChange={(e) => setF({ ...f, pelunasan_date: e.target.value })} /></Field>
                <Field label="Status Bayar">
                  <select className={INP} value={f.status_bayar} onChange={(e) => setF({ ...f, status_bayar: e.target.value })} data-testid="proj-status-bayar">
                    <option value="unpaid">× Unpaid</option>
                    <option value="dp_only">⧗ DP saja</option>
                    <option value="paid">✓ Paid</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--ms-border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full border border-[var(--ms-border)] text-sm font-semibold">Batal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-full text-white text-sm font-semibold" style={{ background: "var(--ms-primary)" }} data-testid="save-project-btn">{saving ? "..." : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
  return createPortal(body, document.body);
}

const Field = ({ label, children }) => (
  <label className="block">
    <div className="text-[0.62rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-1">{label}</div>
    {children}
  </label>
);

const INP = "w-full px-3 py-2 rounded-lg border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)] focus:ring-2 focus:ring-[var(--ms-primary)]/20 transition-base";
