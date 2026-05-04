import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Dice5, LogIn, Sparkles, Mail, Lock, UserPlus } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const fmtErr = (d) => {
  if (!d) return "Terjadi kesalahan";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return d?.msg || JSON.stringify(d);
};

export default function Login() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const handleGoogle = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      if (mode === "login") {
        await api.post("/auth/login", { email: email.trim().toLowerCase(), password });
        toast.success("Login berhasil");
        if (refresh) await refresh();
        navigate("/dashboard", { replace: true });
      } else {
        const res = await api.post("/auth/register", { email: email.trim().toLowerCase(), password, name });
        if (res.data.status === "active") {
          toast.success("Registrasi berhasil. Silakan login.");
          setMode("login");
          setPassword("");
        } else {
          toast.success("Registrasi berhasil. Tunggu persetujuan admin.");
          setMode("login");
          setPassword("");
        }
      }
    } catch (err) {
      toast.error(fmtErr(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inp = "w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--ms-border)] bg-white focus:outline-none focus:border-[var(--ms-primary)] focus:ring-2 focus:ring-[var(--ms-primary)]/20 transition-base text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--ms-bg)" }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-[var(--ms-border)] p-8 sm:p-10 fade-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #6d4cff, #3a8dff)" }}>
              <Dice5 size={22} />
            </div>
            <div>
              <div className="font-display text-2xl font-bold tracking-tight">Magsika <span style={{ color: "var(--ms-primary)" }}>Studio</span></div>
              <div className="text-[0.7rem] uppercase tracking-wider text-[var(--ms-text-muted)] font-mono">Administration Database</div>
            </div>
          </div>

          <div className="inline-flex bg-[var(--ms-bg)] rounded-full p-1 mb-5 w-full" data-testid="auth-tabs">
            <button onClick={() => setMode("login")} className={`flex-1 px-4 py-1.5 rounded-full text-xs font-bold transition-base ${mode === "login" ? "text-white" : "text-[var(--ms-text-muted)]"}`} style={mode === "login" ? { background: "var(--ms-primary)" } : {}} data-testid="tab-login">Login</button>
            <button onClick={() => setMode("register")} className={`flex-1 px-4 py-1.5 rounded-full text-xs font-bold transition-base ${mode === "register" ? "text-white" : "text-[var(--ms-text-muted)]"}`} style={mode === "register" ? { background: "var(--ms-primary)" } : {}} data-testid="tab-register">Daftar</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" data-testid="auth-form">
            {mode === "register" && (
              <div className="relative">
                <UserPlus size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
                <input className={inp} type="text" placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
              </div>
            )}
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
              <input className={inp} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required data-testid="input-email" />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)]" />
              <input className={inp} type="password" placeholder="Password (min 6 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required data-testid="input-password" />
            </div>
            <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold transition-base hover:opacity-90 disabled:opacity-50" style={{ background: "var(--ms-primary)" }} data-testid="submit-auth">
              <LogIn size={16} /> {submitting ? "..." : (mode === "login" ? "Masuk" : "Daftar")}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[var(--ms-border)]" />
            <span className="text-[0.65rem] uppercase tracking-wider font-mono text-[var(--ms-text-muted)]">atau</span>
            <div className="flex-1 h-px bg-[var(--ms-border)]" />
          </div>

          <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-2xl border border-[var(--ms-border)] font-semibold hover:bg-[var(--ms-bg)] transition-base" data-testid="google-login-btn">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Masuk dengan Google
          </button>

          <div className="mt-5 flex items-start gap-2 text-xs text-[var(--ms-text-muted)] bg-[var(--ms-bg)] p-3 rounded-xl border border-[var(--ms-border)]">
            <Sparkles size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--ms-primary)" }} />
            <p>User baru daftar → status <strong>Pending</strong> sampai admin menyetujui. Admin bisa invite user langsung aktif dari Settings.</p>
          </div>
        </div>
        <p className="text-center text-xs text-[var(--ms-text-muted)] mt-5 font-mono">© Magsika Studio · magsikastudio.com</p>
      </div>
    </div>
  );
}
