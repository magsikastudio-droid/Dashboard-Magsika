import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Receipt, Download, Printer } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { fmtRp, fmtDate, monthKey, monthLabel } from "../lib/format";

export default function Invoice() {
  const { orders } = useOrders();
  const [searchParams] = useSearchParams();
  const [klien, setKlien] = useState(searchParams.get("klien") || "");
  const [bulan, setBulan] = useState("all");

  const klienList = useMemo(() => Array.from(new Set(orders.map((o) => o.klien))).filter(Boolean).sort(), [orders]);
  const bulanList = useMemo(() => Array.from(new Set(orders.filter((o) => !klien || o.klien === klien).map((o) => monthKey(o.tanggal)))).sort().reverse(), [orders, klien]);

  useEffect(() => {
    const k = searchParams.get("klien");
    if (k) setKlien(k);
  }, [searchParams]);

  const items = useMemo(() => {
    return orders.filter((o) => {
      if (klien && o.klien !== klien) return false;
      if (bulan !== "all" && monthKey(o.tanggal) !== bulan) return false;
      return true;
    }).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [orders, klien, bulan]);

  const total = items.reduce((s, o) => s + (o.value || 0), 0);
  const paid = items.filter((o) => o.paid).reduce((s, o) => s + (o.value || 0), 0);
  const due = total - paid;

  const invNumber = `MS-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${(klien || "ALL").substring(0, 3).toUpperCase()}`;

  const handlePrint = () => window.print();

  const handleDownloadPNG = async () => {
    // simple approach: trigger print dialog (user can save PDF)
    window.print();
  };

  return (
    <div className="space-y-6" data-testid="invoice-page">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}>
            <Receipt size={20} />
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Generate Invoice</h1>
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Pilih klien lalu print/save PDF.</p>
          </div>
        </div>
      </div>

      <div className="no-print bg-white rounded-2xl border border-[var(--ms-border)] p-4 flex flex-wrap gap-3 items-center">
        <select value={klien} onChange={(e) => setKlien(e.target.value)} className="px-4 py-2.5 rounded-xl border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)] transition-base" data-testid="invoice-klien-select">
          <option value="">Pilih Klien...</option>
          {klienList.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="px-4 py-2.5 rounded-xl border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)] transition-base" data-testid="invoice-bulan-select">
          <option value="all">Semua Bulan</option>
          {bulanList.map((b) => <option key={b} value={b}>{monthLabel(b)}</option>)}
        </select>
        <button onClick={handleDownloadPNG} disabled={!klien} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--ms-border)] text-sm font-semibold hover:bg-[var(--ms-bg)] transition-base disabled:opacity-50" data-testid="download-png-btn">
          <Download size={15} /> Download / Save
        </button>
        <button onClick={handlePrint} disabled={!klien} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-semibold transition-base hover:opacity-90 disabled:opacity-50" style={{ background: "var(--ms-primary)" }} data-testid="print-btn">
          <Printer size={15} /> Print Invoice
        </button>
      </div>

      {!klien ? (
        <div className="no-print border-2 border-dashed border-[var(--ms-border)] rounded-2xl p-10 text-center text-[var(--ms-text-muted)]">
          <Receipt size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Atau tekan <kbd className="px-2 py-0.5 rounded bg-[var(--ms-bg)] border border-[var(--ms-border)] font-mono text-xs">Ctrl+P</kbd> untuk print / save PDF</p>
        </div>
      ) : (
        <div className="invoice-printable bg-white rounded-2xl border border-[var(--ms-border)] p-10 shadow-sm" data-testid="invoice-document">
          <div className="flex items-start justify-between border-b-2 border-[var(--ms-border)] pb-6 mb-6">
            <div>
              <div className="font-display text-3xl font-extrabold tracking-tight">Magsika <span style={{ color: "var(--ms-primary)" }}>Studio</span></div>
              <div className="text-xs text-[var(--ms-text-muted)] mt-1 font-mono">3D Production Studio · magsikastudio.com</div>
            </div>
            <div className="text-right">
              <div className="text-[0.7rem] uppercase tracking-wider font-bold text-[var(--ms-primary)] font-mono">Invoice</div>
              <div className="font-display text-xl font-bold" data-testid="invoice-number">{invNumber}</div>
              <div className="text-xs text-[var(--ms-text-muted)] mt-1 font-mono">Tanggal: {fmtDate(new Date().toISOString())}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-2">Ditagihkan kepada</div>
              <div className="font-display text-lg font-bold">{klien}</div>
            </div>
            <div>
              <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-2">Periode</div>
              <div className="font-display text-lg font-bold">{bulan === "all" ? "Semua periode" : monthLabel(bulan)}</div>
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-[var(--ms-border)]">
                <th className="text-left py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Tanggal</th>
                <th className="text-left py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Project</th>
                <th className="text-left py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Jenis</th>
                <th className="text-right py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Value</th>
                <th className="text-center py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-[var(--ms-text-muted)] text-sm">Tidak ada item.</td></tr>}
              {items.map((o) => (
                <tr key={o.id} className="border-b border-[var(--ms-border)]">
                  <td className="py-3 font-mono text-xs">{fmtDate(o.tanggal)}</td>
                  <td className="py-3 font-semibold">{o.project}</td>
                  <td className="py-3 text-xs text-[var(--ms-text-muted)]">{o.jenis}</td>
                  <td className="py-3 text-right font-mono font-semibold">{fmtRp(o.value)}</td>
                  <td className="py-3 text-center text-xs font-bold font-mono" style={{ color: o.paid ? "#15803d" : "#b91c1c" }}>{o.paid ? "LUNAS" : "BELUM"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm"><span className="text-[var(--ms-text-muted)]">Total Tagihan</span><span className="font-mono font-semibold">{fmtRp(total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[var(--ms-text-muted)]">Sudah Dibayar</span><span className="font-mono font-semibold text-emerald-700">{fmtRp(paid)}</span></div>
              <div className="flex justify-between border-t-2 border-[var(--ms-border)] pt-3 mt-2">
                <span className="font-display text-lg font-bold">Sisa Tagihan</span>
                <span className="font-display text-lg font-extrabold" style={{ color: due > 0 ? "var(--ms-red)" : "var(--ms-green)" }} data-testid="invoice-due">{fmtRp(due)}</span>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t-2 border-[var(--ms-border)] text-xs text-[var(--ms-text-muted)] font-mono leading-relaxed">
            <strong className="text-[var(--ms-text)]">Pembayaran:</strong> Transfer ke rekening Magsika Studio sesuai instruksi yang telah diberikan.<br />
            Terima kasih atas kepercayaan Anda. — Magsika Studio Team
          </div>
        </div>
      )}
    </div>
  );
}
