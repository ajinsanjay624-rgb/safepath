import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, MessageSquare, Phone, Radio, Share2, Trash2, UserPlus } from "lucide-react";
import { api } from "../api";
import MapView from "../MapView.jsx";
import { useToast } from "../ui.jsx";

export default function Share({ token, share, loc, startShare, stopShare }) {
  const toast = useToast();
  const [contacts, setContacts] = useState([]);
  const [c, setC] = useState({ name: "", phone: "" });
  const [err, setErr] = useState(""), [copied, setCopied] = useState(false), [busy, setBusy] = useState(false);
  const link = share ? `${location.origin}/track/${share}` : "";
  const text = `Follow my live location on SafePath: ${link}`;
  const loadContacts = () => api("/contacts/", { token }).then(setContacts).catch(() => {});
  useEffect(() => { loadContacts(); }, []);

  const add = async (e) => {
    e.preventDefault(); setErr("");
    try { setContacts(await api("/contacts/", { method: "POST", token, body: c })); setC({ name: "", phone: "" }); toast("Contact saved"); }
    catch (x) { setErr(x.message); }
  };
  const remove = (id) => api(`/contacts/${id}/`, { method: "DELETE", token }).then(() => { loadContacts(); toast("Contact removed"); });
  const copy = () => navigator.clipboard?.writeText(link).then(() => { setCopied(true); toast("Link copied"); setTimeout(() => setCopied(false), 2000); }, () => toast("Could not copy. Select the link and copy it.", "err"));
  const nativeShare = () => navigator.share({ title: "My live location", text, url: link }).catch(() => {});
  const begin = async () => { setBusy(true); try { await startShare(); toast("Live sharing started"); } catch (x) { toast(x.message, "err"); } setBusy(false); };
  const end = async () => { await stopShare(); toast("Sharing stopped"); };

  return (
    <div className="split">
      <div className="stack">
        <section className="card">
          <h2><Radio size={20} /> Live location sharing</h2>
          {share ? (
            <>
              <p className="msg ok live-msg"><span className="live-dot" /> Sharing is on. Your location updates every few seconds for up to 6 hours.</p>
              <input readOnly value={link} aria-label="Tracking link" onFocus={(e) => e.target.select()} />
              <div className="actions">
                <button className="btn" onClick={copy}>{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? "Copied" : "Copy link"}</button>
                {navigator.share && <button className="btn alt" onClick={nativeShare}><Share2 size={18} /> Share…</button>}
                <a className="btn alt" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                {contacts.length > 0 && <a className="btn alt" href={`sms:${contacts.map((x) => x.phone).join(",")}?body=${encodeURIComponent(text)}`}><MessageSquare size={18} /> SMS all</a>}
                <a className="btn alt" href={link} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Preview</a>
              </div>
              <button className="btn danger full" onClick={end}>Stop sharing</button>
            </>
          ) : (
            <>
              <p className="hint">Create a link your family can open to watch your trip on a map, with your path and battery level. Only people with the link can see it, and it stops when you stop sharing.</p>
              <button className="btn full" onClick={begin} disabled={busy}>Start sharing my location</button>
            </>
          )}
        </section>

        <section className="card">
          <h2><Phone size={20} /> Emergency contacts</h2>
          <p className="hint">These people get your SOS message by SMS (up to 5).</p>
          {contacts.length === 0 && <p className="msg info">No contacts yet. Add someone you trust below.</p>}
          {contacts.map((x) => (
            <div key={x.id} className="row-item">
              <span className="avatar">{x.name[0]?.toUpperCase()}</span>
              <span className="grow"><strong>{x.name}</strong><br /><small className="hint">{x.phone}</small></span>
              <a className="icon-btn" href={"tel:" + x.phone} aria-label={"Call " + x.name}><Phone size={18} /></a>
              {share && <a className="icon-btn" href={`sms:${x.phone}?body=${encodeURIComponent(text)}`} aria-label={"Send link to " + x.name}><MessageSquare size={18} /></a>}
              <button className="icon-btn" aria-label={"Remove " + x.name} onClick={() => remove(x.id)}><Trash2 size={18} /></button>
            </div>
          ))}
          <form onSubmit={add} className="two">
            <label>Name<div className="field"><input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} required /></div></label>
            <label>Phone<div className="field"><input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} inputMode="tel" placeholder="10 digits" required /></div></label>
            <button className="btn full wide" disabled={contacts.length >= 5}><UserPlus size={18} /> {contacts.length >= 5 ? "Limit reached (5)" : "Add contact"}</button>
          </form>
          {err && <p className="msg err" role="alert">{err}</p>}
        </section>
      </div>
      <MapView className="tall" center={[loc.lat, loc.lng]} me={[loc.lat, loc.lng]} markers={[{ pos: [loc.lat, loc.lng], icon: share ? "📡" : "📍", color: share ? "#10b981" : "#7c3aed", popup: "You are here" }]} />
    </div>
  );
}
