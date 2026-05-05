import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings as SettingsIcon, Save, Plus, X, Mail, Bell, ShieldCheck, Users, TestTube, MessageSquare, RotateCcw, Check, Ban, Trash2, UserPlus, Lock } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const DEFAULT_TG_TEMPLATES = {
  new: "🆕 ORDER BARU MASUK\n\n📁 Project   : {project}\n👤 Client    : {klien}\n📂 Folder    : {folder_code}\n📅 Deadline  : {deadline}\n🚀 Silakan segera diproses.",
  reminder: "⏰ REMINDER DEADLINE\n\n📁 Project   : {project}\n👤 Client    : {klien}\n📂 Folder    : {folder_code}\n📅 Deadline  : {deadline}\n⚠️ Deadline sudah semakin dekat, segera diselesaikan.",
  warning: "❗ WARNING DEADLINE H-1\n\n📁 Project   : {project}\n👤 Client    : {klien}\n📂 Folder    : {folder_code}\n📅 Deadline  : {deadline}\n🚨 Deadline BESOK! Pastikan selesai tepat waktu!",
  custom: "⏳ REMINDER DEADLINE\n\n📁 Project   : {project}\n👤 Client    : {klien}\n📂 Folder    : {folder_code}\n📅 Deadline  : {deadline}\n⚠️ Deadline tersisa {days_left} hari lagi!",
};
const TG_LABELS = { new: "🆕 Order Baru", reminder: "⏰ Reminder <5 & <3 Hari", warning: "❗ Warning H-1", custom: "⏳ Manual Ping / Sisa Hari" };

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ allowed_emails: [], telegram_bot_token: "", telegram_chat_id: "", telegram_thread_id: "", reminders_enabled: true, telegram_templates: {}, dc_telegram_bot_token: "", dc_telegram_chat_id: "", dc_telegram_thread_id: "", dc_reminders_enabled: true, dc_template: "" });
  const [users, setUsers] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
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
      const payload = {
        ...settings,
        telegram_thread_id: settings.telegram_thread_id === "" || settings.telegram_thread_id === null ? null : Number(settings.telegram_thread_id),
        dc_telegram_thread_id: settings.dc_telegram_thread_id === "" || settings.dc_telegram_thread_id === null ? null : Number(settings.dc_telegram_thread_id),
      };
      const res = await api.put("/settings", payload);
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

  const refreshUsers = async () => {
    try { const r = await api.get("/users"); setUsers(r.data || []); } catch {}
  };

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

      <section className="bg-white rounded-2xl border border-[var(--ms-border)] p-6" data-testid="user-management-section">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2.5"><Users size={16} style={{ color: "var(--ms-primary)" }} /><h2 className="font-display text-xl font-bold">User Management</h2></div>
          <button onClick={() => setInviteOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-xs font-semibold hover:opacity-90" style={{ background: "var(--ms-primary)" }} data-testid="invite-user-btn"><Plus size={12} /> Invite User</button>
        </div>
        <p className="text-sm text-[var(--ms-text-muted)] mb-4">Kelola akses tim. User baru mendaftar status <strong>pending</strong> sampai disetujui. Admin bisa invite user langsung aktif.</p>
        <div className="space-y-2" data-testid="users-list">
          {users.length === 0 && <p className="text-xs text-[var(--ms-text-muted)] italic">Belum ada user.</p>}
          {users.map((u) => (
            <UserRow key={u.user_id} u={u} me={user} onChanged={refreshUsers} />
          ))}
        </div>
      </section>
      {inviteOpen && <InviteUserModal onClose={() => setInviteOpen(false)} onSaved={() => { setInviteOpen(false); refreshUsers(); }} />}

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
          <div>
            <label className={lbl}>Topic / Thread ID <span className="text-[var(--ms-text-muted)] font-normal normal-case">(opsional)</span></label>
            <input className={inp} type="number" placeholder="4689" value={settings.telegram_thread_id ?? ""} onChange={(e) => setSettings({ ...settings, telegram_thread_id: e.target.value === "" ? "" : Number(e.target.value) })} data-testid="telegram-threadid-input" />
            <p className="text-xs text-[var(--ms-text-muted)] mt-1.5"><code className="font-mono">message_thread_id</code> untuk mengarahkan pesan ke topic tertentu di grup forum. Kosongkan untuk kirim ke <strong>General</strong>.</p>
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

      {/* Template editor */}
      <section className="bg-white rounded-2xl border border-[var(--ms-border)] p-6" data-testid="telegram-templates-section">
        <div className="flex items-center gap-2.5 mb-1"><MessageSquare size={16} style={{ color: "var(--ms-primary)" }} /><h2 className="font-display text-xl font-bold">Template Pesan Telegram</h2></div>
        <p className="text-sm text-[var(--ms-text-muted)] mb-4">Edit format pesan yang dikirim. Variabel yang tersedia: <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{project}"}</code> <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{klien}"}</code> <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{folder_code}"}</code> <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{deadline}"}</code> <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{days_left}"}</code> (hanya untuk custom).</p>
        <div className="space-y-4" data-testid="tg-templates-editor">
          {Object.keys(DEFAULT_TG_TEMPLATES).map((k) => {
            const val = settings.telegram_templates?.[k] ?? DEFAULT_TG_TEMPLATES[k];
            const isCustom = (settings.telegram_templates?.[k] ?? "") !== "" && settings.telegram_templates?.[k] !== DEFAULT_TG_TEMPLATES[k];
            return (
              <div key={k}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={lbl + " mb-0"}>{TG_LABELS[k]}</label>
                  {isCustom && (
                    <button onClick={() => setSettings({ ...settings, telegram_templates: { ...settings.telegram_templates, [k]: DEFAULT_TG_TEMPLATES[k] } })} className="flex items-center gap-1 text-[0.68rem] font-semibold hover:underline" style={{ color: "var(--ms-primary)" }} data-testid={`reset-tg-${k}`}>
                      <RotateCcw size={10} /> Reset default
                    </button>
                  )}
                </div>
                <textarea
                  className={inp + " font-mono text-[0.8rem] leading-relaxed"}
                  rows={6}
                  value={val}
                  onChange={(e) => setSettings({ ...settings, telegram_templates: { ...settings.telegram_templates, [k]: e.target.value } })}
                  data-testid={`tg-template-${k}`}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Daily Chat Telegram config */}
      <section className="bg-white rounded-2xl border border-[var(--ms-border)] p-6" data-testid="dc-telegram-section">
        <div className="flex items-center gap-2.5 mb-1"><MessageSquare size={16} style={{ color: "var(--ms-primary)" }} /><h2 className="font-display text-xl font-bold">Daily Chat Telegram</h2></div>
        <p className="text-sm text-[var(--ms-text-muted)] mb-5">Reminder otomatis Daily Chat di <strong>09.00, 12.00, 15.00, 18.00, 21.00 WIB</strong> jika ada client status Follow Up / Discussing / Negotiating. Konfigurasi terpisah dari Telegram Reminder Deadline.</p>
        <div className="space-y-4">
          <div>
            <label className={lbl}>Bot Token</label>
            <input className={inp} placeholder="123:AAA..." value={settings.dc_telegram_bot_token} onChange={(e) => setSettings({ ...settings, dc_telegram_bot_token: e.target.value })} data-testid="dc-token-input" />
          </div>
          <div>
            <label className={lbl}>Chat ID</label>
            <input className={inp} placeholder="-1001234567890" value={settings.dc_telegram_chat_id} onChange={(e) => setSettings({ ...settings, dc_telegram_chat_id: e.target.value })} data-testid="dc-chatid-input" />
          </div>
          <div>
            <label className={lbl}>Topic / Thread ID <span className="text-[var(--ms-text-muted)] font-normal normal-case">(opsional)</span></label>
            <input className={inp} type="number" placeholder="4689" value={settings.dc_telegram_thread_id ?? ""} onChange={(e) => setSettings({ ...settings, dc_telegram_thread_id: e.target.value === "" ? "" : Number(e.target.value) })} data-testid="dc-threadid-input" />
            <p className="text-xs text-[var(--ms-text-muted)] mt-1.5">Kosongkan untuk kirim ke <strong>General</strong>.</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-[var(--ms-bg)] border border-[var(--ms-border)]">
            <input type="checkbox" checked={settings.dc_reminders_enabled} onChange={(e) => setSettings({ ...settings, dc_reminders_enabled: e.target.checked })} className="w-4 h-4 accent-[var(--ms-primary)]" data-testid="dc-reminders-enabled-toggle" />
            <span className="text-sm font-medium">Aktifkan reminder Daily Chat otomatis</span>
          </label>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={lbl + " mb-0"}>Template Pesan Reminder Daily Chat</label>
              <button onClick={() => setSettings({ ...settings, dc_template: "" })} className="flex items-center gap-1 text-[0.68rem] font-semibold hover:underline" style={{ color: "var(--ms-primary)" }} data-testid="dc-template-reset"><RotateCcw size={10} /> Reset default</button>
            </div>
            <textarea
              className={inp + " font-mono text-[0.8rem] leading-relaxed"}
              rows={8}
              value={settings.dc_template ?? ""}
              onChange={(e) => setSettings({ ...settings, dc_template: e.target.value })}
              placeholder={"🔔 Reminder Daily Chat\n{day}, {date} · {time} WIB\n\n{groups}\nTotal perlu ditindaklanjuti: {total} client"}
              data-testid="dc-template-input"
            />
            <p className="text-xs text-[var(--ms-text-muted)] mt-1.5">Variabel: <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{day}"}</code> <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{date}"}</code> <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{time}"}</code> <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{groups}"}</code> <code className="px-1.5 py-0.5 rounded bg-[var(--ms-bg)] text-[0.72rem] font-mono">{"{total}"}</code>. Kosongkan untuk pakai default.</p>
          </div>
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


const STATUS_META = {
  active: { label: "Aktif", bg: "bg-emerald-100", text: "text-emerald-700" },
  pending: { label: "Pending", bg: "bg-amber-100", text: "text-amber-700" },
  disabled: { label: "Disabled", bg: "bg-slate-200", text: "text-slate-600" },
};
const ROLE_BG = { admin: "#dcfce7:#15803d", pm: "#dbeafe:#1e40af", talent: "#fef3c7:#92400e" };
const roleStyle = (r) => { const [bg, t] = (ROLE_BG[r] || ROLE_BG.talent).split(":"); return { background: bg, color: t }; };

function UserRow({ u, me, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(u.name || "");
  const [role, setRole] = useState(u.role || "talent");
  const [pwd, setPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const status = u.status || "active";
  const meta = STATUS_META[status];

  const doPatch = async (payload, successMsg) => {
    setSaving(true);
    try { await api.patch(`/users/${u.user_id}`, payload); toast.success(successMsg); onChanged(); setEditing(false); setPwd(""); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
    finally { setSaving(false); }
  };
  const approve = () => doPatch({ status: "active" }, "Disetujui");
  const reject = () => doPatch({ status: "disabled" }, "Ditolak");
  const reactivate = () => doPatch({ status: "active" }, "Diaktifkan");
  const disable = () => doPatch({ status: "disabled" }, "Dinonaktifkan");
  const saveEdit = () => {
    const payload = { name, role };
    if (pwd.trim()) payload.password = pwd;
    doPatch(payload, "Tersimpan");
  };
  const remove = async () => {
    if (!window.confirm(`Hapus user ${u.email}?`)) return;
    try { await api.delete(`/users/${u.user_id}`); toast.success("Dihapus"); onChanged(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const inp = "w-full px-3 py-2 rounded-lg border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)]";
  const isSelf = u.user_id === me?.user_id;

  return (
    <div className="p-3 rounded-xl bg-[var(--ms-bg)] border border-[var(--ms-border)]" data-testid={`user-row-${u.email}`}>
      <div className="flex items-center gap-3 flex-wrap">
        {u.picture ? <img src={u.picture} alt="" className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 rounded-full bg-[var(--ms-primary-soft)] flex items-center justify-center font-bold text-xs" style={{ color: "var(--ms-primary)" }}>{(u.name || u.email)[0].toUpperCase()}</div>}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{u.name || "—"}{isSelf && <span className="ml-1 text-[0.6rem] font-mono text-[var(--ms-text-muted)]">(you)</span>}</div>
          <div className="text-xs text-[var(--ms-text-muted)] truncate font-mono">{u.email}</div>
        </div>
        <span className="text-[0.65rem] uppercase tracking-wider font-bold font-mono px-2 py-0.5 rounded-full" style={roleStyle(u.role)}>{u.role}</span>
        <span className={`text-[0.65rem] uppercase tracking-wider font-bold font-mono px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`} data-testid={`user-status-${u.email}`}>{meta.label}</span>
        <div className="flex gap-1">
          {status === "pending" && <>
            <button onClick={approve} disabled={saving} className="p-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50" title="Setujui" data-testid={`approve-${u.email}`}><Check size={12} /></button>
            <button onClick={reject} disabled={saving} className="p-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50" title="Tolak"><Ban size={12} /></button>
          </>}
          {status === "active" && !isSelf && <button onClick={disable} disabled={saving} className="p-1.5 rounded-lg border border-[var(--ms-border)] text-[var(--ms-text-muted)] hover:bg-white" title="Disable"><Ban size={12} /></button>}
          {status === "disabled" && <button onClick={reactivate} disabled={saving} className="p-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50" title="Aktifkan" data-testid={`reactivate-${u.email}`}><Check size={12} /></button>}
          <button onClick={() => setEditing(!editing)} className="p-1.5 rounded-lg border border-[var(--ms-border)] hover:bg-white" title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
          {!isSelf && <button onClick={remove} className="p-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50" title="Hapus" data-testid={`delete-${u.email}`}><Trash2 size={12} /></button>}
        </div>
      </div>
      {editing && (
        <div className="mt-3 pt-3 border-t border-[var(--ms-border)] grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className={inp} placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} data-testid={`edit-name-${u.email}`} />
          <select className={inp} value={role} onChange={(e) => setRole(e.target.value)} data-testid={`edit-role-${u.email}`}>
            <option value="admin">Admin</option>
            <option value="pm">PM</option>
            <option value="talent">Talent</option>
          </select>
          <input type="password" className={inp} placeholder="Password baru (opsional)" value={pwd} onChange={(e) => setPwd(e.target.value)} data-testid={`edit-pwd-${u.email}`} />
          <div className="sm:col-span-3 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-full border border-[var(--ms-border)] text-xs font-semibold">Batal</button>
            <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 rounded-full text-white text-xs font-semibold" style={{ background: "var(--ms-primary)" }} data-testid={`save-edit-${u.email}`}>{saving ? "..." : "Simpan"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InviteUserModal({ onClose, onSaved }) {
  const [f, setF] = useState({ email: "", password: "", name: "", role: "talent" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!f.email.includes("@") || f.password.length < 6) { toast.error("Email valid & password min 6 karakter"); return; }
    setSaving(true);
    try { await api.post("/auth/invite", { ...f, email: f.email.toLowerCase().trim() }); toast.success("User di-invite (langsung aktif)"); onSaved(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
    finally { setSaving(false); }
  };
  const inp = "w-full px-3 py-2 rounded-lg border border-[var(--ms-border)] bg-white text-sm focus:outline-none focus:border-[var(--ms-primary)]";
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="invite-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6 my-6 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-display text-xl font-bold flex items-center gap-2"><UserPlus size={18} /> Invite User</h3><button onClick={onClose} className="p-1 rounded hover:bg-[var(--ms-bg)]"><X size={16} /></button></div>
        <p className="text-xs text-[var(--ms-text-muted)]">User yang di-invite langsung <strong>aktif</strong> tanpa perlu approval. Share email + password ke user secara manual (via WA/DM).</p>
        <div>
          <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">Email</div>
          <input className={inp} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="user@example.com" data-testid="inv-email" />
        </div>
        <div>
          <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">Nama</div>
          <input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nama lengkap" data-testid="inv-name" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">Password awal (min 6)</div>
            <input type="text" className={inp} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="min 6 karakter" data-testid="inv-password" />
          </div>
          <div>
            <div className="text-[0.65rem] uppercase tracking-wider font-bold font-mono text-[var(--ms-text-muted)] mb-1">Role</div>
            <select className={inp} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} data-testid="inv-role">
              <option value="talent">Talent</option>
              <option value="pm">PM</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full border border-[var(--ms-border)] text-sm font-semibold">Batal</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-full text-white text-sm font-semibold" style={{ background: "var(--ms-primary)" }} data-testid="inv-submit">{saving ? "..." : "Invite"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
