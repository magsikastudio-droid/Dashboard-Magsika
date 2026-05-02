export const fmtRp = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "Rp0";
  return "Rp" + Number(n).toLocaleString("id-ID");
};

export const fmtRpShort = (n) => {
  if (!n) return "Rp0";
  if (n >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`;
  return `Rp${n}`;
};

export const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

export const isLate = (deadlineIso, status) => {
  if (status === "Done") return false;
  if (!deadlineIso) return false;
  return new Date(deadlineIso) < new Date(new Date().toDateString());
};

export const monthKey = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
};
