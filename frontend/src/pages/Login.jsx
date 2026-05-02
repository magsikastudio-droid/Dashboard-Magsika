import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Dice5, LogIn, Sparkles } from "lucide-react";

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--ms-bg)" }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-[var(--ms-border)] p-10 fade-up">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #6d4cff, #3a8dff)" }}>
              <Dice5 size={22} />
            </div>
            <div>
              <div className="font-display text-2xl font-bold tracking-tight">Magsika <span style={{ color: "var(--ms-primary)" }}>Studio</span></div>
              <div className="text-[0.7rem] uppercase tracking-wider text-[var(--ms-text-muted)] font-mono">3D Order &amp; Invoice Dashboard</div>
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight mb-2">Selamat datang kembali.</h1>
          <p className="text-sm text-[var(--ms-text-muted)] mb-7 leading-relaxed">Masuk dengan akun Google tim untuk mengakses dashboard administrasi order 3D.</p>

          <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl text-white font-semibold transition-base hover:opacity-90" style={{ background: "var(--ms-primary)" }} data-testid="google-login-btn">
            <LogIn size={18} /> Masuk dengan Google
          </button>

          <div className="mt-6 flex items-start gap-2 text-xs text-[var(--ms-text-muted)] bg-[var(--ms-bg)] p-3 rounded-xl border border-[var(--ms-border)]">
            <Sparkles size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--ms-primary)" }} />
            <p>Sinkronisasi <strong>real-time</strong> aktif — semua perubahan tim langsung tampil di browser lain.</p>
          </div>
        </div>
        <p className="text-center text-xs text-[var(--ms-text-muted)] mt-5 font-mono">© Magsika Studio · magsikastudio.com</p>
      </div>
    </div>
  );
}
