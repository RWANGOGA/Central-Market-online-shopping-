export type PlaceKind = 'Region' | 'District' | 'City' | 'Municipality' | 'SubCounty' | 'Parish' | 'Village';

export type GeoNode = {
  id: number;
  name: string;
  kind: PlaceKind;
  centroid: { lat: number; lng: number } | null;
  bbox?: { south: number; west: number; north: number; east: number };
  hasGeometry: boolean;
  children: GeoNode[];
};

export type LevelAvailability = {
  level: string;
  count: number;
  geometryAvailable: boolean;
};

export type Hierarchy = {
  regions: GeoNode[];
  levels: LevelAvailability[];
  source: string;
};

/**
 * Fetch the administrative tree. Returns null when the API is unreachable so
 * the map can degrade to a plain message instead of appearing broken.
 */
export async function fetchHierarchy(signal?: AbortSignal): Promise<Hierarchy | null> {
  try {
    const response = await fetch('/api/geo/hierarchy', { signal });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      data: GeoNode[];
      meta: { levels: LevelAvailability[]; source: string };
    };

    return {
      regions: body.data,
      levels: body.meta.levels,
      source: body.meta.source,
    };
  } catch {
    return null;
  }
}

export type BoundaryStatus =
  | { state: 'loading' }
  | { state: 'ready'; geojson: GeoJSON.FeatureCollection }
  | { state: 'unavailable'; reason: string }
  | { state: 'error'; reason: string };

/**
 * Fetch boundary polygons for one level. Levels with no open dataset resolve to
 * 'unavailable' with the server's explanation, so the UI can say so plainly
 * instead of drawing an empty map that looks broken.
 */
export async function fetchBoundaries(level: 'regions' | 'districts', signal?: AbortSignal): Promise<BoundaryStatus> {
  try {
    const response = await fetch(`/api/geo/boundaries/${level}`, { signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { state: 'unavailable', reason: body?.error ?? `No boundaries for ${level}` };
    }
    return { state: 'ready', geojson: (await response.json()) as GeoJSON.FeatureCollection };
  } catch {
    return { state: 'error', reason: 'Could not reach the boundary service' };
  }
}

/** Walk a path of ids from the roots down to a single node. */
export function findNode(regions: GeoNode[], path: number[]): GeoNode | null {
  if (path.length === 0) return null;

  let level: GeoNode[] = regions;
  let node: GeoNode | null = null;

  for (const id of path) {
    node = level.find((candidate) => candidate.id === id) ?? null;
    if (!node) return null;
    level = node.children;
  }

  return node;
}

export function regionOf(regions: GeoNode[], path: number[]): GeoNode | null {
  return path.length > 0 ? (regions.find((r) => r.id === path[0]) ?? null) : null;
}

/** Human label for the current drill-down position, e.g. "Central / Kampala". */
export function describePath(regions: GeoNode[], path: number[]): string {
  if (path.length === 0) return 'All of Uganda';

  const names: string[] = [];
  let level: GeoNode[] = regions;

  for (const id of path) {
    const match = level.find((candidate) => candidate.id === id);
    if (!match) break;
    names.push(match.name);
    level = match.children;
  }

  return names.length > 0 ? names.join(' / ') : 'All of Uganda';
}

export type Bbox = [south: number, west: number, north: number, east: number];

/**
 * Convert a node's bounding box into Leaflet's corner form and pad it so the
 * shape is not flush against the viewport edge. Returning null when there is no
 * bbox lets the caller fall back to the centroid at a fixed zoom, which is what
 * sub-countries and below will need once they are populated.
 */
export function bboxOf(node: GeoNode | null, padRatio = 0.12): Bbox | null {
  if (!node?.bbox) return null;
  const { south, west, north, east } = node.bbox;
  const padLat = (north - south) * padRatio || 0.2;
  const padLng = (east - west) * padRatio || 0.2;
  return [south - padLat, west - padLng, north + padLat, east + padLng];
}
