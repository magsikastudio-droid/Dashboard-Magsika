export const fmtRp = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "Rp0";
  return "Rp" + Number(n).toLocaleString("id-ID");
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
  if (!deadlineIso) return false;
  const s = (status || "").toLowerCase();
  if (["done", "delivered", "cancel", "complete", "completed"].includes(s)) return false;
  return new Date(deadlineIso) < new Date(new Date().toDateString());
};

export const daysToDeadline = (deadlineIso) => {
  if (!deadlineIso) return null;
  const d = new Date(deadlineIso);
  d.setHours(23, 59, 59, 0);
  const now = new Date();
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
};

export const isDone = (status) => {
  const s = (status || "").toLowerCase();
  return ["done", "delivered", "cancel", "complete", "completed"].includes(s);
};

export const monthKey = (iso) => {
  if (!iso) return "";
  return iso.slice(0, 7); // YYYY-MM
};

export const monthLabel = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
};

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const isArchived = (order) => {
  // archived = status is done/delivered/cancel AND tanggal < current month
  const s = (order.status || "").toLowerCase();
  if (!["done", "delivered", "cancel"].includes(s)) return false;
  return monthKey(order.tanggal) < currentMonth();
};
