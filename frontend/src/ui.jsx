import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Lock } from "lucide-react";

// ---- toasts ----
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((text, type = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, type }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">{list.map((t) => <div key={t.id} className={"toast " + t.type}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}

export const Spinner = ({ label = "Loading" }) => <div className="spinner" role="status" aria-label={label} />;

export function Modal({ children, onClose, label, tone }) {
  useEffect(() => {
    if (!onClose) return;
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className={"overlay " + (tone || "")} role="dialog" aria-modal="true" aria-label={label}>
      <div className="sheet">{children}</div>
    </div>
  );
}

// Shown in place of pages that need an account.
export function LoginGate({ title, text, onLogin }) {
  return (
    <section className="card gate">
      <div className="gate-ic"><Lock size={28} /></div>
      <h2>{title}</h2>
      <p className="hint">{text}</p>
      <button className="btn" onClick={onLogin}>Log in or create account</button>
    </section>
  );
}

export const Stars = ({ n, size = 16 }) => <span className="stars-ro" aria-label={`${n} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ fontSize: size }} className={i <= n ? "on" : ""}>★</span>)}</span>;
