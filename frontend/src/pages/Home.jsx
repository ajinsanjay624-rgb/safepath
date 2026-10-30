import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock, MapPin, Moon, Navigation, PhoneCall, Radio, Route, ShieldAlert, Star, Sun, Users } from "lucide-react";
import { api } from "../api";
import { KIND, TAG_ICON, TAG_LABEL, avgLabel, labelColor, mapsLink, timeAgo } from "../labels.js";
import { Stars } from "../ui.jsx";

const ACTIONS = [
  ["plan", Route, "Plan a safe route", "Compare day and night scores", "g1"],
  ["add", Star, "Rate a street", "Help other women decide", "g2"],
  ["share", Radio, "Share live location", "A link family can open", "g3"],
  ["safety", PhoneCall, "Fake call and alarm", "Get out of awkward spots", "g4"],
];

export default function Home({ me, token, loc, locState, locate, period, go, openAuth }) {
  const [stats, setStats] = useState(null), [ratings, setRatings] = useState([]), [spots, setSpots] = useState([]);
  useEffect(() => {
    const q = `lat=${loc.lat}&lng=${loc.lng}`;
    api("/stats/").then(setStats).catch(() => {});
    api(`/ratings/?${q}&radius=8000`).then(setRatings).catch(() => {});
    api(`/spots/?${q}&radius=5000`).then((s) => setSpots(s.filter((x) => period === "day" || x.open_24h || ["police", "hospital"].includes(x.kind)).slice(0, 4))).catch(() => {});
  }, [loc.lat, loc.lng, period]);

  // "Your area right now": average of nearby ratings for the current time of day
  const pulse = useMemo(() => {
    const r = ratings.filter((x) => x.period === period);
    if (!r.length) return null;
    const avg = r.reduce((a, x) => a + x.score, 0) / r.length;
    const tags = {};
    r.forEach((x) => x.tags.forEach((t) => (tags[t] = (tags[t] || 0) + 1)));
    return { avg, n: r.length, tags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 4) };
  }, [ratings, period]);
  const label = pulse ? avgLabel(pulse.avg) : null, color = label ? labelColor(label) : "#94a3b8";
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-txt">
          <span className="pill">{period === "night" ? <Moon size={14} /> : <Sun size={14} />} {period === "night" ? "Night mode" : "Day mode"} · scores adapt to the time</span>
          <h1>{hello}{me?.name ? `, ${me.name}` : ""}</h1>
          <p>{period === "night" ? "It is after 7 pm. Prefer lit, busy streets and share your trip before you leave." : "Plan your way with a safety score built from real street ratings."}</p>
          <div className="actions">
            <button className="btn white" onClick={() => go("plan")}>Plan a route <ArrowRight size={18} /></button>
            {!token && <button className="btn glass" onClick={openAuth}>Log in</button>}
          </div>
          <p className="loc-line">
            <MapPin size={14} />
            {locState === "ok" ? "Using your current location" : locState === "pending" ? "Finding your location…" : "Showing Chennai. Location access is off."}
            {locState === "denied" && <button className="link light" onClick={locate}>Try again</button>}
          </p>
        </div>
        <div className="hero-art" aria-hidden="true"><i /><i /><i /></div>
      </section>

      <div className="grid2">
        <section className="card pulse-card">
          <h2>Your area right now</h2>
          {pulse ? (
            <div className="pulse-body">
              <div className="ring" style={{ "--p": (pulse.avg / 5) * 100, "--c": color }}><b>{pulse.avg.toFixed(1)}</b><small>/5</small></div>
              <div>
                <p className="big" style={{ color }}>{label}</p>
                <p className="hint">{pulse.n} {period} rating{pulse.n === 1 ? "" : "s"} within 8 km</p>
                <div className="tagrow">{pulse.tags.map(([t, c]) => <span key={t} className="tag soft">{TAG_ICON[t]} {TAG_LABEL[t]} · {c}</span>)}</div>
              </div>
            </div>
          ) : <p className="hint">No {period} ratings near you yet. Be the first to rate a street.</p>}
        </section>
        <section className="actions-grid" aria-label="Quick actions">
          {ACTIONS.map(([k, Icon, t, s, g]) => (
            <button key={k} className={"qa " + g} onClick={() => go(k)}><Icon size={26} /><strong>{t}</strong><small>{s}</small></button>
          ))}
        </section>
      </div>

      {stats && (
        <section className="stats">
          {[[stats.ratings, "Street ratings", Star], [stats.areas, "Streets covered", MapPin], [stats.spots, "Verified safe spots", ShieldAlert], [stats.contributors, "Contributors", Users]].map(([n, l, Icon]) => (
            <div key={l} className="stat"><Icon size={20} /><b>{n}</b><span>{l}</span></div>
          ))}
        </section>
      )}

      <div className="grid2">
        <section className="card">
          <h2>Recent ratings near you</h2>
          {ratings.length === 0 && <p className="hint">Nothing here yet.</p>}
          {ratings.slice(0, 6).map((r) => (
            <div key={r.id} className="row-item col">
              <div className="row"><strong>{r.street}</strong><span className="tag soft">{r.period === "night" ? <Moon size={12} /> : <Sun size={12} />} {r.period}</span></div>
              <div className="row"><Stars n={r.score} /><small className="hint"><Clock size={12} /> {timeAgo(r.created_at)}</small></div>
              {r.tags.length > 0 && <div className="tagrow">{r.tags.map((t) => <span key={t} className="tag soft">{TAG_ICON[t]} {TAG_LABEL[t]}</span>)}</div>}
            </div>
          ))}
          <button className="link" onClick={() => go("add")}>Add your rating</button>
        </section>
        <section className="card">
          <h2>Safe places close by</h2>
          {spots.length === 0 && <p className="hint">No verified safe spots nearby are open right now.</p>}
          {spots.map((s) => (
            <div key={s.id} className="row-item">
              <span className="kind">{KIND[s.kind]}</span>
              <span className="grow"><strong>{s.name}</strong><br /><small className="hint">{s.distance_m >= 1000 ? (s.distance_m / 1000).toFixed(1) + " km" : s.distance_m + " m"} · {s.open_24h ? "Open 24 hours" : "Daytime"}</small></span>
              <a className="btn sm alt" href={mapsLink(s.lat, s.lng)} target="_blank" rel="noreferrer"><Navigation size={16} /> Go</a>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
