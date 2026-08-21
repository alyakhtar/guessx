import { describe, expect, it, vi } from 'vitest';
import { buildShareUrl, canNativeShare, copyToClipboard } from './share';

describe('share helpers', () => {
  it('builds locale-aware public and private absolute URLs', () => {
    vi.stubGlobal('window', { location: { origin: 'https://guessx.example' } });
    expect(buildShareUrl('ABC', undefined, 'en')).toBe('https://guessx.example/en/game/ABC');
    expect(buildShareUrl('ABC', 'xYz', 'fr')).toBe('https://guessx.example/fr/game/ABC?code=xYz');
  });

  it('detects native share', () => {
    vi.stubGlobal('navigator', { share: vi.fn() });
    expect(canNativeShare()).toBe(true);
    vi.stubGlobal('navigator', {});
    expect(canNativeShare()).toBe(false);
  });

  it('copies with async clipboard and legacy fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyToClipboard('one')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('one');

    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } });
    const remove = vi.fn();
    const textarea = { value: '', style: {}, setAttribute: vi.fn(), select: vi.fn(), remove };
    vi.stubGlobal('document', { createElement: vi.fn(() => textarea), body: { appendChild: vi.fn() }, execCommand: vi.fn(() => true) });
    expect(await copyToClipboard('two')).toBe(true);
    expect(textarea.value).toBe('two');
    expect(remove).toHaveBeenCalled();
  });
});
