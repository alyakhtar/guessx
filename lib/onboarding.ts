export const ONBOARDING_STORAGE_KEY = 'guessx.onboarding.seen.v1';

type OnboardingStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function hasSeenOnboarding(storage: OnboardingStorage): boolean {
  try {
    return storage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboardingSeen(storage: OnboardingStorage): void {
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  } catch {
    // Private browsing or a full storage quota should never prevent play.
  }
}
