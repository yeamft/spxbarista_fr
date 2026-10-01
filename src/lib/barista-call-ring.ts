/** Soft phone-style ring using Web Audio (no media file required). */

type RingController = {
  start: () => void;
  stop: () => void;
  unlock: () => void;
};

let shared: RingController | null = null;

function createController(): RingController {
  let ctx: AudioContext | null = null;
  let intervalId: number | null = null;
  let playing = false;

  function ensureCtx() {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    return ctx;
  }

  function tone(at: number, freq: number, duration = 0.28) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.18, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  function burst() {
    const audio = ensureCtx();
    if (!audio) return;
    void audio.resume();
    const now = audio.currentTime;
    // Classic double-ring
    tone(now, 880);
    tone(now + 0.32, 700);
    tone(now + 0.9, 880);
    tone(now + 1.22, 700);
  }

  return {
    unlock() {
      const audio = ensureCtx();
      if (!audio) return;
      void audio.resume();
    },
    start() {
      if (playing) return;
      playing = true;
      burst();
      intervalId = window.setInterval(burst, 2800);
    },
    stop() {
      playing = false;
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}

export function getBaristaCallRing(): RingController {
  if (!shared) shared = createController();
  return shared;
}
