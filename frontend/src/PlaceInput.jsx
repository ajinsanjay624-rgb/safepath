import { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";

// Search a place as you type (OpenStreetMap Nominatim), use my location, or pick on the map.
export default function PlaceInput({ label, dot, value, loc, onPick, onMap, picking }) {
  const [q, setQ] = useState(value?.name || "");
  const [opts, setOpts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [none, setNone] = useState(false);
  const typed = useRef(false);

  useEffect(() => { setQ(value?.name || ""); typed.current = false; }, [value?.name]);

  async function run(text, signal) {
    setBusy(true); setNone(false);
    try {
      const v = `&viewbox=${loc.lng - 0.4},${loc.lat + 0.4},${loc.lng + 0.4},${loc.lat - 0.4}`;
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=5" + v + "&q=" + encodeURIComponent(text), { signal });
      const list = (await r.json()).map((x) => ({ name: x.display_name.split(",").slice(0, 3).join(","), lat: +x.lat, lng: +x.lon }));
      setOpts(list); setNone(list.length === 0);
    } catch (e) { if (e.name !== "AbortError") { setOpts([]); setNone(true); } }
    setBusy(false);
  }

  // search automatically 0.6 s after typing stops (keeps us within the free service's usage limits)
  useEffect(() => {
    if (!typed.current) return;
    if (q.trim().length < 3) { setOpts([]); setNone(false); return; }
    const ctl = new AbortController();
    const id = setTimeout(() => run(q, ctl.signal), 600);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [q]);

  const choose = (o) => { onPick(o); setOpts([]); setNone(false); };
  const clear = () => { typed.current = false; setQ(""); setOpts([]); onPick(null); };

  return (
    <div className="place" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setOpts([]); setNone(false); } }}>
      <div className="place-row">
        <span className="dot" style={{ background: dot }} aria-hidden="true" />
        <input aria-label={label} placeholder={label} value={q} autoComplete="off"
          onChange={(e) => { typed.current = true; setQ(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (q.trim().length >= 3) run(q); } }} />
        {busy ? <Loader2 size={18} className="spin muted-ic" /> : q ? <button type="button" className="icon-btn" aria-label={"Clear " + label} onClick={clear}><X size={18} /></button> : <Search size={18} className="muted-ic" />}
        <button type="button" className="sq" title="Use my location" aria-label="Use my location" onClick={() => choose({ name: "My location", lat: loc.lat, lng: loc.lng })}><Crosshair size={18} /></button>
        <button type="button" className={"sq" + (picking ? " on" : "")} title="Pick on the map" aria-label="Pick on the map" aria-pressed={!!picking} onClick={onMap}><MapPin size={18} /></button>
      </div>
      {(opts.length > 0 || none) && (
        <ul className="opts">
          {opts.map((o, i) => <li key={i}><button type="button" onClick={() => choose(o)}><MapPin size={14} /> {o.name}</button></li>)}
          {none && <li className="hint pad">No places found. Try a landmark or area name.</li>}
        </ul>
      )}
    </div>
  );
}
