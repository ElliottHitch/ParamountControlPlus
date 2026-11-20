// Adapted manifest discovery from Paramount Quality+ (ISC). See NOTICE.md.
// Selection changes the manifest view only; every media URL remains original.
import { getConfig, setRepresentations, getRepresentations, getStreamKey } from './state.js';
import { classifyMediaRequest, deriveStreamKey, getHlsTier,
  isAdReference, resolveVariantUrl } from './stream-model.js';
import { selectManifestEntries, videoCodecFamily } from './manifest-policy.js';

function unchanged(text, reason = 'unsupported', selection = false) {
  return { text, changed: false, selection, policy: { applied: false, reason } };
}

function publishQualities(qualities, requestUrl) {
  const streamKey = deriveStreamKey(requestUrl);
  if (streamKey !== getStreamKey()) {
    window.postMessage({ type: 'PMR_QUALITY_STREAM_RESET' }, location.origin);
  }
  const available = qualities.filter(({ height, bandwidth }) =>
    Number.isFinite(height) && height > 0 && Number.isFinite(bandwidth) && bandwidth > 0);
  setRepresentations(available, streamKey);
  window.postMessage({
    type: 'PMR_QUALITY_MANIFEST_DATA',
    payload: available.map(({ height, bandwidth }) => ({ height, bandwidth }))
  }, location.origin);
}

function attribute(attrs, name) {
  // A quoted CODECS value contains commas, so do not split the attribute list.
  return attrs.match(new RegExp(`(?:^|,)${name}=(?:"([^"]*)"|([^,]*))`))?.slice(1).find(value => value !== undefined) || null;
}

export function parseHlsManifest(content, requestUrl, config = getConfig()) {
  const lines = content.split('\n');
  const entries = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
    const attrs = line.slice('#EXT-X-STREAM-INF:'.length);
    let uriIndex = index + 1;
    while (uriIndex < lines.length && (!lines[uriIndex].trim() ||
      (lines[uriIndex].trim().startsWith('#') && !lines[uriIndex].trim().startsWith('#EXT')))) uriIndex++;
    if (uriIndex >= lines.length || lines[uriIndex].trim().startsWith('#')) return unchanged(content, 'malformed', true);
    const variantUrl = resolveVariantUrl(lines[uriIndex].trim(), requestUrl);
    const resolution = attribute(attrs, 'RESOLUTION')?.match(/^(\d+)x(\d+)$/);
    const codecs = attribute(attrs, 'CODECS');
    const audioGroup = attribute(attrs, 'AUDIO');
    const videoGroup = attribute(attrs, 'VIDEO');
    const videoRange = attribute(attrs, 'VIDEO-RANGE');
    const request = classifyMediaRequest(variantUrl);
    const hlsTier = getHlsTier(variantUrl);
    const quality = {
      height: Number(resolution?.[2]) || 0, bandwidth: Number(attribute(attrs, 'BANDWIDTH')) || 0,
      codecs, mimeType: 'video/mp4', variantUrl,
      hlsTier, daiId: variantUrl?.match(/\/variant\/([^/]+)\//)?.[1] || null,
      compatibilityKey: JSON.stringify([videoCodecFamily(codecs), audioGroup, videoGroup, videoRange]),
      isAd: request.isAd
    };
    entries.push({ quality, index, uriIndex });
  }
  if (!entries.length) {
    // Media playlists, keys and segments reach the player without alteration.
    const current = getRepresentations().find(q => q.variantUrl === requestUrl);
    if (current) window.postMessage({ type: 'PMR_QUALITY_ACTIVE_QUALITY', payload: {
      resolution: `${current.height}p`, bitrate: current.bandwidth / 1000,
      bitrateSource: 'manifest', timestamp: Date.now()
    } }, location.origin);
    return unchanged(content, 'media-playlist');
  }
  const programEntries = entries.filter(entry => !entry.quality.isAd);
  publishQualities(programEntries.map(entry => entry.quality), requestUrl);
  const policy = selectManifestEntries(programEntries, config);
  const removed = new Set();
  for (const entry of programEntries) {
    if (!policy.keep.has(entry)) { removed.add(entry.index); removed.add(entry.uriIndex); }
  }
  return {
    text: removed.size ? lines.filter((_, index) => !removed.has(index)).join('\n') : content,
    changed: removed.size > 0, selection: true, policy: { applied: policy.applied, reason: policy.reason }
  };
}

function directChildren(node, name) {
  return Array.from(node?.children || []).filter(child => child.localName === name);
}

function ancestor(node, name) {
  for (let current = node.parentElement; current; current = current.parentElement) {
    if (current.localName === name) return current;
  }
  return null;
}

function directBase(node) {
  return directChildren(node, 'BaseURL')[0]?.textContent.trim() || '';
}

function isPreview(node) {
  if (/(?:^|[-_])(?:thumbnail|thumb|trickmode|trickplay)(?:[-_]|$)/i.test(node.getAttribute('id') || '')) return true;
  return ['EssentialProperty', 'SupplementalProperty', 'Role'].some(name =>
    Array.from(node.getElementsByTagNameNS('*', name)).some(property =>
      /trickmode|thumbnail_tile/i.test(property.getAttribute('schemeIdUri') || '') ||
      /^(thumbnail|thumb|trickmode|trickplay)$/i.test(property.getAttribute('value') || '')));
}

export function parseDashManifest(content, requestUrl, config = getConfig()) {
  const xml = new DOMParser().parseFromString(content, 'application/xml');
  if (xml.documentElement?.localName !== 'MPD' || xml.getElementsByTagName('parsererror').length || xml.doctype) {
    return unchanged(content, 'malformed', true);
  }
  const entries = [];
  const serializer = new XMLSerializer();
  const sets = Array.from(xml.getElementsByTagNameNS('*', 'AdaptationSet'));
  for (let setIndex = 0; setIndex < sets.length; setIndex++) {
    const set = sets[setIndex];
    if (isPreview(set)) continue;
    const period = ancestor(set, 'Period');
    const periodId = period?.getAttribute('id') || '';
    const periodIsAd = /(?:^|[-_])(?:pre|mid|post)[-_]?roll|(?:^|[-_])ad(?:vertisement)?(?:[-_]|$)/i.test(periodId) ||
      isAdReference(directBase(period));
    const inheritedTemplate = directChildren(set, 'SegmentTemplate')[0];
    const dependent = directChildren(set, 'Representation').some(node =>
      node.hasAttribute('dependencyId') || node.hasAttribute('associationId')) ||
      Array.from(set.getElementsByTagNameNS('*', 'EssentialProperty')).some(node =>
        /srd|tile|dependency/i.test(node.getAttribute('schemeIdUri') || ''));
    for (const node of directChildren(set, 'Representation')) {
      const mimeType = node.getAttribute('mimeType') || set.getAttribute('mimeType') || '';
      const contentType = node.getAttribute('contentType') || set.getAttribute('contentType') || '';
      const codecs = node.getAttribute('codecs') || set.getAttribute('codecs') || '';
      if (/audio|image|text/i.test(`${mimeType} ${contentType}`) || isPreview(node)) continue;
      if (!/video/i.test(`${mimeType} ${contentType}`) && !videoCodecFamily(codecs)) continue;
      const rawId = node.getAttribute('id');
      const baseUrl = directBase(node) || directBase(set);
      const template = directChildren(node, 'SegmentTemplate')[0] || inheritedTemplate;
      const media = template?.getAttribute('media') || inheritedTemplate?.getAttribute('media') || null;
      const initialization = template?.getAttribute('initialization') || inheritedTemplate?.getAttribute('initialization') || null;
      const isAd = periodIsAd || [baseUrl, media, initialization, rawId].some(isAdReference);
      // Never join AdaptationSets or protection groups, even for the same title.
      const protection = directChildren(node, 'ContentProtection').map(value => serializer.serializeToString(value));
      const directory = [baseUrl, media, rawId].filter(Boolean).map(value =>
        value.split('/').filter(Boolean).findLast(part => /_\d{2,6}$/.test(part))).find(Boolean) || null;
      const bandwidth = Number(node.getAttribute('bandwidth')) || 0;
      const quality = {
        dashTier: directory?.match(/_(\d{2,6})$/)?.[1] || null,
        height: Number(node.getAttribute('height') || set.getAttribute('height')) || 0,
        bandwidth, codecs, mimeType: mimeType || 'video/mp4', isAd, dependent,
        compatibilityKey: JSON.stringify([setIndex, videoCodecFamily(codecs), protection])
      };
      entries.push({ quality, node });
    }
  }
  const programEntries = entries.filter(entry => !entry.quality.isAd);
  if (!programEntries.length) return unchanged(content, 'non-program-manifest');
  publishQualities(programEntries.map(entry => entry.quality), requestUrl);
  const policy = selectManifestEntries(programEntries, config);
  if (policy.changed) {
    for (const entry of programEntries) if (!policy.keep.has(entry)) entry.node.remove();
  }
  return {
    text: policy.changed ? serializer.serializeToString(xml) : content,
    changed: policy.changed, selection: true, policy: { applied: policy.applied, reason: policy.reason }
  };
}

export function parseManifest(content, requestUrl, config = getConfig()) {
  if (typeof content !== 'string') return unchanged(content);
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith('#EXTM3U')) return parseHlsManifest(content, requestUrl, config);
    if (trimmed.startsWith('<')) return parseDashManifest(content, requestUrl, config);
    return unchanged(content, 'malformed', true);
  } catch {
    return unchanged(content, 'unsupported', true);
  }
}
