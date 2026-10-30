import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, MapPinned, Phone, ShieldCheck, Siren, User, X } from "lucide-react";
import { api } from "../api";

export default function Auth({ onAuth, onClose }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ phone: "", password: "", name: "" });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [show, setShow] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: k === "phone" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value });

  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const r = await api(mode === "login" ? "/auth/login/" : "/auth/register/", { method: "POST", body: f });
      onAuth(r.token, r.profile);
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <div className="auth-grid">
      <aside className="auth-hero">
        <h1>Walk smart.<br />Arrive safe.</h1>
        <p>Compare routes by a live safety score, separately for day and night, built from ratings by women who walk these streets.</p>
        <ul>
          <li><MapPinned size={20} /> Safer route suggestions with reasons</li>
          <li><ShieldCheck size={20} /> Verified police booths, hospitals and 24h shops</li>
          <li><Siren size={20} /> One-tap SOS with live location for family</li>
        </ul>
      </aside>
      <section className="card auth">
        {onClose && <button className="icon-btn x" onClick={onClose} aria-label="Close"><X size={20} /></button>}
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="hint">Log in to rate streets, share your live location and use SOS. Route planning works without an account.</p>
        <form onSubmit={submit}>
          {mode === "register" && <label>Your name<div className="field"><User size={18} /><input value={f.name} onChange={set("name")} required autoComplete="name" /></div></label>}
          <label>Phone number<div className="field"><Phone size={18} /><input value={f.phone} onChange={set("phone")} inputMode="numeric" placeholder="10 digit mobile number" required autoComplete="username" /></div></label>
          <label>Password<div className="field"><Lock size={18} /><input type={show ? "text" : "password"} value={f.password} onChange={set("password")} required autoComplete={mode === "login" ? "current-password" : "new-password"} /><button type="button" className="icon-btn" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {error && <p className="msg err" role="alert">{error}</p>}
          <button className="btn full" disabled={busy}>{busy ? <Loader2 size={18} className="spin" /> : mode === "login" ? "Log in" : "Create account"}</button>
        </form>
        <button className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already registered? Log in"}
        </button>
        {mode === "login" && <button className="btn alt full" type="button" onClick={() => setF({ ...f, phone: "9000000001", password: "demo1234" })}>Fill demo account (9000000001 / demo1234)</button>}
        {onClose && <button className="link" onClick={onClose}>Continue without logging in</button>}
      </section>
    </div>
  );
}
