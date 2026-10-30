import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Flag, Loader2, MapPin, Moon, Sun, Trash2 } from "lucide-react";
import { api } from "../api";
import MapView from "../MapView.jsx";
import { BAD, GOOD, KIND, TAG_ICON, TAG_LABEL, esc, nowPeriod, scoreColor, timeAgo } from "../labels.js";
import { Spinner, Stars, useToast } from "../ui.jsx";

const WORDS = ["Tap a star to rate", "Unsafe", "Not safe", "Okay", "Safe", "Very safe"];
const EMPTY = { street: "", period: nowPeriod(), score: 0, tags: [], comment: "", name: "", kind: "police", phone: "", open_24h: false };

export default function Contribute({ token, loc }) {
  const toast = useToast();
  const [what, setWhat] = useState("rate");
  const [pos, setPos] = useState([loc.lat, loc.lng]);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState("");
  const [near, setNear] = useState([]), [mine, setMine] = useState(null), [mySpots, setMySpots] = useState([]);
  const [geo, setGeo] = useState(false);
  const auto = useRef(true); // true while the street field was filled by us (so we may overwrite it)
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const toggle = (t) => set("tags", f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t]);

  const loadNear = () => api(`/ratings/?lat=${pos[0]}&lng=${pos[1]}&radius=1500`, { token }).then(setNear).catch(() => {});
  const loadMine = () => { api("/ratings/?mine=1", { token }).then(setMine).catch(() => setMine([])); api("/spots/?mine=1", { token }).then(setMySpots).catch(() => {}); };
  useEffect(() => { loadNear(); }, [pos[0], pos[1]]);
  useEffect(() => { if (what === "mine") loadMine(); }, [what]);

  // Tapping the map names the street for you (OpenStreetMap reverse lookup)
  async function pickPlace(p) {
    setPos(p); setDone("");
    if (!auto.current && f.street) return;
    setGeo(true);
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&lat=${p[0]}&lon=${p[1]}`)).json();
      const a = r.address || {};
      const name = [a.road || a.pedestrian || a.neighbourhood, a.suburb || a.city_district].filter(Boolean).join(", ") || (r.display_name || "").split(",").slice(0, 2).join(",");
      if (name) { setF((o) => ({ ...o, street: name })); auto.current = true; }
    } catch { /* the user can type it */ }
    setGeo(false);
  }

  async function submit(e) {
    e.preventDefault(); setErr(""); setDone(""); setBusy(true);
    try {
      if (what === "rate") {
        await api("/ratings/", { method: "POST", token, body: { street: f.street, lat: pos[0], lng: pos[1], period: f.period, score: f.score, tags: f.tags, comment: f.comment } });
        setDone("Thank you! Your rating now helps other women choose safer routes.");
        setF({ ...f, score: 0, tags: [], comment: "" }); loadNear();
      } else {
        await api("/spots/", { method: "POST", token, body: { name: f.name, kind: f.kind, lat: pos[0], lng: pos[1], phone: f.phone, open_24h: f.open_24h } });
        setDone("Thank you! The spot will appear on the map after our team verifies it.");
        setF({ ...f, name: "", phone: "" });
      }
      toast("Submitted");
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  const report = (id) => api(`/ratings/${id}/report/`, { method: "POST", token }).then((r) => toast(r.already ? "You already reported this" : "Reported. Thank you for keeping ratings honest."), (x) => toast(x.message, "err"));
  const remove = (id) => api(`/ratings/${id}/`, { method: "DELETE", token }).then(() => { toast("Rating deleted"); loadMine(); loadNear(); });

  const circles = useMemo(() => near.map((r) => ({ pos: [r.lat, r.lng], color: scoreColor(r.score), r: 45, popup: `<b>${esc(r.street)}</b><br/>${esc(r.period)} · ${r.score}/5` })), [near]);
  const markers = useMemo(() => [{ pos, icon: "📌", color: "#db2777", popup: "Selected place" }], [pos]);

  return (
    <div className="split">
      <div>
        <MapView className="tall" center={[loc.lat, loc.lng]} me={[loc.lat, loc.lng]} markers={markers} circles={circles} onClick={pickPlace} picking />
        <p className="hint"><MapPin size={14} /> Tap the map to mark the exact place. Dots show ratings others already made here.</p>
      </div>
      <div className="panel">
        <div className="seg" role="group" aria-label="What to add">
          {[["rate", "Rate a street"], ["spot", "Add safe spot"], ["mine", "My activity"]].map(([k, l]) => <button key={k} type="button" aria-pressed={what === k} onClick={() => { setWhat(k); setErr(""); setDone(""); }}>{l}</button>)}
        </div>

        {what === "mine" ? (
          <div>
            <h3>My ratings</h3>
            {mine === null ? <Spinner /> : mine.length === 0 ? <p className="hint">You have not rated any street yet.</p> : mine.map((r) => (
              <div key={r.id} className="row-item col">
                <div className="row"><strong>{r.street}</strong><button className="icon-btn" aria-label={"Delete rating for " + r.street} onClick={() => remove(r.id)}><Trash2 size={18} /></button></div>
                <div className="row"><Stars n={r.score} /><small className="hint">{r.period} · {timeAgo(r.created_at)}</small></div>
              </div>
            ))}
            <h3>My suggested safe spots</h3>
            {mySpots.length === 0 ? <p className="hint">No suggestions yet.</p> : mySpots.map((s) => (
              <div key={s.id} className="row-item"><span className="kind">{KIND[s.kind]}</span><span className="grow"><strong>{s.name}</strong></span><span className={"tag " + (s.verified ? "good" : "soft")}>{s.verified ? "Verified" : "Waiting for review"}</span></div>
            ))}
          </div>
        ) : (
          <form onSubmit={submit}>
            {what === "rate" ? (
              <>
                <label>Street or area<div className="field">{geo ? <Loader2 size={18} className="spin" /> : <MapPin size={18} />}<input value={f.street} onChange={(e) => { auto.current = false; set("street", e.target.value); }} placeholder="Tap the map or type a name" required /></div></label>
                <div className="seg" role="group" aria-label="Time of day">
                  <button type="button" aria-pressed={f.period === "day"} onClick={() => set("period", "day")}><Sun size={16} /> Day</button>
                  <button type="button" aria-pressed={f.period === "night"} onClick={() => set("period", "night")}><Moon size={16} /> Night</button>
                </div>
                <div className="stars" role="group" aria-label="Safety score">
                  {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} aria-label={`${n} out of 5`} className={n <= f.score ? "on" : ""} onClick={() => set("score", n)}>★</button>)}
                  <span className="star-word" style={f.score ? { color: scoreColor(f.score) } : null}>{WORDS[f.score]}</span>
                </div>
                <div className="chips">
                  {[...GOOD, ...BAD].map((t) => <button type="button" key={t} aria-pressed={f.tags.includes(t)} className={BAD.includes(t) ? "bad" : ""} onClick={() => toggle(t)}>{TAG_ICON[t]} {TAG_LABEL[t]}</button>)}
                </div>
                <label>Anything else? (optional)<div className="field"><input value={f.comment} maxLength={300} onChange={(e) => set("comment", e.target.value)} /></div></label>
              </>
            ) : (
              <>
                <label>Name of the place<div className="field"><input value={f.name} onChange={(e) => set("name", e.target.value)} required /></div></label>
                <label>Type<div className="field"><select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(KIND).map(([k, i]) => <option key={k} value={k}>{i} {k[0].toUpperCase() + k.slice(1)}</option>)}</select></div></label>
                <label>Phone (optional)<div className="field"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></div></label>
                <label className="check"><input type="checkbox" checked={f.open_24h} onChange={(e) => set("open_24h", e.target.checked)} /> Open 24 hours</label>
              </>
            )}
            {done && <p className="msg ok" role="status"><CheckCircle2 size={18} /> {done}</p>}
            {err && <p className="msg err" role="alert">{err}</p>}
            <button className="btn full" disabled={busy || (what === "rate" && !f.score)}>{busy ? <Loader2 size={18} className="spin" /> : what === "rate" && !f.score ? "Choose a star rating" : "Submit"}</button>
          </form>
        )}

        {what === "rate" && near.length > 0 && (
          <div>
            <h3>Already rated nearby</h3>
            {near.slice(0, 4).map((r) => (
              <div key={r.id} className="row-item col">
                <div className="row"><strong>{r.street}</strong>{!r.own && <button className="icon-btn" aria-label={"Report rating for " + r.street} title="Report as false or abusive" onClick={() => report(r.id)}><Flag size={16} /></button>}</div>
                <div className="row"><Stars n={r.score} /><small className="hint">{r.period} · {timeAgo(r.created_at)}</small></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
