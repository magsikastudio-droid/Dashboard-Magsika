import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ClipboardList, KanbanSquare, Receipt, LogOut, Wifi, WifiOff, Dice5, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useOrders } from "../context/OrdersContext";

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/orders", label: "Orders", icon: ClipboardList, testid: "nav-orders" },
  { to: "/board", label: "Board", icon: KanbanSquare, testid: "nav-board" },
  { to: "/invoice", label: "Invoice", icon: Receipt, testid: "nav-invoice" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { wsConnected } = useOrders();
  const navigate = useNavigate();

  const navItems = user?.role === "admin"
    ? [...baseNav, { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" }]
    : baseNav;

  return (
    <div className="min-h-screen" style={{ background: "var(--ms-bg)" }}>
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-[var(--ms-border)]">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-3 group" data-testid="brand-logo">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #6d4cff, #3a8dff)" }}>
              <Dice5 size={20} />
            </div>
            <div className="leading-tight text-left">
              <div className="font-display text-[1.15rem] font-bold tracking-tight">
                Magsika <span style={{ color: "var(--ms-primary)" }}>Studio</span>
              </div>
              <div className="text-[0.7rem] uppercase tracking-wider text-[var(--ms-text-muted)] font-mono">3D Order &amp; Invoice</div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1.5 bg-[var(--ms-bg)] p-1 rounded-full border border-[var(--ms-border)]">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={item.testid}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-base ${
                    isActive ? "text-white shadow-sm" : "text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]"
                  }`
                }
                style={({ isActive }) => isActive ? { background: "var(--ms-primary)" } : {}}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: wsConnected ? "#dcfce7" : "#fee2e2", color: wsConnected ? "#15803d" : "#b91c1c" }} data-testid="ws-status">
              {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {wsConnected ? "Live" : "Offline"}
            </div>
            {user && (
              <div className="flex items-center gap-2">
                {user.picture && <img src={user.picture} alt="" className="w-8 h-8 rounded-full border border-[var(--ms-border)]" />}
                <button onClick={logout} className="p-2 rounded-full hover:bg-[var(--ms-bg)] text-[var(--ms-text-muted)] transition-base" data-testid="logout-btn" title="Logout">
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden px-4 pb-3 flex gap-1.5 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) =>
              `flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                isActive ? "text-white" : "text-[var(--ms-text-muted)] bg-[var(--ms-bg)]"
              }`}
              style={({ isActive }) => isActive ? { background: "var(--ms-primary)" } : {}}>
              <item.icon size={14} /> {item.label}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 fade-up">{children}</main>
    </div>
  );
}
