import { db } from '@/db';
import { districts, regions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateSelection, type GeoNodeLite } from '@/lib/geoValidate';

/**
 * Server-side guard for any payload that carries an administrative location.
 *
 * The client cascade stops a shopper picking Central Region with a Northern
 * district, but a client is not a security boundary. Anything persisted or used
 * to route a delivery goes through here first, so an inconsistent pair is
 * rejected at the edge rather than silently corrected.
 */

export type LocationInput = {
  region?: string | null;
  district?: string | null;
  subCounty?: string | null;
  parish?: string | null;
  village?: string | null;
};

export type LocationCheck =
  | { ok: true; region: string; district: string | null; subCounty: string | null; parish: string | null; village: string | null }
  | { ok: false; message: string; level: string };

/** Builds the region -> district -> … tree once per request. */
export async function loadGeoTree(): Promise<GeoNodeLite[]> {
  const [allRegions, allDistricts] = await Promise.all([
    db.select().from(regions),
    db.select().from(districts),
  ]);

  const byRegion = new Map<number, typeof allDistricts>();
  for (const district of allDistricts) {
    byRegion.set(district.regionId, [...(byRegion.get(district.regionId) ?? []), district]);
  }

  return allRegions.map((region) => ({
    id: region.id,
    name: region.name,
    kind: 'Region',
    children: (byRegion.get(region.id) ?? []).map((district) => ({
      id: district.id,
      name: district.name,
      kind: district.kind,
      // Sub-counties and below are not populated yet. Returning an empty list
      // here is what makes validation reject a sub-county name rather than
      // accept an unverifiable one.
      children: [],
    })),
  }));
}

export async function checkLocation(input: LocationInput): Promise<LocationCheck> {
  if (!input.region || !input.region.trim()) {
    return { ok: false, level: 'region', message: 'A region is required.' };
  }

  const tree = await loadGeoTree();
  const result = validateSelection(tree, {
    region: input.region,
    district: input.district ?? '',
    subCounty: input.subCounty ?? '',
    parish: input.parish ?? '',
    village: input.village ?? '',
  });

  if (!result.ok) {
    return { ok: false, level: result.level, message: result.message };
  }

  const at = (level: string) =>
    result.resolved.find((entry) => entry.level === level)?.name ?? null;

  return {
    ok: true,
    region: input.region.trim(),
    district: at('district'),
    subCounty: at('subCounty'),
    parish: at('parish'),
    village: at('village'),
  };
}

/** Region a district id belongs to, for callers holding ids rather than names. */
export async function regionNameForDistrict(districtId: number): Promise<string | null> {
  const row = await db
    .select({ regionName: regions.name })
    .from(districts)
    .innerJoin(regions, eq(districts.regionId, regions.id))
    .where(eq(districts.id, districtId))
    .limit(1);

  return row[0]?.regionName ?? null;
}
