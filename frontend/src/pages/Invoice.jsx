import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Receipt, Printer, Search, Check, FileText, Building2 } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { api } from "../lib/api";
import { fmtDate, monthKey, monthLabel } from "../lib/format";

const sanitizeName = (s) => (s || "")
  .toUpperCase()
  .replace(/[^A-Z0-9 ]+/g, "")
  .replace(/\s+/g, "")
  .slice(0, 24);

export default function Invoice() {
  const { orders } = useOrders();
  const { fmt, convert, display } = useCurrency();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [klien, setKlien] = useState("");
  const [bulan, setBulan] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [nextNo, setNextNo] = useState(1);

  // Initial seed from URL
  useEffect(() => {
    const k = searchParams.get("klien");
    const b = searchParams.get("bulan");
    const o = searchParams.get("orderId");
    if (k) setKlien(k);
    if (b) setBulan(b);
    if (o) { setSelected(new Set([o])); const ord = orders.find((x) => x.id === o); if (ord) setKlien(ord.klien); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, orders.length]);

  // fetch next invoice number from backend whenever klien changes
  useEffect(() => {
    if (!klien) { setNextNo(1); return; }
    api.get(`/invoices/next?klien=${encodeURIComponent(klien)}`)
      .then((r) => setNextNo(r.data?.next || 1))
      .catch(() => setNextNo(1));
  }, [klien]);

  const klienList = useMemo(() => Array.from(new Set(orders.map((o) => o.klien))).filter(Boolean).sort(), [orders]);
  const bulanList = useMemo(() => Array.from(new Set(orders.filter((o) => !klien || o.klien === klien).map((o) => monthKey(o.tanggal)))).sort().reverse(), [orders, klien]);

  const searchResults = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    return orders.filter((o) =>
      `${o.project} ${o.klien} ${o.order_id || ""} ${o.folder_code || ""}`.toLowerCase().includes(s)
    ).slice(0, 20);
  }, [q, orders]);

  const candidates = useMemo(() => {
    return orders.filter((o) => {
      if (klien && o.klien !== klien) return false;
      if (bulan !== "all" && monthKey(o.tanggal) !== bulan) return false;
      return true;
    }).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [orders, klien, bulan]);

  const items = useMemo(() => {
    if (selected.size === 0) return candidates;
    return orders.filter((o) => selected.has(o.id)).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [orders, selected, candidates]);

  const toggle = (id) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const selectAll = () => { setSelected(new Set(candidates.map((o) => o.id))); };
  const clearSel = () => setSelected(new Set());

  const invKlien = items[0]?.klien || klien || "-";

  // Sum in display currency
  const total = items.reduce((s, o) => s + convert(o.value || 0, o.currency || "USD"), 0);
  const paid = items.filter((o) => o.paid).reduce((s, o) => s + convert(o.value || 0, o.currency || "USD"), 0);
  const due = total - paid;

  // Invoice number: [YYMMDD]-[CLIENT]-INV-N
  const today = new Date();
  const yymmdd = `${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const invNumber = `${yymmdd}-${sanitizeName(invKlien) || "ALL"}-INV-${nextNo}`;

  const handlePrint = async () => {
    if (items.length === 0) return;
    // Save invoice record (increments counter on backend)
    try {
      await api.post("/invoices", {
        klien: invKlien,
        invoice_no: invNumber,
        order_ids: items.map((o) => o.id),
        total_display: total,
        currency_display: display,
      });
      // refresh next number
      const r = await api.get(`/invoices/next?klien=${encodeURIComponent(invKlien)}`);
      setNextNo(r.data?.next || nextNo + 1);
    } catch (e) { /* non-fatal */ }
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
            <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Pilih project untuk invoice — per project atau gabungan.</p>
          </div>
        </div>
      </div>

      <div className="no-print bg-white rounded-2xl border border-[var(--ms-border)] p-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project / klien / folder code..." className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)] transition-base" data-testid="invoice-search" />
        </div>

        {searchResults.length > 0 && (
          <div className="max-h-56 overflow-y-auto border border-[var(--ms-border)] rounded-xl" data-testid="search-results">
            {searchResults.map((o) => (
              <button key={o.id} onClick={() => { toggle(o.id); }} className={`w-full flex items-center gap-3 p-2.5 hover:bg-[var(--ms-bg)] border-b border-[var(--ms-border)] last:border-0 text-left transition-base ${selected.has(o.id) ? "bg-[var(--ms-primary-soft)]/50" : ""}`} data-testid={`search-result-${o.id}`}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected.has(o.id) ? "bg-[var(--ms-primary)] border-[var(--ms-primary)]" : "border-[var(--ms-border)]"}`}>
                  {selected.has(o.id) && <Check size={13} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{o.project}</div>
                  <div className="text-xs text-[var(--ms-text-muted)] font-mono truncate">{o.klien} · {o.folder_code} · {fmtDate(o.tanggal)}</div>
                </div>
                <div className="font-mono text-xs font-bold">{fmt(o.value, o.currency || "USD")}</div>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <select value={klien} onChange={(e) => { setKlien(e.target.value); clearSel(); }} className="px-4 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)]" data-testid="invoice-klien-select">
            <option value="">Pilih Klien...</option>
            {klienList.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="px-4 py-2 rounded-xl border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)]" data-testid="invoice-bulan-select">
            <option value="all">Semua Bulan</option>
            {bulanList.map((b) => <option key={b} value={b}>{monthLabel(b)}</option>)}
          </select>
          {candidates.length > 0 && (
            <>
              <button onClick={selectAll} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border border-[var(--ms-border)] hover:bg-[var(--ms-bg)] transition-base" data-testid="select-all-btn">Pilih semua ({candidates.length})</button>
              {selected.size > 0 && <button onClick={clearSel} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border border-[var(--ms-border)] hover:bg-[var(--ms-bg)] transition-base" data-testid="clear-sel-btn">Clear ({selected.size})</button>}
            </>
          )}
          <div className="flex-1" />
          {klien && <span className="text-xs font-mono text-[var(--ms-text-muted)]" data-testid="next-invoice-no">Invoice ke-<strong style={{ color: "var(--ms-primary)" }}>{nextNo}</strong> untuk {invKlien}</span>}
          <button onClick={handlePrint} disabled={items.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-semibold transition-base hover:opacity-90 disabled:opacity-50" style={{ background: "var(--ms-primary)" }} data-testid="print-btn">
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>

        {/* Candidate list with checkboxes */}
        {klien && candidates.length > 0 && (
          <div className="border border-[var(--ms-border)] rounded-xl overflow-hidden" data-testid="candidate-list">
            {candidates.map((o) => (
              <button key={o.id} onClick={() => toggle(o.id)} className={`w-full flex items-center gap-3 p-2.5 hover:bg-[var(--ms-bg)] border-b border-[var(--ms-border)] last:border-0 text-left transition-base ${selected.has(o.id) ? "bg-[var(--ms-primary-soft)]/50" : ""}`} data-testid={`cand-${o.id}`}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected.has(o.id) ? "bg-[var(--ms-primary)] border-[var(--ms-primary)]" : "border-[var(--ms-border)]"}`}>
                  {selected.has(o.id) && <Check size={13} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{o.project}</div>
                  <div className="text-xs text-[var(--ms-text-muted)] font-mono truncate">{o.folder_code} · {fmtDate(o.tanggal)}</div>
                </div>
                <div className="font-mono text-xs font-bold">{fmt(o.value, o.currency || "USD")}</div>
                <span className="text-[0.65rem] font-bold font-mono px-2 py-0.5 rounded-full" style={{ background: o.paid ? "#dcfce7" : "#fee2e2", color: o.paid ? "#15803d" : "#b91c1c" }}>{o.paid ? "LUNAS" : "BELUM"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="no-print border-2 border-dashed border-[var(--ms-border)] rounded-2xl p-10 text-center text-[var(--ms-text-muted)]">
          <FileText size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Pilih klien atau search project untuk mulai generate invoice.</p>
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
              <div className="text-xs text-[var(--ms-text-muted)] mt-1 font-mono">{fmtDate(new Date().toISOString())}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-2">Ditagihkan kepada</div>
              <div className="font-display text-lg font-bold">{invKlien}</div>
            </div>
            <div>
              <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-2">Jumlah Item</div>
              <div className="font-display text-lg font-bold">{items.length} project</div>
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-[var(--ms-border)]">
                <th className="text-left py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Tanggal</th>
                <th className="text-left py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Project</th>
                <th className="text-left py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Folder</th>
                <th className="text-right py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Value</th>
                <th className="text-center py-2.5 text-[0.65rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-[var(--ms-border)]">
                  <td className="py-3 font-mono text-xs">{fmtDate(o.tanggal)}</td>
                  <td className="py-3 font-semibold">{o.project}</td>
                  <td className="py-3 font-mono text-[0.68rem] text-[var(--ms-text-muted)]">{o.folder_code}</td>
                  <td className="py-3 text-right font-mono font-semibold">{fmt(o.value, o.currency || "USD")}</td>
                  <td className="py-3 text-center text-xs font-bold font-mono" style={{ color: o.paid ? "#15803d" : "#b91c1c" }}>{o.paid ? "LUNAS" : "BELUM"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm"><span className="text-[var(--ms-text-muted)]">Total Tagihan</span><span className="font-mono font-semibold">{fmt(total, display)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[var(--ms-text-muted)]">Sudah Dibayar</span><span className="font-mono font-semibold text-emerald-700">{fmt(paid, display)}</span></div>
              <div className="flex justify-between border-t-2 border-[var(--ms-border)] pt-3 mt-2">
                <span className="font-display text-lg font-bold">Sisa Tagihan</span>
                <span className="font-display text-lg font-extrabold" style={{ color: due > 0 ? "var(--ms-red)" : "var(--ms-green)" }} data-testid="invoice-due">{fmt(due, display)}</span>
              </div>
            </div>
          </div>

          {/* Bank details */}
          <div className="mt-10 pt-6 border-t-2 border-[var(--ms-border)]" data-testid="bank-details">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 flex-shrink-0">
                <Building2 size={22} />
              </div>
              <div className="flex-1">
                <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono mb-2" style={{ color: "var(--ms-primary)" }}>Pembayaran ditransfer ke</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[0.62rem] uppercase tracking-wider font-mono text-[var(--ms-text-muted)]">Bank</div>
                    <div className="font-display text-base font-bold">BCA</div>
                  </div>
                  <div>
                    <div className="text-[0.62rem] uppercase tracking-wider font-mono text-[var(--ms-text-muted)]">No. Rekening</div>
                    <div className="font-mono text-base font-bold tracking-wide">8030651287</div>
                  </div>
                  <div>
                    <div className="text-[0.62rem] uppercase tracking-wider font-mono text-[var(--ms-text-muted)]">Atas Nama</div>
                    <div className="font-display text-base font-bold">Ivo Febrian Pratama</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-[var(--ms-text-muted)] font-mono leading-relaxed">
            Terima kasih atas kepercayaan Anda. — Magsika Studio Team
          </div>
        </div>
      )}
    </div>
  );
}
