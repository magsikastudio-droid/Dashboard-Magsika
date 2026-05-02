export const JENIS_OPTIONS = [
  "Modeling", "Print", "Roblox", "Game Asset", "Vroid",
  "Mask", "Rigging", "Paid Consultation", "Animation", "AR Vtuber"
];

export const STATUS_OPTIONS = [
  "Need Designer", "Modeling", "Teksturing", "Cut & Key", "Waiting File",
  "Articulate", "Revisi", "Rigging", "Pending", "Ready to Send",
  "Rendering", "Coloring 3D Print", "Animation", "Waiting Feedback",
  "Delivered", "Done", "Cancel"
];

export const DONE_STATUSES = new Set(["done", "delivered", "cancel"]);

export const PLATFORM_OPTIONS = ["Fiverr Magsika", "Fiverr Eirene", "Etsy Lolicharm", "Direct", "Komunitas"];
export const PLATFORM_CODES = {
  "Fiverr Magsika": "MGSIKA", "Fiverr Eirene": "EIRENE", "Etsy Lolicharm": "LLCHRM",
  "Direct": "DIRECT", "Komunitas": "LTK",
};
export const MARKETER_OPTIONS = ["Ivo", "Novita"];
export const ARTIST_STATUS_OPTIONS = ["Tim", "Freelance"];

export const JENIS_COLORS = {
  Modeling: { bg: "#efeaff", text: "#5a3de8" },
  Print: { bg: "#fef3c7", text: "#92400e" },
  Roblox: { bg: "#dcfce7", text: "#15803d" },
  "Game Asset": { bg: "#dbeafe", text: "#1d4ed8" },
  Vroid: { bg: "#cffafe", text: "#0e7490" },
  Mask: { bg: "#ffe4e6", text: "#be123c" },
  Rigging: { bg: "#fef3c7", text: "#92400e" },
  "Paid Consultation": { bg: "#f3e8ff", text: "#7e22ce" },
  Animation: { bg: "#fce7f3", text: "#be185d" },
  "AR Vtuber": { bg: "#e0e7ff", text: "#3730a3" },
};

const norm = (s) => (s || "").toLowerCase().trim();

const _statusColors = {
  "need designer": { bg: "#fee2e2", text: "#b91c1c" },
  "modeling": { bg: "#efeaff", text: "#5a3de8" },
  "teksturing": { bg: "#cffafe", text: "#0e7490" },
  "cut & key": { bg: "#fef3c7", text: "#92400e" },
  "waiting file": { bg: "#e0e7ff", text: "#3730a3" },
  "articulate": { bg: "#ede9fe", text: "#6d28d9" },
  "revisi": { bg: "#ffe4e6", text: "#be123c" },
  "rigging": { bg: "#fef3c7", text: "#92400e" },
  "pending": { bg: "#f3f4f6", text: "#4b5563" },
  "ready to send": { bg: "#dbeafe", text: "#1d4ed8" },
  "rendering": { bg: "#dbeafe", text: "#1d4ed8" },
  "coloring 3d print": { bg: "#fce7f3", text: "#be185d" },
  "animation": { bg: "#fce7f3", text: "#be185d" },
  "waiting feedback": { bg: "#fef9c3", text: "#854d0e" },
  "delivered": { bg: "#dcfce7", text: "#15803d" },
  "done": { bg: "#dcfce7", text: "#15803d" },
  "cancel": { bg: "#fecaca", text: "#7f1d1d" },
};
export const statusColor = (s) => _statusColors[norm(s)] || _statusColors.modeling;
export const STATUS_COLORS = _statusColors;

export const PLATFORM_COLORS = {
  "Fiverr Magsika": "#10b981", "Fiverr Eirene": "#0ea5e9", "Etsy Lolicharm": "#f97316",
  "Direct": "#6d4cff", "Komunitas": "#ec4899",
};
export const MARKETER_COLORS = { "Ivo": "#06b6d4", "Novita": "#ec4899" };
export const ARTIST_COLORS = { Budi: "#6d4cff", Sari: "#06b6d4", Joko: "#16a34a", Default: "#94a3b8" };
