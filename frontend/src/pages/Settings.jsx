import React, { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, Plus, X, Mail, Bell, ShieldCheck, Users, Send, TestTube } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ allowed_emails: [], telegram_bot_token: "", telegram_chat_id: "", reminders_enabled: true });
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") { setLoading(false); return; }
    (async () => {
      try {
        const [s, u] = await Promise.all([api.get("/settings"), api.get("/users")]);
        setSettings({ ...s.data, allowed_emails: s.data.allowed_emails || [] });
        setUsers(u.data || []);
      } catch (e) { toast.error("Gagal memuat: " + (e?.response?.data?.detail || e.message)); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put("/settings", settings);
      setSettings({ ...res.data, allowed_emails: res.data.allowed_emails || [] });
      toast.success("Settings tersimpan");
    } catch (e) { toast.error("Gagal simpan: " + (e?.response?.data?.detail || e.message)); }
    finally { setSaving(false); }
  };

  const testTelegram = async () => {
    setTesting(true);
    try { await api.post("/settings/test-telegram"); toast.success("Pesan test terkirim! Cek Telegram."); }
    catch (e) { toast.error("Gagal: " + (e?.response?.data?.detail || e.message)); }
    finally { setTesting(false); }
  };

  const addEmail = () => {
    const e = newEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) { toast.error("Email tidak valid"); return; }
    if (settings.allowed_emails.includes(e)) { toast.error("Sudah ada"); return; }
    setSettings({ ...settings, allowed_emails: [...settings.allowed_emails, e] });
    setNewEmail("");
  };
  const removeEmail = (e) => setSettings({ ...settings, allowed_emails: settings.allowed_emails.filter((x) => x !== e) });

  if (user?.role !== "admin") return (
    <div className="bg-white rounded-2xl border border-[var(--ms-border)] p-10 text-center">
      <ShieldCheck size={32} className="mx-auto mb-3 text-rose-500" />
      <h2 className="font-display text-xl font-bold mb-1">Akses ditolak</h2>
      <p className="text-sm text-[var(--ms-text-muted)]">Halaman Settings hanya untuk admin.</p>
    </div>
  );
  if (loading) return <div className="text-center py-10 text-[var(--ms-text-muted)]">Memuat...</div>;

  const inp = "w-full px-3.5 py-2.5 rounded-xl border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)] focus:ring-2 focus:ring-[var(--ms-primary)]/20 transition-base";
  const lbl = "block text-[0.7rem] uppercase tracking-wider font-bold text-[var(--ms-primary)] mb-1.5 font-mono";

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[var(--ms-primary-soft)] flex items-center justify-center" style={{ color: "var(--ms-primary)" }}><SettingsIcon size={20} /></div>
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Settings</h1>
          <p className="text-[var(--ms-text-muted)] text-sm mt-0.5">Akses tim & reminder Telegram</p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-[var(--ms-border)] p-6">
        <div className="flex items-center gap-2.5 mb-1"><Mail size={16} style={{ color: "var(--ms-primary)" }} /><h2 className="font-display text-xl font-bold">Whitelist Email Google</h2></div>
        <p className="text-sm text-[var(--ms-text-muted)] mb-4">Hanya email di daftar ini yang boleh login (admin selalu boleh). Kosongkan = semua boleh.</p>
        <div className="flex gap-2 mb-3">
          <input className={inp} placeholder="email@contoh.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmail()} data-testid="new-email-input" />
          <button onClick={addEmail} className="flex items-center gap-1.5 px-4 rounded-xl text-white text-sm font-semibold transition-base hover:opacity-90 whitespace-nowrap" style={{ background: "var(--ms-primary)" }} data-testid="add-email-btn"><Plus size={14} /> Tambah</button>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="email-list">
          {settings.allowed_emails.length === 0 && <p className="text-xs text-[var(--ms-text-muted)] italic">Kosong — semua boleh login.</p>}
          {settings.allowed_emails.map((e) => (
            <span key={e} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-mono" style={{ background: "var(--ms-primary-soft)", color: "var(--ms-primary)" }}>{e}<button onClick={() => removeEmail(e)} className="hover:text-rose-600"><X size={12} /></button></span>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-[var(--ms-border)] p-6">
        <div className="flex items-center gap-2.5 mb-3"><Users size={16} style={{ color: "var(--ms-primary)" }} /><h2 className="font-display text-xl font-bold">Tim yang Sudah Login</h2></div>
        <div className="space-y-2" data-testid="users-list">
          {users.map((u) => (
            <div key={u.user_id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--ms-bg)] border border-[var(--ms-border)]">
              {u.picture ? <img src={u.picture} alt="" className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 rounded-full bg-[var(--ms-primary-soft)] flex items-center justify-center font-bold text-xs" style={{ color: "var(--ms-primary)" }}>{(u.name || u.email)[0].toUpperCase()}</div>}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{u.name || "—"}</div>
                <div className="text-xs text-[var(--ms-text-muted)] truncate font-mono">{u.email}</div>
              </div>
              <span className="text-[0.65rem] uppercase tracking-wider font-bold font-mono px-2 py-0.5 rounded-full" style={{ background: u.role === "admin" ? "#dcfce7" : "var(--ms-primary-soft)", color: u.role === "admin" ? "#15803d" : "var(--ms-primary)" }}>{u.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-[var(--ms-border)] p-6">
        <div className="flex items-center gap-2.5 mb-1"><Bell size={16} style={{ color: "var(--ms-primary)" }} /><h2 className="font-display text-xl font-bold">Telegram Reminder</h2></div>
        <p className="text-sm text-[var(--ms-text-muted)] mb-5">Otomatis kirim reminder di <strong>3 hari, 2 hari, 1 hari, dan 6 jam</strong> sebelum deadline. Bot API Telegram.</p>
        <div className="space-y-4">
          <div>
            <label className={lbl}>Bot Token</label>
            <input className={inp} placeholder="123:AAA..." value={settings.telegram_bot_token} onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })} data-testid="telegram-token-input" />
            <p className="text-xs text-[var(--ms-text-muted)] mt-1.5">Dari <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--ms-primary)" }}>@BotFather</a></p>
          </div>
          <div>
            <label className={lbl}>Chat ID</label>
            <input className={inp} placeholder="1415837440" value={settings.telegram_chat_id} onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })} data-testid="telegram-chatid-input" />
            <p className="text-xs text-[var(--ms-text-muted)] mt-1.5">ID chat personal/grup yang akan terima reminder.</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-[var(--ms-bg)] border border-[var(--ms-border)]">
            <input type="checkbox" checked={settings.reminders_enabled} onChange={(e) => setSettings({ ...settings, reminders_enabled: e.target.checked })} className="w-4 h-4 accent-[var(--ms-primary)]" data-testid="reminders-enabled-toggle" />
            <span className="text-sm font-medium">Aktifkan reminder otomatis</span>
          </label>
          <button onClick={testTelegram} disabled={testing || !settings.telegram_bot_token || !settings.telegram_chat_id} className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--ms-border)] text-sm font-semibold hover:bg-[var(--ms-bg)] disabled:opacity-50 transition-base" data-testid="test-telegram-btn">
            <TestTube size={14} /> {testing ? "Mengirim..." : "Kirim Pesan Test"}
          </button>
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold shadow-lg transition-base hover:opacity-90 disabled:opacity-60" style={{ background: "var(--ms-primary)" }} data-testid="save-settings-btn">
          <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Settings"}
        </button>
      </div>
    </div>
  );
}
