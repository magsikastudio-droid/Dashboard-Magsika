import React, { useEffect, useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { useCurrency } from "../context/CurrencyContext";
import { monthLabel, currentMonth } from "../lib/format";
import { PLATFORM_COLORS, PLATFORM_OPTIONS } from "../lib/constants";

// Earning data from backend is in IDR base (legacy values stored as numbers).
// We treat each amount as the order's stored currency. Backend aggregates raw value field which is mixed.
// For display: we trust "USD" base when convert(amount, "USD") since most data was IDR.
// Since legacy stored values may be in IDR, we add a simple heuristic: amounts > 100000 = IDR, else USD.
const guessCur = (n) => (Number(n) > 100000 ? "IDR" : "USD");

export default function Earning() {
  const [data, setData] = useState({ by_month: [], by_platform_month: [] });
  const [loading, setLoading] = useState(true);
  const { fmt, convert, display } = useCurrency();

  useEffect(() => {
    (async () => {
      try { const res = await api.get("/earnings"); setData(res.data); }
      finally { setLoading(false); }
    })();
  }, []);

  const cv = (n) => convert(Number(n) || 0, guessCur(n));

  const months = data.by_month;
  const current = months.find((m) => m.month === currentMonth()) || { gross: 0, fee: 0, net: 0, paid: 0, unpaid: 0, count: 0 };

  const pivot = useMemo(() => {
    const table = {};
    data.by_platform_month.forEach((row) => {
      if (!table[row.month]) table[row.month] = {};
      table[row.month][row.platform] = row.gross;
    });
    return Object.entries(table).sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  if (loading) return <div className="text-center py-10 text-[var(--ms-text-muted)]">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="earning-page">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700"><TrendingUp size={20} /></div>
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Earning</h1>
          <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Rekap pendapatan bulanan & per platform</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-5" data-testid="earn-current">
          <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-1">Gross bulan ini</div>
          <div className="font-display text-2xl font-extrabold" style={{ color: "var(--ms-primary)" }}>{fmt(cv(current.gross), display)}</div>
          <div className="text-xs text-[var(--ms-text-muted)] mt-2">{current.count} order · paid {fmt(cv(current.paid), display)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-5">
          <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-1">Fee Freelance</div>
          <div className="font-display text-2xl font-extrabold text-amber-600">{fmt(convert(current.fee || 0, "IDR"), display)}</div>
          <div className="text-xs text-[var(--ms-text-muted)] mt-2">Dibayarkan ke artist</div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-5">
          <div className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--ms-text-muted)] font-mono mb-1">Net Earning</div>
          <div className="font-display text-2xl font-extrabold text-emerald-700">{fmt(cv(current.net), display)}</div>
          <div className="text-xs text-[var(--ms-text-muted)] mt-2">Gross − Fee</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="p-5 border-b border-[var(--ms-border)]">
          <h2 className="font-display text-xl font-bold tracking-tight">Rekap Per Bulan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--ms-primary-soft)]">
              <tr className="text-left">
                {["Bulan", "Order", "Gross", "Fee Freelance", "Net", "Paid", "Unpaid"].map((h) => <th key={h} className="px-4 py-3 text-[0.68rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody data-testid="earn-by-month">
              {months.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-[var(--ms-text-muted)]">—</td></tr>}
              {months.map((m) => (
                <tr key={m.month} className="border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)]">
                  <td className="px-4 py-3 font-semibold">{monthLabel(m.month)}{m.month === currentMonth() && <span className="ml-2 text-[0.65rem] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--ms-primary-soft)]" style={{ color: "var(--ms-primary)" }}>SKRG</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.count}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{fmt(cv(m.gross), display)}</td>
                  <td className="px-4 py-3 font-mono text-amber-700">{fmt(convert(m.fee || 0, "IDR"), display)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-700">{fmt(cv(m.net), display)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-emerald-700">{fmt(cv(m.paid), display)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-rose-700">{fmt(cv(m.unpaid), display)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--ms-border)] overflow-hidden">
        <div className="p-5 border-b border-[var(--ms-border)]">
          <h2 className="font-display text-xl font-bold tracking-tight">Earning per Platform</h2>
          <p className="text-xs text-[var(--ms-text-muted)] mt-1">Breakdown per akun sumber order</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--ms-primary-soft)]">
              <tr className="text-left">
                <th className="px-4 py-3 text-[0.68rem] uppercase tracking-wider font-bold font-mono" style={{ color: "var(--ms-primary)" }}>Bulan</th>
                {PLATFORM_OPTIONS.map((p) => <th key={p} className="px-4 py-3 text-[0.68rem] uppercase tracking-wider font-bold font-mono text-right" style={{ color: PLATFORM_COLORS[p] }}>{p}</th>)}
                <th className="px-4 py-3 text-[0.68rem] uppercase tracking-wider font-bold font-mono text-right" style={{ color: "var(--ms-primary)" }}>Total</th>
              </tr>
            </thead>
            <tbody data-testid="earn-pivot">
              {pivot.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-[var(--ms-text-muted)]">—</td></tr>}
              {pivot.map(([month, row]) => {
                const total = PLATFORM_OPTIONS.reduce((s, p) => s + (row[p] || 0), 0);
                return (
                  <tr key={month} className="border-t border-[var(--ms-border)] hover:bg-[var(--ms-bg)]">
                    <td className="px-4 py-3 font-semibold">{monthLabel(month)}</td>
                    {PLATFORM_OPTIONS.map((p) => <td key={p} className="px-4 py-3 font-mono text-xs text-right" style={{ color: row[p] ? PLATFORM_COLORS[p] : "#cbd5e1" }}>{row[p] ? fmt(cv(row[p]), display) : "—"}</td>)}
                    <td className="px-4 py-3 font-mono font-bold text-right" style={{ color: "var(--ms-primary)" }}>{fmt(cv(total), display)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
