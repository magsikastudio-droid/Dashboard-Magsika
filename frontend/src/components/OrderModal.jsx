import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Save, Folder, Plus, Trash2, Send, Bell, AlertTriangle, Clock, Sparkles } from "lucide-react";
import { JENIS_OPTIONS, STATUS_OPTIONS, PLATFORM_OPTIONS, PLATFORM_CODES, MARKETER_OPTIONS, ARTIST_STATUS_OPTIONS } from "../lib/constants";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const empty = () => ({
  tanggal: new Date().toISOString().slice(0, 10),
  deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  klien: "",
  project: "",
  jenis: "Modeling",
  status: "Modeling",
  artists: [""],
  artist_statuses: ["Tim"],
  value: 0,
  currency: "USD",
  paid: false,
  catatan: "",
  platform: "Direct",
  marketer: "",
  order_id: "",
  folder_code: "",
  folder_code_manual: false,
  fee_freelance: 0,
});

const sanitize = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, "").replace(/\s+/g, " ").trim();

export default function OrderModal({ open, onClose, order }) {
  const { createOrder, updateOrder, orders } = useOrders();
  const { rate } = useCurrency();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [sendingNotif, setSendingNotif] = useState(false);

  useEffect(() => {
    if (order) {
      const a = order.artists?.length ? order.artists : [""];
      const s = order.artist_statuses?.length ? order.artist_statuses : a.map(() => "Tim");
      while (s.length < a.length) s.push("Tim");
      setForm({ ...empty(), ...order, artists: a, artist_statuses: s.slice(0, a.length) });
    } else { setForm(empty()); }
  }, [order, open]);

  const previewFolderCode = useMemo(() => {
    if (form.folder_code_manual && form.folder_code) return form.folder_code;
    if (!form.tanggal || !form.platform || !form.klien || !form.project) return "—";
    const date = form.tanggal.replaceAll("-", "").slice(2);
    const code = PLATFORM_CODES[form.platform] || "ETC";
    const existing = orders.filter((o) => o.tanggal === form.tanggal && o.platform === form.platform && o.id !== order?.id).length;
    return `${date}-${code}${String(existing + 1).padStart(2, "0")}-${sanitize(form.klien).replace(/\s+/g, "")}-${sanitize(form.project)}`;
  }, [form, orders, order]);

  // auto-update folder_code when not manual
  useEffect(() => {
    if (!form.folder_code_manual) setForm((f) => ({ ...f, folder_code: previewFolderCode === "—" ? "" : previewFolderCode }));
  }, [previewFolderCode, form.folder_code_manual]);

  // progress
  const completion = useMemo(() => {
    const required = ["tanggal", "deadline", "klien", "project", "platform", "jenis", "status"];
    let filled = required.filter((k) => form[k] && String(form[k]).trim()).length;
    if (form.value > 0) filled += 1;
    if (form.artists.some((a) => a && a.trim())) filled += 1;
    return Math.round((filled / (required.length + 2)) * 100);
  }, [form]);

  // computed Net (USD-based)
  const netUSD = useMemo(() => {
    const valUSD = form.currency === "USD" ? Number(form.value) || 0 : (Number(form.value) || 0) / rate;
    const feeUSD = (Number(form.fee_freelance) || 0) / rate;
    return valUSD - feeUSD;
  }, [form.value, form.currency, form.fee_freelance, rate]);

  const feePercent = useMemo(() => {
    const valUSD = form.currency === "USD" ? Number(form.value) || 0 : (Number(form.value) || 0) / rate;
    const feeUSD = (Number(form.fee_freelance) || 0) / rate;
    if (valUSD <= 0) return 0;
    return (feeUSD / valUSD) * 100;
  }, [form.value, form.currency, form.fee_freelance, rate]);

  const valueSecondary = useMemo(() => {
    if (form.currency === "USD") {
      const idr = (Number(form.value) || 0) * rate;
      return `Rp${Math.round(idr).toLocaleString("id-ID")}`;
    }
    const usd = (Number(form.value) || 0) / rate;
    return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }, [form.value, form.currency, rate]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.klien.trim() || !form.project.trim()) { toast.error("Klien & project wajib"); return; }
    const cleanArtists = []; const cleanStatuses = [];
    form.artists.forEach((a, i) => { if (a && a.trim()) { cleanArtists.push(a.trim()); cleanStatuses.push(form.artist_statuses[i] || "Tim"); } });
    const allTim = cleanStatuses.every((s) => s === "Tim");
    const payload = {
      ...form,
      value: Number(form.value) || 0,
      fee_freelance: allTim ? 0 : (Number(form.fee_freelance) || 0),
      artists: cleanArtists,
      artist_statuses: cleanStatuses,
    };
    setSaving(true);
    try {
      if (order) { await updateOrder(order.id, payload); toast.success("Order diupdate"); }
      else { await createOrder(payload); toast.success("Order baru ditambahkan"); }
      onClose();
    } catch (e) { toast.error("Gagal: " + (e?.response?.data?.detail || e.message)); }
    finally { setSaving(false); }
  };

  const handleNotif = async (type) => {
    if (!order) { toast.error("Simpan dulu order baru"); return; }
    setSendingNotif(true);
    try { await api.post(`/orders/${order.id}/notify`, { type }); toast.success("Notif Telegram terkirim"); }
    catch (e) { toast.error("Gagal: " + (e?.response?.data?.detail || e.message)); }
    finally { setSendingNotif(false); }
  };

  const addArtist = () => setForm({ ...form, artists: [...form.artists, ""], artist_statuses: [...form.artist_statuses, "Tim"] });
  const removeArtist = (i) => setForm({ ...form, artists: form.artists.filter((_, idx) => idx !== i), artist_statuses: form.artist_statuses.filter((_, idx) => idx !== i) });
  const setArtist = (i, val) => { const a = [...form.artists]; a[i] = val; setForm({ ...form, artists: a }); };
  const setArtistStatus = (i, val) => { const s = [...form.artist_statuses]; s[i] = val; setForm({ ...form, artist_statuses: s }); };

  const hasFreelance = form.artist_statuses.some((s) => s === "Freelance");

  const lbl = "block text-xs font-semibold text-[var(--ms-text-muted)] mb-1.5";
  const inp = "w-full px-3.5 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)] focus:ring-2 focus:ring-[var(--ms-primary)]/20 transition-base";
  const sectionH = "flex items-center gap-2 text-[0.72rem] uppercase tracking-wider font-bold pt-1 mb-3 pb-2 border-b border-[var(--ms-border)]";

  const modal = (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center p-2 sm:p-6 bg-black/50 backdrop-blur-md overflow-y-auto fade-up" onClick={onClose} data-testid="order-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-4 sm:my-8">
        {/* Header + progress */}
        <div className="px-7 pt-6 pb-3 border-b border-[var(--ms-border)] rounded-t-3xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-2xl font-bold tracking-tight" data-testid="modal-title">{order ? "Edit Order" : "Tambah Order Baru"}</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--ms-bg)] transition-base" data-testid="close-modal-btn"><X size={18} /></button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-[var(--ms-text-muted)] flex-shrink-0">Kelengkapan</div>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--ms-bg)] overflow-hidden">
              <div className="h-full transition-all duration-300" style={{ width: `${completion}%`, background: "var(--ms-primary)" }} />
            </div>
            <div className="text-xs font-mono font-bold w-10 text-right" style={{ color: "var(--ms-primary)" }}>{completion}%</div>
          </div>
        </div>

        <div className="p-7 space-y-6">
          {/* INFO DASAR */}
          <div>
            <div className={sectionH} style={{ color: "var(--ms-primary)" }}><Bell size={13} /> Info dasar</div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Tanggal order</label><input type="date" className={inp} value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} data-testid="input-tanggal" /></div>
              <div><label className={lbl}>Deadline</label><input type="date" className={inp} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} data-testid="input-deadline" /></div>
              <div><label className={lbl}>Platform / Akun</label>
                <input list="platforms-dl" className={inp} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Pilih atau ketik baru" data-testid="input-platform" />
                <datalist id="platforms-dl">{PLATFORM_OPTIONS.map((p) => <option key={p} value={p} />)}</datalist>
              </div>
              <div><label className={lbl}>Marketer / PIC</label>
                <input list="marketers-dl" className={inp} value={form.marketer} onChange={(e) => setForm({ ...form, marketer: e.target.value })} placeholder="Pilih atau ketik baru" data-testid="input-marketer" />
                <datalist id="marketers-dl">{MARKETER_OPTIONS.map((m) => <option key={m} value={m} />)}</datalist>
              </div>
              <div><label className={lbl}>Order ID (manual)</label><input className={inp} placeholder="FVR-8823" value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} data-testid="input-order-id" /></div>
              <div><label className={lbl}>Nama klien / Studio</label><input className={inp} placeholder="Roninintheshadow" value={form.klien} onChange={(e) => setForm({ ...form, klien: e.target.value })} data-testid="input-klien" /></div>
            </div>
          </div>

          {/* DETAIL PROJECT */}
          <div>
            <div className={sectionH} style={{ color: "var(--ms-primary)" }}><Sparkles size={13} /> Detail project</div>
            <div className="space-y-4">
              <div><label className={lbl}>Nama project / Karakter</label><input className={inp} placeholder="Ronin Vtuber" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} data-testid="input-project" /></div>
              <div className="bg-[var(--ms-bg)] rounded-xl p-3 border border-[var(--ms-border)]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[0.68rem] uppercase tracking-wider font-bold font-mono flex items-center gap-1.5" style={{ color: "var(--ms-primary)" }}><Folder size={11} /> Kode folder {form.folder_code_manual ? "(manual)" : "(otomatis)"}</div>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.folder_code_manual} onChange={(e) => setForm({ ...form, folder_code_manual: e.target.checked })} className="accent-[var(--ms-primary)]" data-testid="folder-manual-toggle" />
                    Edit manual
                  </label>
                </div>
                {form.folder_code_manual ? (
                  <input className="w-full bg-white rounded-lg border border-[var(--ms-border)] px-3 py-1.5 font-mono text-sm" value={form.folder_code} onChange={(e) => setForm({ ...form, folder_code: e.target.value })} data-testid="folder-code-input" />
                ) : (
                  <div className="font-mono text-sm font-bold break-all" data-testid="folder-code-preview">{previewFolderCode}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={lbl}>Jenis pekerjaan</label>
                  <select className={inp} value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })} data-testid="select-jenis">
                    {JENIS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Status pekerjaan</label>
                  <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} data-testid="select-status">
                    {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* TIM ARTIST */}
          <div>
            <div className={sectionH} style={{ color: "var(--ms-primary)" }}>👤 Tim Artist</div>
            <div className="space-y-2">
              {form.artists.map((a, i) => (
                <div key={i} className="flex gap-2 items-center" data-testid={`artist-row-${i}`}>
                  <span className="text-[0.68rem] font-mono font-bold flex-shrink-0 px-2.5 py-1 rounded-full bg-[var(--ms-primary-soft)] whitespace-nowrap" style={{ color: "var(--ms-primary)" }}>Artist&nbsp;{i + 1}</span>
                  <input className={inp + " flex-1 min-w-0"} placeholder="Nama artist" value={a} onChange={(e) => setArtist(i, e.target.value)} data-testid={`input-artist-${i}`} />
                  <select className={inp + " w-24 flex-shrink-0"} value={form.artist_statuses[i] || "Tim"} onChange={(e) => setArtistStatus(i, e.target.value)} data-testid={`select-artist-status-${i}`}>
                    {ARTIST_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  {form.artists.length > 1 && <button onClick={() => removeArtist(i)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 flex-shrink-0" data-testid={`remove-artist-${i}`}><Trash2 size={14} /></button>}
                </div>
              ))}
              <button onClick={addArtist} className="w-full py-2 rounded-xl border-2 border-dashed border-[var(--ms-border)] text-sm font-semibold text-[var(--ms-text-muted)] hover:border-[var(--ms-primary)] hover:text-[var(--ms-primary)] transition-base flex items-center justify-center gap-1.5" data-testid="add-artist-btn">
                <Plus size={14} /> Tambah artist
              </button>
            </div>
          </div>

          {/* KEUANGAN */}
          <div>
            <div className={sectionH} style={{ color: "var(--ms-primary)" }}>💰 Keuangan</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Nilai order ({form.currency})</label>
                <div className="flex">
                  <select className="px-2 py-2 rounded-l-xl border border-r-0 border-[var(--ms-border)] bg-[var(--ms-bg)] text-sm font-bold focus:outline-none" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} data-testid="select-currency">
                    <option value="USD">$</option>
                    <option value="IDR">Rp</option>
                  </select>
                  <input type="number" className="flex-1 px-3 py-2 rounded-r-xl border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)]" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="input-value" />
                </div>
                <div className="text-[0.68rem] text-[var(--ms-text-muted)] mt-1 font-mono">≈ {valueSecondary}</div>
              </div>
              <div>
                <label className={lbl}>Fee Freelance (Rp){!hasFreelance && <span className="text-[0.65rem] text-[var(--ms-text-muted)] ml-1 normal-case">— tidak perlu untuk Tim</span>}</label>
                <input type="number" className={inp} disabled={!hasFreelance} placeholder="500000" value={form.fee_freelance} onChange={(e) => setForm({ ...form, fee_freelance: e.target.value })} data-testid="input-fee" />
                <div className="text-[0.68rem] text-[var(--ms-text-muted)] mt-1 font-mono flex items-center justify-between gap-2">
                  <span>{hasFreelance ? `≈ $${(Number(form.fee_freelance) / rate).toFixed(2)}` : "—"}</span>
                  {hasFreelance && Number(form.value) > 0 && (
                    <span className={`px-1.5 py-0.5 rounded font-bold ${feePercent > 40 ? "bg-rose-100 text-rose-700" : feePercent > 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`} data-testid="fee-percent">
                      {feePercent.toFixed(1)}% dari order
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className={lbl}>Net (otomatis)</label>
                <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 font-display text-base font-bold text-emerald-700" data-testid="net-display">${netUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                <div className="text-[0.68rem] text-[var(--ms-text-muted)] mt-1 font-mono">≈ Rp{Math.round(netUSD * rate).toLocaleString("id-ID")}</div>
              </div>
            </div>
            <div className="mt-4">
              <label className={lbl}>Sudah Dibayar?</label>
              <select className={inp + " max-w-xs"} value={form.paid ? "true" : "false"} onChange={(e) => setForm({ ...form, paid: e.target.value === "true" })} data-testid="select-paid">
                <option value="false">Belum Lunas</option>
                <option value="true">Lunas</option>
              </select>
            </div>
          </div>

          <div><label className={lbl}>Catatan</label><textarea rows={2} className={inp} placeholder="Catatan..." value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} data-testid="input-catatan" /></div>

          {/* Telegram notif buttons (only when editing) */}
          {order && (
            <div className="bg-[var(--ms-bg)] rounded-xl p-4 border border-[var(--ms-border)]">
              <div className="text-[0.68rem] uppercase tracking-wider font-bold font-mono mb-2.5 flex items-center gap-1.5" style={{ color: "var(--ms-primary)" }}><Send size={11} /> Kirim Notif Telegram</div>
              <div className="flex flex-wrap gap-2">
                <button disabled={sendingNotif} onClick={() => handleNotif("new")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-base disabled:opacity-50" data-testid="notif-new-btn"><Sparkles size={11} /> Order Baru</button>
                <button disabled={sendingNotif} onClick={() => handleNotif("reminder")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-300 text-amber-700 hover:bg-amber-50 transition-base disabled:opacity-50" data-testid="notif-reminder-btn"><Clock size={11} /> Reminder</button>
                <button disabled={sendingNotif} onClick={() => handleNotif("warning")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-rose-300 text-rose-700 hover:bg-rose-50 transition-base disabled:opacity-50" data-testid="notif-warning-btn"><AlertTriangle size={11} /> Warning H-1</button>
                <button disabled={sendingNotif} onClick={() => handleNotif("custom")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--ms-border)] hover:bg-white transition-base disabled:opacity-50" data-testid="notif-custom-btn"><Bell size={11} /> Sisa hari</button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border-t border-[var(--ms-border)] px-7 py-4 flex items-center justify-end gap-3 rounded-b-3xl">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full border border-[var(--ms-border)] text-sm font-semibold hover:bg-[var(--ms-bg)] transition-base" data-testid="cancel-btn">Batal</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-full text-white text-sm font-semibold flex items-center gap-2 transition-base hover:opacity-90 disabled:opacity-60" style={{ background: "var(--ms-primary)" }} data-testid="save-btn">
            <Save size={16} /> {saving ? "Menyimpan..." : (order ? "Simpan perubahan" : "Simpan")}
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
