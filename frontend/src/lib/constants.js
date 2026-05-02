export const JENIS_OPTIONS = ["Modeling", "Rigging", "Animation", "Texturing", "Full Pipeline", "Revisi"];

export const STATUS_OPTIONS = [
  "need designer", "modeling", "teksturing", "cut&key", "waiting file",
  "articulate", "revisi", "rigging", "pending", "ready to send",
  "rendering", "coloring 3D Print", "animation", "waiting feedback",
  "delivered", "done", "cancel"
];

export const DONE_STATUSES = new Set(["done", "delivered", "cancel"]);

export const PLATFORM_OPTIONS = [
  "Fiverr Magsika",
  "Fiverr Eirene",
  "Etsy Lolicharm",
  "Direct",
  "Komunitas",
];

export const PLATFORM_CODES = {
  "Fiverr Magsika": "MGSIKA",
  "Fiverr Eirene": "EIRENE",
  "Etsy Lolicharm": "LLCHRM",
  "Direct": "DIRECT",
  "Komunitas": "LTK",
};

export const MARKETER_OPTIONS = ["Ivo", "Novita"];

export const JENIS_COLORS = {
  Modeling: { bg: "#efeaff", text: "#5a3de8" },
  Rigging: { bg: "#fef3c7", text: "#92400e" },
  Animation: { bg: "#fce7f3", text: "#be185d" },
  Texturing: { bg: "#cffafe", text: "#0e7490" },
  "Full Pipeline": { bg: "#dbeafe", text: "#1d4ed8" },
  Revisi: { bg: "#ffe4e6", text: "#be123c" },
};

// Status color palette — grouped by workflow stage
export const STATUS_COLORS = {
  "need designer": { bg: "#fee2e2", text: "#b91c1c" },
  "modeling": { bg: "#efeaff", text: "#5a3de8" },
  "teksturing": { bg: "#cffafe", text: "#0e7490" },
  "cut&key": { bg: "#fef3c7", text: "#92400e" },
  "waiting file": { bg: "#e0e7ff", text: "#3730a3" },
  "articulate": { bg: "#ede9fe", text: "#6d28d9" },
  "revisi": { bg: "#ffe4e6", text: "#be123c" },
  "rigging": { bg: "#fef3c7", text: "#92400e" },
  "pending": { bg: "#f3f4f6", text: "#4b5563" },
  "ready to send": { bg: "#dbeafe", text: "#1d4ed8" },
  "rendering": { bg: "#dbeafe", text: "#1d4ed8" },
  "coloring 3D Print": { bg: "#fce7f3", text: "#be185d" },
  "animation": { bg: "#fce7f3", text: "#be185d" },
  "waiting feedback": { bg: "#fef9c3", text: "#854d0e" },
  "delivered": { bg: "#dcfce7", text: "#15803d" },
  "done": { bg: "#dcfce7", text: "#15803d" },
  "cancel": { bg: "#fecaca", text: "#7f1d1d" },
};

export const PLATFORM_COLORS = {
  "Fiverr Magsika": "#10b981",
  "Fiverr Eirene": "#0ea5e9",
  "Etsy Lolicharm": "#f97316",
  "Direct": "#6d4cff",
  "Komunitas": "#ec4899",
};

export const MARKETER_COLORS = {
  "Ivo": "#06b6d4",
  "Novita": "#ec4899",
};

export const ARTIST_COLORS = {
  Budi: "#6d4cff",
  Sari: "#06b6d4",
  Joko: "#16a34a",
  Default: "#94a3b8",
};
