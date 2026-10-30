// Sounds made with the Web Audio API, so no audio files are needed.
let ctx;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
export const unlockAudio = () => { try { ac().resume(); } catch { /* audio not supported */ } };

export function ringtone() {
  let stopped = false, id;
  try {
    const a = ac();
    const beep = () => {
      if (stopped) return;
      const t = a.currentTime;
      [0, 0.35].forEach((off, i) => {
        const o = a.createOscillator(), g = a.createGain();
        o.type = "sine"; o.frequency.value = i ? 523 : 659;
        g.gain.setValueAtTime(0.0001, t + off);
        g.gain.exponentialRampToValueAtTime(0.3, t + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.3);
        o.connect(g); g.connect(a.destination); o.start(t + off); o.stop(t + off + 0.32);
      });
      navigator.vibrate?.([300, 150, 300]);
    };
    beep(); id = setInterval(beep, 1600);
  } catch { /* ignore */ }
  return () => { stopped = true; clearInterval(id); navigator.vibrate?.(0); };
}

export function siren() {
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = "sawtooth"; o.frequency.value = 600; g.gain.value = 0.4;
    o.connect(g); g.connect(a.destination); o.start();
    let up = true;
    const id = setInterval(() => { o.frequency.linearRampToValueAtTime(up ? 1400 : 600, a.currentTime + 0.45); up = !up; }, 450);
    navigator.vibrate?.([500, 200, 500, 200, 500, 200, 500]);
    return () => { clearInterval(id); try { o.stop(); } catch { /* already stopped */ } g.disconnect(); navigator.vibrate?.(0); };
  } catch { return () => {}; }
}
