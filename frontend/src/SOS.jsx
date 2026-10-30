import { useEffect, useRef, useState } from "react";
import { BellRing, CheckCircle2, MessageSquare, Navigation, Phone, Share2, Volume2, VolumeX } from "lucide-react";
import { api } from "./api";
import { Modal } from "./ui.jsx";
import { HELPLINES, mapsLink } from "./labels.js";
import { siren, unlockAudio } from "./sound.js";

// 3 second countdown (cancel any time), then records the alert, starts live sharing and shows next steps.
export default function SOS({ token, loc, onClose, setShare, onLogin }) {
  const [n, setN] = useState(3), [res, setRes] = useState(null), [err, setErr] = useState(""), [pos, setPos] = useState(loc);
  const [loud, setLoud] = useState(false), [safe, setSafe] = useState(false);
  const sent = useRef(false), stopSiren = useRef(null);
  useEffect(() => () => stopSiren.current?.(), []);

  useEffect(() => {
    if (!token || res || err) return;
    if (n === 0) { send(); return; }
    const id = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(id);
  }, [n, res, err, token]);

  function send() {
    if (sent.current) return;
    sent.current = true;
    const go = (lat, lng) => {
      setPos({ lat, lng });
      api("/sos/", { method: "POST", token, body: { lat, lng } }).then((r) => { setRes(r); setShare(r.share_token); }).catch((e) => setErr(e.message));
    };
    if (!navigator.geolocation) return go(loc.lat, loc.lng);
    navigator.geolocation.getCurrentPosition((p) => go(p.coords.latitude, p.coords.longitude), () => go(loc.lat, loc.lng), { enableHighAccuracy: true, timeout: 6000 });
  }
  function toggleSiren() {
    unlockAudio();
    if (loud) { stopSiren.current?.(); stopSiren.current = null; } else stopSiren.current = siren();
    setLoud(!loud);
  }
  async function imSafe() {
    try { await api(`/sos/${res.id}/resolve/`, { method: "POST", token }); } catch { /* already resolved */ }
    setShare(null); setSafe(true);
  }

  const link = res ? `${location.origin}/track/${res.share_token}` : "";
  const text = `🚨 I need help. Follow my live location: ${link} (last seen ${mapsLink(pos.lat, pos.lng)})`;
  const calls = (res?.helplines || HELPLINES.slice(0, 2).map((h) => ({ name: h.name, number: h.n })));

  if (!token) return (
    <Modal label="SOS" onClose={onClose} tone="sos">
      <h2>Need help right now?</h2>
      <p className="hint">Call a helpline directly. Log in to also share your live location with family and alert your contacts.</p>
      <div className="actions center">{calls.map((h) => <a key={h.number} className="btn danger" href={"tel:" + h.number}><Phone size={18} /> {h.name} {h.number}</a>)}</div>
      <button className="btn full" onClick={onLogin}>Log in to enable full SOS</button>
      <button className="btn alt full" onClick={onClose}>Close</button>
    </Modal>
  );

  return (
    <Modal label="SOS" tone="sos">
      {!res && !err && (
        <>
          <div className="count" aria-live="assertive">{n}</div>
          <p>Sending SOS and sharing your live location…</p>
          <button className="btn danger full" onClick={() => { setN(0); }}>Send now</button>
          <button className="btn alt full" onClick={onClose}>Cancel, I'm okay</button>
        </>
      )}
      {err && <><p className="msg err">{err}</p><div className="actions center"><a className="btn danger" href="tel:112"><Phone size={18} /> Call 112</a><button className="btn alt" onClick={onClose}>Close</button></div></>}
      {res && !safe && (
        <>
          <div className="ok-ic sos"><BellRing size={30} /></div>
          <h2>Help request recorded</h2>
          <p className="hint">Your live location is being shared. Now alert the people who can reach you fastest:</p>
          <div className="actions center">
            {res.helplines.map((h) => <a key={h.number} className="btn danger" href={"tel:" + h.number}><Phone size={18} /> {h.name} {h.number}</a>)}
            {res.contacts.length > 0
              ? <a className="btn" href={`sms:${res.contacts.map((c) => c.phone).join(",")}?body=${encodeURIComponent(text)}`}><MessageSquare size={18} /> SMS my contacts</a>
              : <p className="hint">No emergency contacts saved yet. Add some in the Share tab.</p>}
            <a className="btn alt" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><Share2 size={18} /> WhatsApp</a>
            <button className={"btn " + (loud ? "danger" : "alt")} onClick={toggleSiren}>{loud ? <VolumeX size={18} /> : <Volume2 size={18} />} {loud ? "Stop siren" : "Loud siren"}</button>
          </div>
          {res.spots.length > 0 && <>
            <h3>Nearest safe places</h3>
            {res.spots.map((s) => <div key={s.id} className="row-item"><span><strong>{s.name}</strong><br /><small>{s.distance_m} m away</small></span><a className="btn sm alt" href={mapsLink(s.lat, s.lng)} target="_blank" rel="noreferrer"><Navigation size={16} /> Go</a></div>)}
          </>}
          <button className="btn good full" onClick={imSafe}><CheckCircle2 size={18} /> I'm safe now (stop sharing)</button>
          <button className="btn alt full" onClick={onClose}>Close (sharing stays on)</button>
        </>
      )}
      {safe && <><div className="ok-ic"><CheckCircle2 size={30} /></div><h2>Glad you're safe</h2><p className="hint">The alert is marked resolved and live sharing has stopped.</p><button className="btn full" onClick={onClose}>Close</button></>}
    </Modal>
  );
}
