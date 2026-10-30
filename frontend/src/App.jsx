import { useCallback, useEffect, useRef, useState } from "react";
import { House, LogIn, LogOut, Moon, Radio, Route, ShieldCheck, Star, Sun } from "lucide-react";
import { api } from "./api";
import { nowPeriod } from "./labels.js";
import { unlockAudio } from "./sound.js";
import { LoginGate, useToast } from "./ui.jsx";
import Auth from "./pages/Auth.jsx";
import Home from "./pages/Home.jsx";
import Plan from "./pages/Plan.jsx";
import Contribute from "./pages/Contribute.jsx";
import Share from "./pages/Share.jsx";
import Safety from "./pages/Safety.jsx";
import SOS from "./SOS.jsx";
import TripBar from "./TripBar.jsx";
import FakeCall from "./FakeCall.jsx";

const CHENNAI = { lat: 13.0827, lng: 80.2707 }; // used until the browser shares the real location
const TABS = [["home", House, "Home"], ["plan", Route, "Routes"], ["add", Star, "Rate"], ["share", Radio, "Share"], ["safety", ShieldCheck, "Safety"]];
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

export default function App() {
  const toast = useToast();
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [me, setMe] = useState(read("me"));
  const [tab, setTab] = useState("home");
  const [authOpen, setAuthOpen] = useState(false);
  const [loc, setLoc] = useState(CHENNAI), [locState, setLocState] = useState("pending");
  const [share, setShareState] = useState(localStorage.getItem("share"));
  const [trip, setTripState] = useState(read("trip"));
  const [sos, setSos] = useState(false);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || "light");
  const [fakeAt, setFakeAt] = useState(null), [ringing, setRinging] = useState(null);
  const fakeTimer = useRef(null);
  const period = nowPeriod();

  const setShare = (t) => { t ? localStorage.setItem("share", t) : localStorage.removeItem("share"); setShareState(t); };
  const setTrip = (t) => { t ? localStorage.setItem("trip", JSON.stringify(t)) : localStorage.removeItem("trip"); setTripState(t); };
  const logout = useCallback(() => {
    ["token", "me", "share", "trip"].forEach((k) => localStorage.removeItem(k));
    setToken(null); setMe(null); setShareState(null); setTripState(null);
  }, []);
  const onAuth = (t, p) => { localStorage.setItem("token", t); localStorage.setItem("me", JSON.stringify(p)); setToken(t); setMe(p); setAuthOpen(false); toast(`Welcome${p?.name ? ", " + p.name : ""}!`); };
  const go = (t) => { setAuthOpen(false); setTab(t); window.scrollTo({ top: 0 }); };

  // ---- theme ----
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("theme", theme); }, [theme]);

  // ---- account ----
  useEffect(() => { window.addEventListener("sp:logout", logout); return () => window.removeEventListener("sp:logout", logout); }, [logout]);
  useEffect(() => { if (token) api("/me/", { token }).then((p) => { setMe(p); localStorage.setItem("me", JSON.stringify(p)); }).catch(() => {}); }, [token]);

  // ---- location ----
  const locate = useCallback(() => {
    if (!navigator.geolocation) return setLocState("denied");
    setLocState("pending");
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocState("ok"); },
      () => setLocState("denied"), { enableHighAccuracy: true, timeout: 8000 });
  }, []);
  useEffect(locate, [locate]);

  // ---- live share ----
  const startShare = async () => {
    const r = await api("/share/start/", { method: "POST", token, body: { lat: loc.lat, lng: loc.lng } });
    setShare(r.token); return r.token;
  };
  const stopShare = () => (share ? api(`/share/${share}/stop/`, { method: "POST", token }).catch(() => {}) : Promise.resolve()).finally(() => setShare(null));

  // While sharing, send the position (and battery level) to the server at most every 8 seconds.
  useEffect(() => {
    if (!share || !token || !navigator.geolocation) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(async (p) => {
      if (Date.now() - last < 8000) return;
      last = Date.now();
      setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocState("ok");
      const battery = await navigator.getBattery?.().then((b) => Math.round(b.level * 100)).catch(() => undefined);
      api(`/share/${share}/update/`, { method: "POST", token, body: { lat: p.coords.latitude, lng: p.coords.longitude, battery } })
        .catch((e) => { if (e.status === 404 || e.status === 410) { setShare(null); toast("Live sharing ended", "warn"); } });
    }, () => {}, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(id);
  }, [share, token]);

  // ---- trip / check-in timer ----
  const startTrip = async ({ minutes, label, share: wantShare }) => {
    if (!token) return setAuthOpen(true);
    try {
      if (wantShare) await startShare();
      setTrip({ end: Date.now() + minutes * 60000, label, shared: !!wantShare });
      toast(wantShare ? "Trip started. Live location is on." : "Timer started.");
    } catch (e) { toast(e.message, "err"); }
  };
  const arrive = () => { if (trip?.shared) stopShare(); setTrip(null); toast("Glad you arrived safely 💜"); };
  const extend = (min) => setTrip({ ...trip, end: Math.max(Date.now(), trip.end) + min * 60000 });
  const tripSos = () => { setTrip(null); setSos(true); };

  // ---- fake call ----
  const scheduleFake = (name, delay) => {
    unlockAudio(); clearTimeout(fakeTimer.current);
    if (delay <= 0) return setRinging(name);
    setFakeAt(Date.now() + delay * 1000);
    fakeTimer.current = setTimeout(() => { setFakeAt(null); setRinging(name); }, delay * 1000);
  };
  const cancelFake = () => { clearTimeout(fakeTimer.current); setFakeAt(null); };

  const gate = (title, text) => <LoginGate title={title} text={text} onLogin={() => setAuthOpen(true)} />;
  let page;
  if (authOpen && !token) page = <Auth onAuth={onAuth} onClose={() => setAuthOpen(false)} />;
  else if (tab === "home") page = <Home me={me} token={token} loc={loc} locState={locState} locate={locate} period={period} go={go} openAuth={() => setAuthOpen(true)} />;
  else if (tab === "plan") page = <Plan token={token} loc={loc} locState={locState} startTrip={startTrip} />;
  else if (tab === "add") page = token ? <Contribute token={token} loc={loc} /> : gate("Log in to contribute", "Rate streets and suggest safe spots to help other women choose safer routes.");
  else if (tab === "share") page = token ? <Share token={token} share={share} loc={loc} startShare={startShare} stopShare={stopShare} /> : gate("Log in to share your location", "Create a live link for your family and save emergency contacts for SOS.");
  else page = <Safety token={token} openAuth={() => setAuthOpen(true)} startTrip={startTrip} trip={trip} scheduleFake={scheduleFake} fakeAt={fakeAt} cancelFake={cancelFake} />;

  return (
    <>
      <header className="top">
        <button className="brand" onClick={() => go("home")} aria-label="SafePath home"><span className="logo"><ShieldCheck size={20} /></span>SafePath</button>
        <nav className="dnav" aria-label="Main">
          {TABS.map(([k, Icon, l]) => <button key={k} aria-pressed={tab === k && !authOpen} onClick={() => go(k)}><Icon size={18} />{l}</button>)}
        </nav>
        <div className="top-right">
          {share && <span className="live"><i /> Live</span>}
          <button className="icon-btn light" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}</button>
          {token
            ? <button className="ghost" onClick={() => { logout(); toast("Logged out"); }}><LogOut size={16} /><span>Log out</span></button>
            : <button className="ghost" onClick={() => setAuthOpen(true)}><LogIn size={16} /><span>Log in</span></button>}
          <button className="sos" onClick={() => { unlockAudio(); setSos(true); }} aria-label="SOS emergency">SOS</button>
        </div>
      </header>
      {trip && <TripBar trip={trip} onArrive={arrive} onExtend={extend} onSos={tripSos} />}
      <main className="wrap" key={authOpen ? "auth" : tab}>{page}</main>
      <nav className="bottom" aria-label="Main">
        {TABS.map(([k, Icon, l]) => <button key={k} aria-pressed={tab === k && !authOpen} onClick={() => go(k)}><Icon size={22} /><span>{l}</span></button>)}
      </nav>
      {sos && <SOS token={token} loc={loc} setShare={setShare} onClose={() => setSos(false)} onLogin={() => { setSos(false); setAuthOpen(true); }} />}
      {ringing && <FakeCall name={ringing} onClose={() => setRinging(null)} />}
    </>
  );
}
