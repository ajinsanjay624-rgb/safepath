import { useEffect, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { ringtone } from "./sound.js";
import { fmtClock } from "./labels.js";

// Looks like an incoming call so you have a believable reason to leave an uncomfortable situation.
export default function FakeCall({ name, onClose }) {
  const [answered, setAnswered] = useState(false), [sec, setSec] = useState(0);
  useEffect(() => { if (answered) return; return ringtone(); }, [answered]);
  useEffect(() => {
    if (!answered) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [answered]);

  return (
    <div className="fakecall" role="dialog" aria-modal="true" aria-label="Incoming call">
      <div className="fc-top">
        <div className="fc-avatar">{(name || "?")[0].toUpperCase()}</div>
        <h2>{name}</h2>
        <p>{answered ? `On call · ${fmtClock(sec)}` : "mobile · incoming call…"}</p>
      </div>
      {answered ? (
        <div className="fc-actions one"><button className="fc-btn red" onClick={onClose} aria-label="End call"><PhoneOff size={30} /></button></div>
      ) : (
        <div className="fc-actions">
          <div><button className="fc-btn red" onClick={onClose} aria-label="Decline"><PhoneOff size={30} /></button><span>Decline</span></div>
          <div><button className="fc-btn green" onClick={() => setAnswered(true)} aria-label="Accept"><Phone size={30} /></button><span>Accept</span></div>
        </div>
      )}
    </div>
  );
}
