// Adapted from Paramount Quality+ (ISC). See NOTICE.md.
import { normalizeConfig, setConfig } from './state.js';

export const PENDING_CONFIG_KEY = 'pmrQualityPendingQualityConfig';

export function consumePendingConfig(storage = null) {
  try {
    const configStorage = storage || window.sessionStorage;
    const rawConfig = configStorage?.getItem(PENDING_CONFIG_KEY);
    if (!rawConfig) return null;

    configStorage.removeItem(PENDING_CONFIG_KEY);
    const config = JSON.parse(rawConfig);
    if (!config || typeof config !== 'object') return null;
    const normalized = normalizeConfig(config);
    setConfig(normalized);
    return normalized;
  } catch {
    return null;
  }
}

// Listen for configuration messages from the extension UI and persist them in
// module state so manifest selection and network hooks always read the
// latest settings.
export function initConfigListener() {
  window.addEventListener('message', (event) => {
    if (event.source === window && event.origin === location.origin && event.data?.type === 'PMR_QUALITY_CONFIG' &&
        event.data.payload && typeof event.data.payload === 'object') {
      setConfig(event.data.payload);
    }
  });
}
