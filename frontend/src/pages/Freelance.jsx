import React, { useEffect, useState, useMemo } from "react";
import { Users, Palette } from "lucide-react";
import { api } from "../lib/api";
import { fmtRp, fmtDate, monthLabel, currentMonth, monthKey } from "../lib/format";
import { ARTIST_COLORS } from "../lib/constants";

export default function Freelance() {
  const [data, setData] = useState({ by_artist: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    (async () => { try { const r = await api.get("/freelance"); setData(r.data); } finally { setLoading(false); } })();
  }, []);

  const monthList = useMemo(() => {
    const m = new Set(data.rows.map((r) => monthKey(r.tanggal)).filter(Boolean));
    m.add(currentMonth()); m.add("all");
    return ["all", ...Array.from(m).filter((x) => x !== "all").sort().reverse()];
  }, [data]);

  const filteredRows = useMemo(() => {
    if (month === "all") return data.rows;
    return data.rows.filter((r) => monthKey(r.tanggal) === month);
  }, [data, month]);

  const byArtistInMonth = useMemo(() => {
    if (month === "all") return data.by_artist;
    const map = {};
    filteredRows.forEach((r) => {
      if (!map[r.artist]) map[r.artist] = { artist: r.artist, total_fee: 0, count: 0 };
      map[r.artist].total_fee += r.fee_per_artist;
      map[r.artist].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total_fee - a.total_fee);
  }, [data, filteredRows, month]);

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
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-4 py-2.5 rounded-full border border-[var(--ms-border)] bg-white text-sm font-semibold focus:outline-none focus:border-[var(--ms-primary)]" data-testid="freelance-month">
          {monthList.map((m) => <option key={m} value={m}>{m === "all" ? "Semua Bulan" : monthLabel(m)}{m === currentMonth() ? " — skrg" : ""}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {byArtistInMonth.map((a) => {
          const color = ARTIST_COLORS[a.artist] || ARTIST_COLORS.Default;
          return (
            <div key={a.artist} className="bg-white rounded-2xl border border-[var(--ms-border)] p-5 card-hover relative overflow-hidden" data-testid={`artist-fee-${a.artist}`}>
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />
              <div className="flex items-center gap-2 mb-3"><Users size={14} style={{ color }} /><h3 className="font-display text-lg font-bold" style={{ color }}>{a.artist}</h3></div>
              <div className="font-display text-xl font-extrabold" style={{ color: "var(--ms-primary)" }}>{fmtRp(a.total_fee)}</div>
              <div className="text-xs text-[var(--ms-text-muted)] mt-1 font-mono">{a.count} project</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="p-5 border-b border-[var(--ms-border)]">
          <h2 className="font-display text-xl font-bold tracking-tight">Detail Fee per Project</h2>
          <p className="text-xs text-[var(--ms-text-muted)] mt-1">Fee dibagi rata per artist. Total fee = {fmtRp(filteredRows.reduce((s, r) => s + r.fee_per_artist, 0))}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--ms-primary-soft)]">
              <tr className="text-left">
                {["Tanggal", "Artist", "Klien", "Project", "Folder Code", "Status", "Fee"].map((h) => <th key={h} className="px-4 py-3 text-[0.68rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody data-testid="freelance-rows">
              {filteredRows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-[var(--ms-text-muted)]">Tidak ada fee di bulan ini.</td></tr>}
              {filteredRows.map((r, i) => (
                <tr key={r.order_id + r.artist + i} className="border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)]">
                  <td className="px-4 py-3 font-mono text-xs">{fmtDate(r.tanggal)}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: ARTIST_COLORS[r.artist] || "#475569" }}>{r.artist}</td>
                  <td className="px-4 py-3 text-xs">{r.klien}</td>
                  <td className="px-4 py-3 font-semibold text-sm">{r.project}</td>
                  <td className="px-4 py-3 font-mono text-[0.68rem] text-[var(--ms-text-muted)]">{r.folder_code}</td>
                  <td className="px-4 py-3 text-xs">{r.status}</td>
                  <td className="px-4 py-3 font-mono font-bold text-right">{fmtRp(r.fee_per_artist)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
