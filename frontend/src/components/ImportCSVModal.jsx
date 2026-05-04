import React, { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Upload, FileCheck2, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const FIELDS = [
  { key: "tanggal", label: "Tanggal (YYYY-MM-DD)", required: true },
  { key: "klien", label: "Klien", required: true },
  { key: "project", label: "Project", required: true },
  { key: "deadline", label: "Deadline (YYYY-MM-DD)" },
  { key: "platform", label: "Platform" },
  { key: "marketer", label: "Marketer" },
  { key: "jenis", label: "Jenis" },
  { key: "status", label: "Status" },
  { key: "value", label: "Value (number)" },
  { key: "currency", label: "Currency (USD/IDR)" },
  { key: "fee_freelance", label: "Fee Freelance" },
  { key: "artists", label: "Artist(s) — pisah dgn ';'" },
  { key: "paid", label: "Bayar (LUNAS/BELUM)" },
  { key: "order_id", label: "Order ID" },
  { key: "folder_code", label: "Folder Code" },
  { key: "catatan", label: "Catatan" },
];

// Heuristic: map CSV header → canonical field
const HEADER_ALIASES = {
  tanggal: ["tanggal", "date", "tgl"],
  deadline: ["deadline", "due", "due_date"],
  klien: ["klien", "client", "customer"],
  project: ["project", "nama project", "judul"],
  platform: ["platform", "akun"],
  marketer: ["marketer", "pic"],
  jenis: ["jenis", "type", "kategori"],
  status: ["status", "status pekerjaan"],
  value: ["value", "nilai", "harga", "price"],
  currency: ["currency", "mata uang", "cur"],
  fee_freelance: ["fee", "fee_freelance", "fee freelance"],
  artists: ["artist", "artists", "team"],
  paid: ["paid", "bayar", "lunas"],
  order_id: ["order_id", "order id", "id"],
  folder_code: ["folder_code", "folder code", "kode folder", "folder"],
  catatan: ["catatan", "notes", "note"],
};

const autoMap = (header) => {
  const h = header.trim().toLowerCase();
  for (const [k, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((a) => a === h)) return k;
  }
  return "__skip__";
};

// RFC 4180-ish CSV parser (handles quoted fields + escaped quotes)
const parseCSV = (text) => {
  const rows = [];
  let cur = [""]; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]; const nx = text[i + 1];
    if (inQ) {
      if (ch === '"' && nx === '"') { cur[cur.length - 1] += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cur[cur.length - 1] += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ",") { cur.push(""); }
      else if (ch === "\n") { rows.push(cur); cur = [""]; }
      else if (ch === "\r") { /* skip */ }
      else { cur[cur.length - 1] += ch; }
    }
  }
  if (cur.length > 1 || cur[0]) rows.push(cur);
  return rows.filter((r) => r.some((c) => c && c.trim()));
};

export default function ImportCSVModal({ open, onClose, onImported }) {
  const [raw, setRaw] = useState([]); // full parsed rows (header + data)
  const [mapping, setMapping] = useState({}); // colIdx → fieldKey
  const [skip, setSkip] = useState({}); // rowIdx → bool (skip row)
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const header = raw[0] || [];
  const dataRows = raw.slice(1);

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) { toast.error("CSV harus punya header + minimal 1 baris data"); return; }
    setRaw(rows);
    const m = {};
    rows[0].forEach((h, i) => { m[i] = autoMap(h); });
    setMapping(m);
    setSkip({});
    setResult(null);
  };

  const buildPayload = useMemo(() => {
    return dataRows.map((r) => {
      const obj = {};
      Object.entries(mapping).forEach(([colIdx, fieldKey]) => {
        if (fieldKey === "__skip__") return;
        const val = r[Number(colIdx)] ?? "";
        if (fieldKey === "artists") obj[fieldKey] = String(val).split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        else if (fieldKey === "paid") obj[fieldKey] = /lunas|paid|true|1/i.test(val);
        else if (["value", "fee_freelance"].includes(fieldKey)) obj[fieldKey] = Number(String(val).replace(/[^\d.-]/g, "")) || 0;
        else obj[fieldKey] = String(val).trim();
      });
      if (obj.artists) obj.artist_statuses = obj.artists.map(() => "Tim");
      return obj;
    });
  }, [dataRows, mapping]);

  const importableRows = buildPayload.filter((_, i) => !skip[i]);
  const requiredMapped = FIELDS.filter((f) => f.required).every((f) => Object.values(mapping).includes(f.key));

  if (!open) return null;

  const doImport = async () => {
    if (!requiredMapped) { toast.error("Field tanggal/klien/project wajib di-map"); return; }
    setImporting(true);
    try {
      const res = await api.post("/orders/import", { rows: importableRows });
      setResult(res.data);
      toast.success(`${res.data.created} order di-import`);
      if (res.data.created > 0) onImported && onImported();
    } catch (e) { toast.error("Gagal import: " + (e?.response?.data?.detail || e.message)); }
    finally { setImporting(false); }
  };

  const downloadTemplate = () => {
    const csv = "tanggal,deadline,klien,project,platform,marketer,jenis,status,value,currency,fee_freelance,artists,paid,folder_code\n2026-05-15,2026-05-30,Klien Demo,Project Demo,Direct,Ivo,Modeling,Modeling,500,USD,800000,Andre;Hadziq,BELUM,\n";
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "magsika-import-template.csv"; a.click();
  };

  const modal = (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="import-csv-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-5xl my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ms-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}><Upload size={16} /></div>
            <h3 className="font-display text-xl font-bold">Import Orders dari CSV</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--ms-bg)]" data-testid="import-close-btn"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5">
          {!raw.length && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-[var(--ms-border)] rounded-2xl p-10 text-center">
                <Upload size={28} className="mx-auto mb-3 text-[var(--ms-text-muted)]" />
                <p className="text-sm text-[var(--ms-text-muted)] mb-3">Pilih file CSV. Header baris pertama akan di-auto-map ke field Magsika.</p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" data-testid="csv-file-input" />
                <button onClick={() => fileRef.current?.click()} className="px-5 py-2 rounded-full text-white text-sm font-semibold" style={{ background: "var(--ms-primary)" }} data-testid="pick-csv-btn">Pilih CSV</button>
              </div>
              <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--ms-border)] text-xs font-semibold hover:bg-[var(--ms-bg)]" data-testid="download-template-btn"><Download size={12} /> Download template CSV</button>
            </div>
          )}

          {raw.length > 0 && !result && (
            <>
              {/* Field mapping */}
              <div>
                <h4 className="font-display text-base font-bold mb-2">1. Map kolom CSV → Field Magsika</h4>
                <p className="text-xs text-[var(--ms-text-muted)] mb-3">Auto-mapped berdasarkan header. Ubah jika salah, atau pilih "Skip" untuk abaikan kolom. Field dengan <span className="text-rose-600 font-bold">*</span> wajib.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto border border-[var(--ms-border)] rounded-xl p-3" data-testid="mapping-grid">
                  {header.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[0.7rem] font-mono font-bold text-[var(--ms-text-muted)] truncate flex-shrink-0" style={{ width: 140 }} title={h}>{h || `(col ${i + 1})`}</span>
                      <span className="text-[var(--ms-text-muted)]">→</span>
                      <select value={mapping[i] || "__skip__"} onChange={(e) => setMapping({ ...mapping, [i]: e.target.value })} className="flex-1 px-2 py-1 rounded border border-[var(--ms-border)] text-xs" data-testid={`map-col-${i}`}>
                        <option value="__skip__">— Skip kolom ini —</option>
                        {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {!requiredMapped && <div className="mt-2 text-xs text-rose-600 flex items-center gap-1.5" data-testid="mapping-warn"><AlertTriangle size={12} /> Field tanggal / klien / project belum semua di-map.</div>}
              </div>

              {/* Preview */}
              <div>
                <h4 className="font-display text-base font-bold mb-2">2. Preview data ({dataRows.length} baris — {importableRows.length} akan di-import)</h4>
                <div className="overflow-x-auto border border-[var(--ms-border)] rounded-xl max-h-64 overflow-y-auto">
                  <table className="w-full text-xs" data-testid="preview-table">
                    <thead className="bg-[var(--ms-bg)] sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-mono text-[0.6rem] uppercase tracking-wider text-[var(--ms-text-muted)]">Skip?</th>
                        {FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((f) => (
                          <th key={f.key} className="px-2 py-1.5 text-left font-mono text-[0.6rem] uppercase tracking-wider" style={{ color: "var(--ms-primary)" }}>{f.key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buildPayload.slice(0, 50).map((row, i) => {
                        const missingRequired = !row.tanggal || !row.klien || !row.project;
                        return (
                          <tr key={i} className={`border-t border-[var(--ms-border)] ${skip[i] ? "opacity-40 line-through" : ""} ${missingRequired ? "bg-rose-50" : ""}`}>
                            <td className="px-2 py-1"><input type="checkbox" checked={!!skip[i]} onChange={(e) => setSkip({ ...skip, [i]: e.target.checked })} data-testid={`skip-row-${i}`} /></td>
                            {FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((f) => {
                              const v = row[f.key];
                              return <td key={f.key} className="px-2 py-1 font-mono truncate" style={{ maxWidth: 150 }} title={String(v ?? "")}>{Array.isArray(v) ? v.join("; ") : String(v ?? "")}</td>;
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {buildPayload.length > 50 && <div className="text-center py-2 text-[0.68rem] text-[var(--ms-text-muted)] bg-[var(--ms-bg)]">… {buildPayload.length - 50} baris lainnya</div>}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button onClick={() => { setRaw([]); setMapping({}); setSkip({}); }} className="px-3 py-1.5 rounded-full border border-[var(--ms-border)] text-xs font-semibold hover:bg-[var(--ms-bg)]" data-testid="reset-import-btn">Pilih file lain</button>
                <button onClick={doImport} disabled={importing || !requiredMapped || importableRows.length === 0} className="flex items-center gap-2 px-5 py-2 rounded-full text-white text-sm font-semibold disabled:opacity-50" style={{ background: "var(--ms-primary)" }} data-testid="do-import-btn">
                  <FileCheck2 size={14} /> {importing ? "Mengimport..." : `Import ${importableRows.length} baris`}
                </button>
              </div>
            </>
          )}

          {result && (
            <div className="text-center space-y-3 py-4" data-testid="import-result">
              <CheckCircle2 size={40} className="mx-auto text-emerald-600" />
              <h4 className="font-display text-xl font-bold">Selesai</h4>
              <div className="flex justify-center gap-6">
                <div><div className="text-2xl font-extrabold text-emerald-700">{result.created}</div><div className="text-xs text-[var(--ms-text-muted)]">Berhasil di-import</div></div>
                {result.skipped > 0 && <div><div className="text-2xl font-extrabold text-rose-600">{result.skipped}</div><div className="text-xs text-[var(--ms-text-muted)]">Di-skip</div></div>}
              </div>
              {result.errors?.length > 0 && (
                <details className="text-xs text-left mx-auto max-w-md">
                  <summary className="cursor-pointer text-[var(--ms-text-muted)]">Lihat error ({result.errors.length})</summary>
                  <ul className="mt-2 space-y-1">{result.errors.map((e, i) => <li key={i} className="font-mono">Baris {e.row + 1}: {e.reason}</li>)}</ul>
                </details>
              )}
              <div className="flex justify-center gap-2">
                <button onClick={() => { setRaw([]); setMapping({}); setSkip({}); setResult(null); }} className="px-4 py-2 rounded-full border border-[var(--ms-border)] text-sm font-semibold" data-testid="import-another-btn">Import file lain</button>
                <button onClick={onClose} className="px-4 py-2 rounded-full text-white text-sm font-semibold" style={{ background: "var(--ms-primary)" }} data-testid="import-done-btn">Selesai</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
