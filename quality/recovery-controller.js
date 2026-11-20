// Local recovery for failures after a modified manifest reached the player.
import { getConfig, setConfig } from './state.js';

export function createRecoveryController({ postRecovery }) {
  let applied = false;
  let requested = false;
  function markApplied() { applied = true; }
  function requestRecovery() {
    const config = getConfig();
    if (!applied || requested || (!config.forceMax && !config.forcedHeight)) return false;
    requested = true;
    setConfig({});
    postRecovery();
    return true;
  }
  function reset() { applied = false; requested = false; }
  return { markApplied, requestRecovery, reset };
}
