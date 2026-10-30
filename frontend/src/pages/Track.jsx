import { useEffect, useState } from "react";
import { Battery, BatteryLow, Clock, ExternalLink, Phone, ShieldCheck, Siren } from "lucide-react";
import { api } from "../api";
import MapView from "../MapView.jsx";
import { Spinner } from "../ui.jsx";

// Public page opened from a shared link (no account needed). Refreshes every 8 seconds.
export default function Track({ token }) {
  const [d, setD] = useState(null), [err, setErr] = useState(""), [now, setNow] = useState(Date.now());
  useEffect(() => {
    const load = () => api(`/share/${token}/`).then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e.message));
    load();
    const a = setInterval(load, 8000), b = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [token]);

  const head = <header className="top"><span className="brand"><span className="logo"><ShieldCheck size={20} /></span>SafePath</span><span className="hint-w">Live location</span></header>;
  if (err && !d) return <>{head}<main className="wrap"><p className="msg err">{err}</p></main></>;
  if (!d) return <>{head}<main className="wrap"><Spinner /></main></>;
  if (!d.active) return <>{head}<main className="wrap"><section className="card gate"><h2>Sharing has ended</h2><p className="hint">{d.name} has stopped sharing her location, or the link has expired.</p></section></main></>;

  const secs = Math.max(0, Math.round((now - new Date(d.updated_at)) / 1000));
  const ago = secs < 60 ? `${secs} seconds` : `${Math.round(secs / 60)} minutes`;
  const left = Math.max(0, Math.round((new Date(d.expires_at) - now) / 60000));
  return (
    <>
      {head}
      <main className="wrap track">
        {d.sos && (
          <div className="sos-banner" role="alert">
            <Siren size={26} /><div><strong>{d.name} pressed SOS.</strong><br />Please call her now. If you cannot reach her, call 112.</div>
            <a className="btn white" href="tel:112"><Phone size={18} /> 112</a>
          </div>
        )}
        <h1>{d.name}'s live location</h1>
        <div className="chips-row">
          <span className={"tag " + (secs > 90 ? "bad" : "good")}><Clock size={13} /> Updated {ago} ago</span>
          {d.battery != null && <span className={"tag " + (d.battery < 20 ? "bad" : "soft")}>{d.battery < 20 ? <BatteryLow size={13} /> : <Battery size={13} />} Battery {d.battery}%</span>}
          <span className="tag soft">Link ends in {Math.floor(left / 60)} h {left % 60} min</span>
        </div>
        <MapView className="tall" center={[d.lat, d.lng]} trail={d.trail} markers={[{ pos: [d.lat, d.lng], icon: d.sos ? "🚨" : "📍", color: d.sos ? "#ef4444" : "#7c3aed", popup: d.name }]} />
        <p className="hint"><a href={`https://maps.google.com/?q=${d.lat},${d.lng}`} target="_blank" rel="noreferrer">Open in Google Maps <ExternalLink size={12} /></a> · The dotted line shows where she has been.</p>
      </main>
    </>
  );
}
