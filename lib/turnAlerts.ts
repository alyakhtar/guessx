import type { TurnStartedPayload } from './socket';

export interface ChimePlayer {
  play(): void;
}

export interface TitleFlasher {
  start(): void;
  stop(): void;
}

// Module-level on purpose: every createChimePlayer() shares one AudioContext for the page
// lifetime (browsers cap how many a document may open). `null` means "unavailable, stop
// trying"; `undefined` means "not created yet". Tests must vi.resetModules() to clear it.
let audioContext: AudioContext | null | undefined;

function getAudioContext() {
  if (audioContext !== undefined) return audioContext;

  const AudioContextConstructor = globalThis.AudioContext;
  if (typeof AudioContextConstructor !== 'function') return (audioContext = null);

  try {
    return (audioContext = new AudioContextConstructor());
  } catch {
    return (audioContext = null);
  }
}

function playNotes(context: AudioContext) {
  try {
    for (const [frequency, offset] of [[523.25, 0], [659.25, 0.09]]) {
      const start = context.currentTime + offset;
      const end = start + 0.09;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end);
    }
  } catch {
    // Web Audio is optional; alerts must still work without it.
  }
}

export function createChimePlayer(): ChimePlayer {
  return {
    play() {
      const context = getAudioContext();
      if (!context) return;

      if (context.state === 'suspended') {
        try {
          void context.resume().then(() => playNotes(context)).catch(() => {});
        } catch {
          // A failed resume is a silent chime, not a failed turn handler.
        }
        return;
      }

      playNotes(context);
    },
  };
}

export function createTitleFlasher(alertTitle: string): TitleFlasher {
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let originalTitle = '';
  let running = false;

  return {
    start() {
      if (running) return;

      const document = globalThis.document;
      if (!document) return;

      try {
        originalTitle = document.title;
        document.title = alertTitle;
        let showingAlert = true;
        intervalId = setInterval(() => {
          document.title = showingAlert ? originalTitle : alertTitle;
          showingAlert = !showingAlert;
        }, 1_000);
        running = true;
      } catch {
        try {
          document.title = originalTitle;
        } catch {
          // A non-browser document is optional too.
        }
      }
    },

    stop() {
      if (!running) return;

      running = false;
      if (intervalId !== undefined) clearInterval(intervalId);
      intervalId = undefined;

      const document = globalThis.document;
      if (!document) return;
      try {
        document.title = originalTitle;
      } catch {
        // A missing document only suppresses title restoration.
      }
    },
  };
}

export function createTurnAlertController({
  roomId,
  getMySocketId,
  getSoundEnabled,
  getIsHidden,
  chime,
  flasher,
}: {
  roomId: string;
  getMySocketId: () => string | undefined;
  getSoundEnabled: () => boolean;
  getIsHidden: () => boolean;
  chime: ChimePlayer;
  flasher: TitleFlasher;
}) {
  return {
    handleTurnStarted(payload: TurnStartedPayload) {
      if (payload.roomId !== roomId) return;
      if (payload.currentTurn !== getMySocketId()) {
        flasher.stop();
        return;
      }
      if (getSoundEnabled()) chime.play();
      if (getIsHidden()) flasher.start();
    },

    stop() {
      flasher.stop();
    },
  };
}
