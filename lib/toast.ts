export type ToastVariant = 'danger' | 'success' | 'info';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

export const AUTO_DISMISS_MS = 5000;
export const MAX_TOASTS = 3;

const subscribers = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let toasts: Toast[] = [];
let nextId = 1;

function notify() {
  subscribers.forEach((listener) => listener());
}

export function showToast(
  message: string,
  opts: { variant?: ToastVariant } = {},
): number {
  const toast: Toast = {
    id: nextId++,
    message,
    variant: opts.variant ?? 'danger',
  };
  const evicted = toasts.length === MAX_TOASTS ? toasts[0] : undefined;
  if (evicted) {
    clearTimeout(timers.get(evicted.id));
    timers.delete(evicted.id);
  }
  toasts = [...toasts.slice(-(MAX_TOASTS - 1)), toast];
  timers.set(toast.id, setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS));
  notify();
  return toast.id;
}

export function dismissToast(id: number): void {
  if (!toasts.some((toast) => toast.id === id)) return;
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  notify();
}

export function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function getToasts(): readonly Toast[] {
  return toasts;
}

export function _resetToasts(): void {
  timers.forEach(clearTimeout);
  timers.clear();
  subscribers.clear();
  toasts = [];
  nextId = 1;
}
