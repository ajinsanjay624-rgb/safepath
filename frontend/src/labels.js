export const TAG_LABEL = {
  lit: "Well lit", crowded: "Busy with people", cctv: "CCTV", police_nearby: "Police nearby", shops_open: "Shops open",
  dark: "Dark", isolated: "Isolated", harassment: "Harassment reported", no_footpath: "No footpath", drunk_crowd: "Drunk crowds",
};
export const TAG_ICON = { lit: "💡", crowded: "👥", cctv: "📹", police_nearby: "🚓", shops_open: "🏪", dark: "🌑", isolated: "🏚️", harassment: "⚠️", no_footpath: "🚧", drunk_crowd: "🍺" };
export const GOOD = ["lit", "crowded", "cctv", "police_nearby", "shops_open"];
export const BAD = ["dark", "isolated", "harassment", "no_footpath", "drunk_crowd"];
export const KIND = { police: "🚓", hospital: "🏥", pharmacy: "💊", shop: "🏪", cafe: "☕", other: "🛟" };

export const HELPLINES = [
  { n: "112", name: "Emergency", note: "Police, fire, ambulance", color: "#ef4444" },
  { n: "1091", name: "Women helpline", note: "Help for women in distress", color: "#db2777" },
  { n: "181", name: "Women in distress", note: "24x7 support and counselling", color: "#7c3aed" },
  { n: "100", name: "Police", note: "Local police control room", color: "#2563eb" },
  { n: "108", name: "Ambulance", note: "Medical emergency", color: "#059669" },
  { n: "1930", name: "Cyber crime", note: "Online harassment or fraud", color: "#ea580c" },
];
export const TIPS = [
  ["Before you leave", "Share your live location with someone you trust and check the route's night score first. Keep your phone charged above 30%."],
  ["On the road", "Stay on lit, busy streets even if they are slightly longer. Keep one ear free and walk facing oncoming traffic."],
  ["In a cab", "Check the number plate against the app, sit behind the driver's seat if you can, and share the trip with a contact."],
  ["If you feel followed", "Cross the road, head to a shop, police booth or crowd. Use the Fake call and Siren tools, then press SOS if you need to."],
  ["After the trip", "Rate the streets you used. Your day and night ratings help the next woman choose better."],
];

export const nowPeriod = () => { const h = new Date().getHours(); return h >= 19 || h < 6 ? "night" : "day"; };
export const mapsLink = (lat, lng) => `https://maps.google.com/?q=${lat},${lng}`;
export const dirLink = (a, b, mode) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=${mode === "cab" ? "driving" : "walking"}`;
export const scoreColor = (s) => (s >= 3.8 ? "#10b981" : s >= 2.8 ? "#f59e0b" : "#f43f5e");
export const labelColor = (l) => (l === "Safer" ? "#10b981" : l === "Moderate" ? "#f59e0b" : "#f43f5e");
export const avgLabel = (s) => (s >= 3.8 ? "Safer" : s >= 2.8 ? "Moderate" : "Risky");

// Ratings and names come from other users, so anything put into map popups is escaped first.
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function timeAgo(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
export const fmtClock = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; };
export const fmtDur = (sec) => { const m = Math.round(sec / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

// ---- geometry ----
export function dist([a, b], [c, d]) {
  const r = Math.PI / 180, p1 = a * r, p2 = c * r;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((d - b) * r) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}
// Colour the route stretch by stretch: green = rated safe, amber = okay, red = risky, grey = nobody has rated it.
export function segmentsFor(coords, profile, step = 100) {
  if (!profile?.length) return [{ coords, color: "#7c3aed" }];
  const out = []; let cum = 0, cur = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = dist(coords[i], coords[i + 1]);
    const k = Math.min(profile.length - 1, Math.round((cum + d / 2) / step));
    cum += d;
    const [s, unrated] = profile[k];
    const color = unrated ? "#94a3b8" : scoreColor(s);
    if (cur && cur.color === color) cur.coords.push(coords[i + 1]);
    else { cur = { color, coords: [coords[i], coords[i + 1]] }; out.push(cur); }
  }
  return out;
}
