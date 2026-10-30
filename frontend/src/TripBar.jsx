import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Plus, Radio } from "lucide-react";
import { Modal } from "./ui.jsx";
import { ringtone } from "./sound.js";
import { fmtClock } from "./labels.js";

function useNow() {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(id); }, []);
  return n;
}

// Safe-arrival timer. If you do not confirm before it ends, you get 30 seconds to say you are fine, then SOS starts.
export default function TripBar({ trip, onArrive, onExtend, onSos }) {
  const left = (trip.end - useNow()) / 1000;
  if (left <= 0) return <Due trip={trip} onArrive={onArrive} onExtend={onExtend} onSos={onSos} />;
  return (
    <div className="tripbar" role="status">
      <span className="tb-ic">{trip.shared ? <Radio size={18} /> : <Clock size={18} />}</span>
      <div className="tb-txt"><strong>{trip.label}</strong><small>{trip.shared ? "Sharing live · " : ""}Confirm arrival in <b>{fmtClock(left)}</b></small></div>
      <button className="btn sm alt" onClick={() => onExtend(10)} aria-label="Add 10 minutes"><Plus size={16} />10 min</button>
      <button className="btn sm good" onClick={onArrive}><CheckCircle2 size={16} /> I've arrived</button>
    </div>
  );
}

function Due({ trip, onArrive, onExtend, onSos }) {
  const [n, setN] = useState(30);
  useEffect(() => ringtone(), []);
  useEffect(() => {
    if (n <= 0) { onSos(); return; }
    const id = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(id);
  }, [n]);
  return (
    <Modal label="Safety check-in" tone="warn">
      <div className="count small">{n}</div>
      <h2>Are you safe?</h2>
      <p className="hint">Your timer “{trip.label}” has ended. If we do not hear from you, SOS will start and your contacts can follow your live location.</p>
      <div className="actions center">
        <button className="btn good" onClick={onArrive}>I'm safe</button>
        <button className="btn alt" onClick={() => onExtend(10)}>Need 10 more minutes</button>
        <button className="btn danger" onClick={onSos}>Send SOS now</button>
      </div>
    </Modal>
  );
}
