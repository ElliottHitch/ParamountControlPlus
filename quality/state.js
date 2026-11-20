// Adapted from Paramount Quality+ (ISC). See NOTICE.md.
export function normalizeConfig(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const forcedHeight = Number.parseInt(source.forcedHeight, 10);
  const forcedBandwidth = Number(source.forcedBandwidth);
  return {
    forceMax: Boolean(source.forceMax),
    forcedHeight: Number.isFinite(forcedHeight) && forcedHeight > 0 ? forcedHeight : null,
    forcedBandwidth: Number.isFinite(forcedBandwidth) && forcedBandwidth > 0 ? forcedBandwidth : null
  };
}

let config = normalizeConfig();

let availableRepresentations = [];
let streamKey = null;

export function getConfig() {
  return config;
}

export function setConfig(newConfig) {
  config = normalizeConfig(newConfig);
}

export function getRepresentations() {
  return availableRepresentations;
}

export function setRepresentations(reps, key) {
  availableRepresentations = reps;
  streamKey = key;
}

export function getStreamKey() {
  return streamKey;
}
