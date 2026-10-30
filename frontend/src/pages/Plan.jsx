import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Car, ChevronRight, Clock, Copy, Crown, ExternalLink, Footprints, Loader2, Moon, Navigation, Radio, Sparkles, Sun, Zap } from "lucide-react";
import { api } from "../api";
import MapView from "../MapView.jsx";
import PlaceInput from "../PlaceInput.jsx";
import { KIND, TAG_ICON, TAG_LABEL, dirLink, esc, fmtDur, labelColor, nowPeriod, scoreColor, segmentsFor } from "../labels.js";
import { useToast } from "../ui.jsx";

const OSRM = {
  walk: "https://routing.openstreetmap.de/routed-foot/route/v1/foot/",
  cab: "https://routing.openstreetmap.de/routed-car/route/v1/driving/",
};
const thin = (c) => { const k = Math.ceil(c.length / 400); return c.filter((_, i) => i % k === 0 || i === c.length - 1); };
const readRecent = () => { try { return JSON.parse(localStorage.getItem("recent")) || []; } catch { return []; } };
const short = (p) => p.name.split(",")[0];

export default function Plan({ token, loc, startTrip }) {
  const toast = useToast();
  const [from, setFrom] = useState(null), [to, setTo] = useState(null), [pick, setPick] = useState(null);
  const [mode, setMode] = useState("auto"), [travel, setTravel] = useState("walk");
  const [routes, setRoutes] = useState([]), [sel, setSel] = useState(0), [best, setBest] = useState(0);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [showR, setShowR] = useState(false), [showS, setShowS] = useState(true), [showH, setShowH] = useState(true);
  const [ratings, setRatings] = useState([]), [spots, setSpots] = useState([]);
  const [recent, setRecent] = useState(readRecent);
  const period = mode === "auto" ? nowPeriod() : mode;
  const focus = from || loc;
  const first = useRef(true);

  useEffect(() => {
    const q = `lat=${focus.lat}&lng=${focus.lng}&radius=6000`;
    api(`/ratings/?${q}&period=${period}`).then(setRatings).catch(() => {});
    api(`/spots/?${q}`).then(setSpots).catch(() => {});
  }, [focus.lat, focus.lng, period]);

  async function find(a = from, b = to, t = travel) {
    if (!a || !b) return setErr("Choose where you are starting and where you are going.");
    setBusy(true); setErr(""); setRoutes([]);
    try {
      const res = await fetch(`${OSRM[t]}${a.lng},${a.lat};${b.lng},${b.lat}?alternatives=true&overview=full&geometries=geojson`);
      const j = await res.json();
      if (!j.routes?.length) throw new Error("No route found between these two places.");
      const cand = j.routes.map((r) => ({ coords: thin(r.geometry.coordinates.map(([x, y]) => [y, x])), distance: r.distance, duration: r.duration }));
      const other = period === "night" ? "day" : "night";
      const call = (p) => api("/routes/score/", { method: "POST", body: { routes: cand, period: p } });
      const [s, o] = await Promise.all([call(period), call(other).catch(() => null)]);
      const fastest = Math.min(...cand.map((c) => c.duration));
      setRoutes(s.routes.map((r, i) => ({ ...r, coords: cand[i].coords, segments: segmentsFor(cand[i].coords, r.profile), fastest: cand[i].duration === fastest, alt: o ? o.routes[i].safety : null, altPeriod: other })));
      setSel(s.best); setBest(s.best);
      const next = [{ from: a, to: b, travel: t }, ...recent.filter((x) => !(x.from.name === a.name && x.to.name === b.name))].slice(0, 4);
      setRecent(next); localStorage.setItem("recent", JSON.stringify(next));
    } catch (e) {
      setErr(e instanceof TypeError ? "Could not reach the routing service. Check your internet connection and try again." : e.message);
    }
    setBusy(false);
  }

  // switching Day / Night re-scores the routes you are looking at
  useEffect(() => { if (first.current) { first.current = false; return; } if (routes.length) find(); }, [period]);

  const swap = () => { setFrom(to); setTo(from); setRoutes([]); };
  const useRecent = (x) => { setFrom(x.from); setTo(x.to); setTravel(x.travel); find(x.from, x.to, x.travel); };

  const onMap = pick ? (p) => {
    const v = { name: `${p[0].toFixed(4)}, ${p[1].toFixed(4)}`, lat: p[0], lng: p[1] };
    pick === "from" ? setFrom(v) : setTo(v);
    setPick(null);
  } : undefined;

  const mapRoutes = useMemo(() => routes.map((r, i) => ({ coords: r.coords, segments: r.segments, color: i === best ? "#10b981" : "#8b5cf6", active: i === sel, onSelect: () => setSel(i) }))
    .sort((a, b) => a.active - b.active), [routes, sel, best]);
  const heat = useMemo(() => (showH ? ratings.map((r) => ({ pos: [r.lat, r.lng], color: scoreColor(r.score), r: 280 })) : []), [ratings, showH]);
  const circles = useMemo(() => (showR ? ratings.map((r) => ({
    pos: [r.lat, r.lng], color: scoreColor(r.score),
    popup: `<b>${esc(r.street)}</b><br/>${esc(r.period)} · ${r.score}/5<br/>${r.tags.map((t) => esc(TAG_LABEL[t])).join(", ")}` })) : []), [ratings, showR]);
  const markers = useMemo(() => [
    ...(showS ? spots.map((s) => ({ pos: [s.lat, s.lng], icon: KIND[s.kind], color: "#0ea5e9", popup: `<b>${esc(s.name)}</b><br/>${s.open_24h ? "Open 24 hours" : "Not 24 hours"}${s.phone ? "<br/>📞 " + esc(s.phone) : ""}` })) : []),
    ...(from ? [{ pos: [from.lat, from.lng], icon: "A", color: "#7c3aed", popup: "Start" }] : []),
    ...(to ? [{ pos: [to.lat, to.lng], icon: "B", color: "#db2777", popup: "Destination" }] : []),
    ...(routes[sel] ? [{ pos: [routes[sel].weakest.lat, routes[sel].weakest.lng], icon: "⚠️", color: "#f59e0b", popup: `Lowest-rated stretch (${routes[sel].weakest.score}/5). Take extra care here.` }] : []),
  ], [spots, showS, from, to, routes, sel]);
  const fitTo = useMemo(() => {
    const c = routes[sel]?.coords || (from && to ? [[from.lat, from.lng], [to.lat, to.lng]] : null);
    if (!c) return undefined;
    const la = c.map((p) => p[0]), ln = c.map((p) => p[1]);
    return [[Math.min(...la), Math.min(...ln)], [Math.max(...la), Math.max(...ln)]];
  }, [routes, sel, from, to]);

  const order = routes.map((_, i) => i).sort((a, b) => routes[b].safety - routes[a].safety);
  const fastestIdx = routes.findIndex((r) => r.fastest);
  const cur = routes[sel];
  const tradeoff = routes.length > 1 ? (best === fastestIdx ? "The fastest route is also the safest one." :
    `The safest route scores ${routes[best].safety - routes[fastestIdx].safety} points higher than the fastest and takes ${Math.max(0, Math.round((routes[best].duration - routes[fastestIdx].duration) / 60))} min longer.`) : null;

  const summary = () => cur && `SafePath: ${from.name} to ${to.name} (${travel === "walk" ? "walking" : "cab"}). ${period} safety score ${cur.safety}/100 (${cur.label}), ${(cur.distance / 1000).toFixed(1)} km, ${fmtDur(cur.duration)}.`;
  const copy = () => navigator.clipboard?.writeText(summary()).then(() => toast("Route summary copied"), () => toast("Could not copy", "err"));

  return (
    <div className="split">
      <MapView className="tall" center={[focus.lat, focus.lng]} me={[loc.lat, loc.lng]} routes={mapRoutes} markers={markers} circles={circles} heat={heat} fitTo={fitTo} onClick={onMap} picking={!!pick}>
        {routes.length > 0 && (
          <div className="legend" aria-label="Route colour key">
            <span><i style={{ background: "#10b981" }} />Safe</span><span><i style={{ background: "#f59e0b" }} />Okay</span><span><i style={{ background: "#f43f5e" }} />Risky</span><span><i style={{ background: "#94a3b8" }} />No ratings</span>
          </div>
        )}
        {pick && <div className="map-hint">Tap the map to set the {pick === "from" ? "start" : "destination"}</div>}
      </MapView>

      <div className="panel">
        <div className="seg" role="group" aria-label="Time of day">
          {[["auto", null, `Now (${period})`], ["day", Sun, "Day"], ["night", Moon, "Night"]].map(([k, Icon, l]) => (
            <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{Icon && <Icon size={16} />}{l}</button>
          ))}
        </div>
        <p className="hint">{period === "night" ? "Night scores use ratings from after 7 pm and only count safe spots that are open at night." : "Day scores use daytime ratings."}</p>

        <div className="places">
          <PlaceInput label="Start" dot="#7c3aed" value={from} loc={loc} onPick={(p) => { setFrom(p); setRoutes([]); }} onMap={() => setPick(pick === "from" ? null : "from")} picking={pick === "from"} />
          <button type="button" className="swap" aria-label="Swap start and destination" onClick={swap}><ArrowUpDown size={16} /></button>
          <PlaceInput label="Destination" dot="#db2777" value={to} loc={loc} onPick={(p) => { setTo(p); setRoutes([]); }} onMap={() => setPick(pick === "to" ? null : "to")} picking={pick === "to"} />
        </div>

        <div className="seg" role="group" aria-label="Travel mode">
          <button aria-pressed={travel === "walk"} onClick={() => { setTravel("walk"); setRoutes([]); }}><Footprints size={16} /> Walk</button>
          <button aria-pressed={travel === "cab"} onClick={() => { setTravel("cab"); setRoutes([]); }}><Car size={16} /> Cab / car</button>
        </div>
        <button className="btn full" onClick={() => find()} disabled={busy}>{busy ? <><Loader2 size={18} className="spin" /> Checking routes…</> : <><Sparkles size={18} /> Find safer routes</>}</button>
        {err && <p className="msg err" role="alert">{err}</p>}

        {!routes.length && recent.length > 0 && (
          <div className="recent"><small>Recent trips</small>
            {recent.map((x, i) => <button key={i} className="chip" onClick={() => useRecent(x)}><Clock size={13} /> {short(x.from)} <ChevronRight size={13} /> {short(x.to)}</button>)}
          </div>
        )}

        <div className="layers">
          <label className="switch"><input type="checkbox" checked={showH} onChange={(e) => setShowH(e.target.checked)} /><span /> Heatmap</label>
          <label className="switch"><input type="checkbox" checked={showR} onChange={(e) => setShowR(e.target.checked)} /><span /> Ratings</label>
          <label className="switch"><input type="checkbox" checked={showS} onChange={(e) => setShowS(e.target.checked)} /><span /> Safe spots</label>
        </div>

        {tradeoff && <p className="msg info"><Zap size={16} /> {tradeoff}</p>}

        {order.map((i, n) => {
          const r = routes[i], c = labelColor(r.label);
          return (
            <button key={i} className={"route" + (i === sel ? " on" : "")} aria-pressed={i === sel} onClick={() => setSel(i)}>
              <div className="row">
                <div className="rt-head">
                  <div className="ring sm" style={{ "--p": r.safety, "--c": c }}><b>{r.safety}</b></div>
                  <div>
                    <strong>{i === best ? <><Crown size={15} className="crown" /> Safest route</> : `Option ${n + 1}`}</strong>
                    <div className="hint">{(r.distance / 1000).toFixed(1)} km · {fmtDur(r.duration)}</div>
                  </div>
                </div>
                <div className="tagcol">
                  <span className="tag" style={{ background: c + "26", color: c }}>{r.label}</span>
                  {r.fastest && <span className="tag fast"><Zap size={12} /> Fastest</span>}
                </div>
              </div>
              <div className="strip" aria-hidden="true">{(r.profile || []).map(([s, un], k) => <i key={k} style={{ background: un ? "#94a3b8" : scoreColor(s) }} />)}</div>
              {r.alt != null && <p className="why alt-line">{r.altPeriod === "night" ? <Moon size={13} /> : <Sun size={13} />} {r.altPeriod === "night" ? "At night" : "In the day"} this route scores <b style={{ color: labelColor(r.alt >= 70 ? "Safer" : r.alt >= 45 ? "Moderate" : "Risky") }}>{r.alt}</b>{r.alt < r.safety - 8 ? " (noticeably lower)" : ""}</p>}
              <div className="tagrow">
                {r.positives.map(([t, k]) => <span key={t} className="tag good">{TAG_ICON[t]} {TAG_LABEL[t]} ({k})</span>)}
                {r.negatives.map(([t, k]) => <span key={t} className="tag bad">{TAG_ICON[t]} {TAG_LABEL[t]} ({k})</span>)}
              </div>
              <p className="why">{r.unrated_pct}% of this route has no ratings yet · {r.spots_near} safe spot{r.spots_near === 1 ? "" : "s"} close by</p>
            </button>
          );
        })}

        {cur && (
          <div className="actions">
            {token && <button className="btn good grow" onClick={() => startTrip({ minutes: Math.ceil(cur.duration / 60) + 10, label: `${short(from)} to ${short(to)}`, share: true })}><Radio size={18} /> Start trip and share live</button>}
            <a className="btn alt" href={dirLink(from, to, travel)} target="_blank" rel="noreferrer"><Navigation size={18} /> Navigate <ExternalLink size={14} /></a>
            <button className="btn alt" onClick={copy}><Copy size={18} /> Copy</button>
          </div>
        )}
        {cur && !token && <p className="hint">Log in to start a trip with live location sharing and a safe-arrival timer.</p>}
      </div>
    </div>
  );
}
