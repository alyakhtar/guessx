import { useSyncExternalStore } from 'react';

import { DEFAULTS, getSettings, subscribe } from './userSettings';

export function useUserSettings() {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
}
