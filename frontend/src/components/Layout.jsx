import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ClipboardList, KanbanSquare, Receipt, LogOut, Wifi, WifiOff, Dice5, Settings as SettingsIcon, TrendingUp, Palette, Archive, DollarSign, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/orders", label: "Orders", icon: ClipboardList, testid: "nav-orders" },
  { to: "/board", label: "Board", icon: KanbanSquare, testid: "nav-board" },
  { to: "/invoice", label: "Invoice", icon: Receipt, testid: "nav-invoice" },
  { to: "/earning", label: "Earning", icon: TrendingUp, testid: "nav-earning" },
  { to: "/freelance", label: "Freelance", icon: Palette, testid: "nav-freelance" },
  { to: "/archive", label: "Arsip", icon: Archive, testid: "nav-archive" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { wsConnected } = useOrders();
  const { rate, display, updateRate, setDisplayCurrency } = useCurrency();
  const navigate = useNavigate();
  const [showRate, setShowRate] = useState(false);
  const [rateInput, setRateInput] = useState(rate);

  const navItems = user?.role === "admin" ? [...baseNav, { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" }] : baseNav;

  const saveRate = () => { updateRate(parseFloat(rateInput) || 16000); setShowRate(false); };

  return (
    <div className="min-h-screen" style={{ background: "var(--ms-bg)" }}>
      <header className="sticky top-0 z-30 backdrop-blur bg-white/85 border-b border-[var(--ms-border)]">
        <div className="max-w-[1500px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-3" data-testid="brand-logo">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #6d4cff, #3a8dff)" }}>
              <Dice5 size={20} />
            </div>
            <div className="leading-tight text-left">
              <div className="font-display text-[1.15rem] font-bold tracking-tight">Magsika <span style={{ color: "var(--ms-primary)" }}>Studio</span></div>
              <div className="text-[0.66rem] uppercase tracking-wider text-[var(--ms-text-muted)] font-mono">Administration Database</div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-1 bg-[var(--ms-bg)] p-1 rounded-full border border-[var(--ms-border)]">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} data-testid={item.testid}
                className={({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-base ${isActive ? "text-white shadow-sm" : "text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]"}`}
                style={({ isActive }) => isActive ? { background: "var(--ms-primary)" } : {}}>
                <item.icon size={14} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Currency toggle + rate */}
            <div className="flex items-center bg-[var(--ms-bg)] p-0.5 rounded-full border border-[var(--ms-border)]" data-testid="currency-toggle">
              <button onClick={() => setDisplayCurrency("USD")} className={`px-2.5 py-1 rounded-full text-xs font-bold transition-base ${display === "USD" ? "bg-white shadow-sm" : "text-[var(--ms-text-muted)]"}`} data-testid="currency-usd-btn">$ USD</button>
              <button onClick={() => setDisplayCurrency("IDR")} className={`px-2.5 py-1 rounded-full text-xs font-bold transition-base ${display === "IDR" ? "bg-white shadow-sm" : "text-[var(--ms-text-muted)]"}`} data-testid="currency-idr-btn">Rp IDR</button>
            </div>
            <button onClick={() => setShowRate(!showRate)} className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--ms-bg)] border border-[var(--ms-border)] text-[0.68rem] font-mono font-semibold hover:bg-white transition-base" data-testid="rate-btn" title="Atur kurs">
              <RefreshCw size={11} /> 1$ = Rp{Math.round(rate).toLocaleString("id-ID")}
            </button>
            {showRate && (
              <div className="absolute top-16 right-6 bg-white border border-[var(--ms-border)] rounded-2xl p-4 shadow-lg z-50 w-72" data-testid="rate-popup">
                <div className="text-xs font-bold mb-2 uppercase tracking-wider font-mono" style={{ color: "var(--ms-primary)" }}>Kurs IDR / 1 USD</div>
                <input type="number" className="w-full px-3 py-2 rounded-xl border border-[var(--ms-border)] text-sm font-mono" value={rateInput} onChange={(e) => setRateInput(e.target.value)} data-testid="rate-input" />
                <div className="flex gap-2 mt-3 justify-end">
                  <button onClick={() => setShowRate(false)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--ms-border)]">Batal</button>
                  <button onClick={saveRate} className="px-3 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: "var(--ms-primary)" }} data-testid="save-rate-btn">Simpan</button>
                </div>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: wsConnected ? "#dcfce7" : "#fee2e2", color: wsConnected ? "#15803d" : "#b91c1c" }} data-testid="ws-status">
              {wsConnected ? <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span></span> : <WifiOff size={12} />}
              {wsConnected ? "Live" : "Offline"}
            </div>
            {user && (
              <div className="flex items-center gap-2">
                {user.picture && <img src={user.picture} alt="" className="w-8 h-8 rounded-full border border-[var(--ms-border)]" />}
                <button onClick={logout} className="p-2 rounded-full hover:bg-[var(--ms-bg)] text-[var(--ms-text-muted)] transition-base" data-testid="logout-btn"><LogOut size={16} /></button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:hidden px-4 pb-3 flex gap-1.5 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${isActive ? "text-white" : "text-[var(--ms-text-muted)] bg-[var(--ms-bg)]"}`} style={({ isActive }) => isActive ? { background: "var(--ms-primary)" } : {}}>
              <item.icon size={13} /> {item.label}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 py-8 fade-up">{children}</main>
    </div>
  );
}
