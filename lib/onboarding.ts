export const OPEN_ONBOARDING_EVENT = 'guessx:open-onboarding';

export function openOnboarding(): void {
  window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT));
}
