import { useEffect, useRef, useState } from "react";
import { AlarmClock, BellRing, CheckCircle2, ChevronDown, Clock, Phone, PhoneCall, Siren, Volume2, VolumeX } from "lucide-react";
import { api } from "../api";
import { HELPLINES, TIPS, mapsLink, timeAgo } from "../labels.js";
import { siren, unlockAudio } from "../sound.js";
import { Spinner, useToast } from "../ui.jsx";

export default function Safety({ token, openAuth, startTrip, trip, scheduleFake, fakeAt, cancelFake }) {
  const toast = useToast();
  const [name, setName] = useState(localStorage.getItem("fakeName") || "Amma");
  const [delay, setDelay] = useState(10), [mins, setMins] = useState(30);
  const [loud, setLoud] = useState(false), [open, setOpen] = useState(0);
  const [history, setHistory] = useState(null);
  const stop = useRef(null);
  const [, tick] = useState(0);
  useEffect(() => () => stop.current?.(), []);
  useEffect(() => { if (!fakeAt) return; const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, [fakeAt]);

  const loadHistory = () => api("/sos/", { token }).then(setHistory).catch(() => setHistory([]));
  useEffect(() => { if (token) loadHistory(); }, [token]);

  const toggleSiren = () => {
    unlockAudio();
    if (loud) { stop.current?.(); stop.current = null; } else stop.current = siren();
    setLoud(!loud);
  };
  const fake = () => { localStorage.setItem("fakeName", name); scheduleFake(name || "Amma", delay); if (delay > 0) toast(`Fake call in ${delay} seconds. Keep this page open.`); };
  const resolve = (id) => api(`/sos/${id}/resolve/`, { method: "POST", token }).then(() => { toast("Marked as resolved"); loadHistory(); });
  const left = fakeAt ? Math.max(0, Math.round((fakeAt - Date.now()) / 1000)) : 0;

  return (
    <div className="stack wide-stack">
      <div className="tools">
        <section className="card tool t1">
          <h2><PhoneCall size={20} /> Fake call</h2>
          <p className="hint">A believable incoming call to help you leave an uncomfortable situation.</p>
          <label>Caller name<div className="field"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} /></div></label>
          <label>Ring after<div className="field"><select value={delay} onChange={(e) => setDelay(+e.target.value)}>{[[0, "Right now"], [10, "10 seconds"], [30, "30 seconds"], [60, "1 minute"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></label>
          {fakeAt ? <button className="btn alt full" onClick={cancelFake}>Cancel call ({left}s)</button> : <button className="btn full" onClick={fake}><Phone size={18} /> Start fake call</button>}
        </section>

        <section className="card tool t2">
          <h2><Siren size={20} /> Panic alarm</h2>
          <p className="hint">A loud siren and vibration to attract attention. Turn your volume up.</p>
          <button className={"btn full " + (loud ? "danger pulse-btn" : "")} onClick={toggleSiren}>{loud ? <><VolumeX size={18} /> Stop alarm</> : <><Volume2 size={18} /> Sound alarm</>}</button>
        </section>

        <section className="card tool t3">
          <h2><AlarmClock size={20} /> Safe-arrival timer</h2>
          <p className="hint">Start a timer for your trip. If you do not confirm you arrived, SOS starts automatically.</p>
          {token ? (
            trip ? <p className="msg info"><Clock size={16} /> A timer is running: {trip.label}</p> : (
              <>
                <div className="seg" role="group" aria-label="Minutes">{[15, 30, 60, 90].map((m) => <button key={m} aria-pressed={mins === m} onClick={() => setMins(m)}>{m} min</button>)}</div>
                <button className="btn full" onClick={() => startTrip({ minutes: mins, label: `${mins} minute check-in`, share: true })}><BellRing size={18} /> Start timer and share location</button>
              </>
            )
          ) : <button className="btn full" onClick={openAuth}>Log in to use the timer</button>}
        </section>
      </div>

      <section className="card">
        <h2><Phone size={20} /> Helplines</h2>
        <p className="hint">Tap to call. These numbers work across India.</p>
        <div className="helplines">
          {HELPLINES.map((h) => <a key={h.n} className="helpline" style={{ "--c": h.color }} href={"tel:" + h.n}><b>{h.n}</b><strong>{h.name}</strong><small>{h.note}</small></a>)}
        </div>
      </section>

      {token && (
        <section className="card">
          <h2>My SOS history</h2>
          {history === null ? <Spinner /> : history.length === 0 ? <p className="hint">No SOS alerts. That is a good thing.</p> : history.map((a) => (
            <div key={a.id} className="row-item">
              <span className="grow"><strong>{timeAgo(a.created_at)}</strong><br /><a className="hint" href={mapsLink(a.lat, a.lng)} target="_blank" rel="noreferrer">View place</a></span>
              {a.resolved ? <span className="tag good"><CheckCircle2 size={12} /> Resolved</span> : <button className="btn sm good" onClick={() => resolve(a.id)}>Mark resolved</button>}
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Safety tips</h2>
        {TIPS.map(([t, body], i) => (
          <div key={t} className={"acc" + (open === i ? " open" : "")}>
            <button aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>{t}<ChevronDown size={18} /></button>
            {open === i && <p>{body}</p>}
          </div>
        ))}
        <p className="hint">SafePath supports your decisions. It does not replace emergency services: call 112 in danger.</p>
      </section>
    </div>
  );
}
