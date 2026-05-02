import React, { useEffect, useState } from "react";
import { X, Save } from "lucide-react";
import { JENIS_OPTIONS, STATUS_OPTIONS } from "../lib/constants";
import { useOrders } from "../context/OrdersContext";
import { toast } from "sonner";

const empty = {
  tanggal: new Date().toISOString().slice(0, 10),
  deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  klien: "",
  project: "",
  jenis: "Modeling",
  status: "Modeling",
  artists: ["", "", ""],
  value: 0,
  paid: false,
  catatan: "",
};

export default function OrderModal({ open, onClose, order }) {
  const { createOrder, updateOrder } = useOrders();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      const a = [...(order.artists || []), "", "", ""].slice(0, 3);
      setForm({ ...order, artists: a });
    } else {
      setForm(empty);
    }
  }, [order, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.klien.trim() || !form.project.trim()) {
      toast.error("Klien dan project wajib diisi");
      return;
    }
    const payload = {
      ...form,
      value: Number(form.value) || 0,
      artists: form.artists.filter((a) => a && a.trim()),
    };
    setSaving(true);
    try {
      if (order) {
        await updateOrder(order.id, payload);
        toast.success("Order berhasil diupdate");
      } else {
        await createOrder(payload);
        toast.success("Order baru ditambahkan");
      }
      onClose();
    } catch (e) {
      toast.error("Gagal menyimpan: " + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const lbl = "block text-[0.7rem] uppercase tracking-wider font-bold text-[var(--ms-primary)] mb-1.5 font-mono";
  const inp = "w-full px-3.5 py-2.5 rounded-xl border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)] focus:ring-2 focus:ring-[var(--ms-primary)]/20 transition-base";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-up" onClick={onClose} data-testid="order-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[var(--ms-border)] px-7 py-5 flex items-center justify-between rounded-t-3xl">
          <h2 className="font-display text-2xl font-bold tracking-tight" data-testid="modal-title">{order ? "Edit Order" : "Tambah Order Baru"}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--ms-bg)] transition-base" data-testid="close-modal-btn"><X size={18} /></button>
        </div>

        <div className="p-7 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Tanggal Order</label><input type="date" className={inp} value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} data-testid="input-tanggal" /></div>
            <div><label className={lbl}>Deadline</label><input type="date" className={inp} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} data-testid="input-deadline" /></div>
          </div>
          <div><label className={lbl}>Nama Klien / Studio</label><input className={inp} placeholder="Contoh: Studio Animax" value={form.klien} onChange={(e) => setForm({ ...form, klien: e.target.value })} data-testid="input-klien" /></div>
          <div><label className={lbl}>Nama Project / Karakter</label><input className={inp} placeholder="Contoh: Character Ranger Full Body 3D" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} data-testid="input-project" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Jenis Pekerjaan</label>
              <select className={inp} value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })} data-testid="select-jenis">
                {JENIS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status</label>
              <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} data-testid="select-status">
                {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <label className={lbl}>Artist {i + 1}{i > 0 ? " (opsional)" : ""}</label>
                <input className={inp} placeholder="Nama artist..." value={form.artists[i] || ""} onChange={(e) => {
                  const a = [...form.artists]; a[i] = e.target.value; setForm({ ...form, artists: a });
                }} data-testid={`input-artist-${i}`} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Value (Rp)</label><input type="number" className={inp} placeholder="1500000" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="input-value" /></div>
            <div><label className={lbl}>Sudah Dibayar?</label>
              <select className={inp} value={form.paid ? "true" : "false"} onChange={(e) => setForm({ ...form, paid: e.target.value === "true" })} data-testid="select-paid">
                <option value="false">Belum Lunas</option>
                <option value="true">Lunas</option>
              </select>
            </div>
          </div>
          <div><label className={lbl}>Catatan</label><textarea rows={2} className={inp} placeholder="Catatan tambahan..." value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} data-testid="input-catatan" /></div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-[var(--ms-border)] px-7 py-4 flex items-center justify-end gap-3 rounded-b-3xl">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full border border-[var(--ms-border)] text-sm font-semibold hover:bg-[var(--ms-bg)] transition-base" data-testid="cancel-btn">Batal</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-full text-white text-sm font-semibold flex items-center gap-2 transition-base hover:opacity-90 disabled:opacity-60" style={{ background: "var(--ms-primary)" }} data-testid="save-btn">
            <Save size={16} /> {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
