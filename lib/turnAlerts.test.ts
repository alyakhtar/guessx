import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadTurnAlerts() {
  vi.resetModules();
  return import('./turnAlerts');
}

function turn(roomId: string, currentTurn: string) {
  return { roomId, currentTurn, turnDurationMs: 30_000 };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createTurnAlertController', () => {
  function createController({
    roomId = 'room-a',
    getMySocketId = () => 'player-a',
    getSoundEnabled = () => true,
    getIsHidden = () => true,
  }: {
    roomId?: string;
    getMySocketId?: () => string | undefined;
    getSoundEnabled?: () => boolean;
    getIsHidden?: () => boolean;
  } = {}) {
    const chime = { play: vi.fn() };
    const flasher = { start: vi.fn(), stop: vi.fn() };

    return loadTurnAlerts().then(({ createTurnAlertController }) => ({
      controller: createTurnAlertController({ roomId, getMySocketId, getSoundEnabled, getIsHidden, chime, flasher }),
      chime,
      flasher,
    }));
  }

  it('plays and starts a flash for an own turn while hidden', async () => {
    const { controller, chime, flasher } = await createController();

    controller.handleTurnStarted(turn('room-a', 'player-a'));

    expect(chime.play).toHaveBeenCalledOnce();
    expect(flasher.start).toHaveBeenCalledOnce();
    expect(flasher.stop).not.toHaveBeenCalled();
  });

  it('plays without flashing for an own turn while visible', async () => {
    const { controller, chime, flasher } = await createController({ getIsHidden: () => false });

    controller.handleTurnStarted(turn('room-a', 'player-a'));

    expect(chime.play).toHaveBeenCalledOnce();
    expect(flasher.start).not.toHaveBeenCalled();
  });

  it('stops an existing flash when the turn moves to another player', async () => {
    const { controller, chime, flasher } = await createController();

    controller.handleTurnStarted(turn('room-a', 'player-b'));

    expect(chime.play).not.toHaveBeenCalled();
    expect(flasher.start).not.toHaveBeenCalled();
    expect(flasher.stop).toHaveBeenCalledOnce();
  });

  it('reads the sound setting again for each own-turn event', async () => {
    let soundEnabled = true;
    const { controller, chime, flasher } = await createController({ getSoundEnabled: () => soundEnabled });

    controller.handleTurnStarted(turn('room-a', 'player-a'));
    soundEnabled = false;
    controller.handleTurnStarted(turn('room-a', 'player-a'));

    expect(chime.play).toHaveBeenCalledOnce();
    expect(flasher.start).toHaveBeenCalledTimes(2);
  });

  it('reads the visibility state again for each own-turn event', async () => {
    let hidden = false;
    const { controller, chime, flasher } = await createController({ getIsHidden: () => hidden });

    controller.handleTurnStarted(turn('room-a', 'player-a'));
    hidden = true;
    controller.handleTurnStarted(turn('room-a', 'player-a'));

    expect(chime.play).toHaveBeenCalledTimes(2);
    expect(flasher.start).toHaveBeenCalledOnce();
  });

  it('uses the socket id available for each event across connect and reconnect', async () => {
    const socketIds = [undefined, 'player-a', 'player-b'];
    const getMySocketId = vi.fn(() => socketIds.shift());
    const { controller, chime, flasher } = await createController({ getMySocketId });

    controller.handleTurnStarted(turn('room-a', 'player-a'));
    controller.handleTurnStarted(turn('room-a', 'player-a'));
    controller.handleTurnStarted(turn('room-a', 'player-b'));

    expect(getMySocketId).toHaveBeenCalledTimes(3);
    expect(chime.play).toHaveBeenCalledTimes(2);
    expect(flasher.start).toHaveBeenCalledTimes(2);
    expect(flasher.stop).toHaveBeenCalledOnce();
  });

  it('ignores an event from another room without touching either alert primitive', async () => {
    const { controller, chime, flasher } = await createController();

    controller.handleTurnStarted(turn('room-b', 'player-a'));

    expect(chime.play).not.toHaveBeenCalled();
    expect(flasher.start).not.toHaveBeenCalled();
    expect(flasher.stop).not.toHaveBeenCalled();
  });

  it('stops the flasher for shared cleanup paths', async () => {
    const { controller, flasher } = await createController();

    controller.stop();

    expect(flasher.stop).toHaveBeenCalledOnce();
  });
});

describe('createTitleFlasher', () => {
  it('sets the alert title immediately, alternates, and restores the captured title', async () => {
    const document = { title: 'Original GuessX' };
    vi.stubGlobal('document', document);
    const { createTitleFlasher } = await loadTurnAlerts();
    const flasher = createTitleFlasher('(Your turn!) GuessX');

    flasher.start();
    expect(document.title).toBe('(Your turn!) GuessX');

    vi.advanceTimersByTime(1_000);
    expect(document.title).toBe('Original GuessX');
    vi.advanceTimersByTime(1_000);
    expect(document.title).toBe('(Your turn!) GuessX');

    flasher.stop();
    expect(document.title).toBe('Original GuessX');
  });

  it('does not stack intervals or replace the original title when started twice', async () => {
    const document = { title: 'Original GuessX' };
    vi.stubGlobal('document', document);
    const { createTitleFlasher } = await loadTurnAlerts();
    const flasher = createTitleFlasher('(Your turn!) GuessX');

    flasher.start();
    flasher.start();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1_000);

    expect(document.title).toBe('Original GuessX');
    flasher.stop();
    expect(document.title).toBe('Original GuessX');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing when stopped before it starts', async () => {
    const document = { title: 'Original GuessX' };
    vi.stubGlobal('document', document);
    const { createTitleFlasher } = await loadTurnAlerts();
    const flasher = createTitleFlasher('(Your turn!) GuessX');

    flasher.stop();

    expect(document.title).toBe('Original GuessX');
  });

  it('does not throw without a document', async () => {
    vi.stubGlobal('document', undefined);
    const { createTitleFlasher } = await loadTurnAlerts();
    const flasher = createTitleFlasher('(Your turn!) GuessX');

    expect(() => flasher.start()).not.toThrow();
    expect(() => flasher.stop()).not.toThrow();
  });
});

describe('createChimePlayer', () => {
  function fakeAudioContext(state: 'running' | 'suspended' = 'running') {
    const oscillator = {
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    return {
      state,
      currentTime: 0,
      createOscillator: vi.fn(() => ({ ...oscillator, frequency: { ...oscillator.frequency } })),
      createGain: vi.fn(() => ({ ...gain, gain: { ...gain.gain } })),
      destination: {},
      resume: vi.fn(() => Promise.resolve()),
    };
  }

  it('creates one audio context and reuses it for repeated plays', async () => {
    const context = fakeAudioContext();
    const AudioContext = vi.fn(() => context);
    vi.stubGlobal('AudioContext', AudioContext);
    const { createChimePlayer } = await loadTurnAlerts();
    const chime = createChimePlayer();

    chime.play();
    chime.play();

    expect(AudioContext).toHaveBeenCalledOnce();
  });

  it.each([
    ['absent constructor', undefined],
    ['throwing constructor', vi.fn(() => { throw new Error('unavailable'); })],
  ])('does not throw for an %s', async (_description, AudioContext) => {
    vi.stubGlobal('AudioContext', AudioContext);
    const { createChimePlayer } = await loadTurnAlerts();
    const chime = createChimePlayer();

    expect(() => chime.play()).not.toThrow();
  });

  it('swallows a rejected resume from a suspended context', async () => {
    const context = fakeAudioContext('suspended');
    context.resume.mockRejectedValueOnce(new Error('blocked'));
    vi.stubGlobal('AudioContext', vi.fn(() => context));
    const { createChimePlayer } = await loadTurnAlerts();
    const chime = createChimePlayer();

    expect(() => chime.play()).not.toThrow();
    await Promise.resolve();

    expect(context.createOscillator).not.toHaveBeenCalled();
  });
});
