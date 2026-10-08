/** Bounded, deterministic spatial sampling for display only; never changes allocation results. */
export const MAP_MARKER_LIMIT = 1500;
export const MAP_ROUTE_LIMIT = 1200;

function validLocation(item) {
  const p = item?.location;
  return Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

/** Select across spatial bins, keeping the map useful when records are ordered by region. */
export function sampleMapPoints(items, limit = MAP_MARKER_LIMIT) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('limit must be a nonnegative integer');
  if (limit === 0) return [];
  const valid = items.filter(validLocation);
  if (valid.length <= limit) return valid;
  const gridSize = Math.max(1, Math.ceil(Math.sqrt(limit)));
  const buckets = new Map();
  for (const item of valid) {
    const latBin = Math.min(gridSize - 1, Math.floor((item.location.lat + 90) / 180 * gridSize));
    const lngBin = Math.min(gridSize - 1, Math.floor((item.location.lng + 180) / 360 * gridSize));
    const key = `${latBin}:${lngBin}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  const groups = [...buckets.values()];
  const picked = [];
  let row = 0;
  // Round-robin ensures spread even when many points occupy a single region.
  while (picked.length < limit) {
    let added = false;
    for (const group of groups) {
      if (row < group.length) {
        picked.push(group[row]);
        added = true;
        if (picked.length === limit) break;
      }
    }
    if (!added) break;
    row++;
  }
  return picked;
}

/** Uniformly samples route records without changing the source array or assignments. */
export function sampleMapRoutes(assignments, limit = MAP_ROUTE_LIMIT) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('limit must be a nonnegative integer');
  if (limit === 0) return [];
  if (assignments.length <= limit) return assignments;
  const output = [];
  for (let i = 0; i < limit; i++) output.push(assignments[Math.floor(i * assignments.length / limit)]);
  return output;
}
