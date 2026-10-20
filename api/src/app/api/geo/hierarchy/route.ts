import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { districts, parishes, regions, subCounties, villages, nowText } from '@/db/schema';
import { json } from '@/lib/http';

/**
 * The administrative hierarchy is served as one document because the client
 * drills through it rather than paging it, and because the whole tree for
 * Uganda is small once geometry is fetched separately.
 *
 * `geometryAvailable` is reported per level. Uganda's regions and districts
 * have real boundary polygons from geoBoundaries. Sub-counties, parishes and
 * villages have no open boundary dataset, so the client must not draw an
 * outline for them and present the empty result as a rendering failure.
 */
export async function GET() {
  const [allRegions, allDistricts, allSubCounties, allParishes, allVillages] =
    await Promise.all([
      db.select().from(regions).orderBy(asc(regions.name)),
      db.select().from(districts).orderBy(asc(districts.name)),
      db.select().from(subCounties).orderBy(asc(subCounties.name)),
      db.select().from(parishes).orderBy(asc(parishes.name)),
      db.select().from(villages).orderBy(asc(villages.name)),
    ]);

  const districtsByRegion = new Map<number, typeof allDistricts>();
  for (const district of allDistricts) {
    const bucket = districtsByRegion.get(district.regionId) ?? [];
    bucket.push(district);
    districtsByRegion.set(district.regionId, bucket);
  }

  const subCountiesByDistrict = new Map<number, typeof allSubCounties>();
  for (const sc of allSubCounties) {
    const bucket = subCountiesByDistrict.get(sc.districtId) ?? [];
    bucket.push(sc);
    subCountiesByDistrict.set(sc.districtId, bucket);
  }

  const parishesBySubCounty = new Map<number, typeof allParishes>();
  for (const p of allParishes) {
    const bucket = parishesBySubCounty.get(p.subCountyId) ?? [];
    bucket.push(p);
    parishesBySubCounty.set(p.subCountyId, bucket);
  }

  const villagesByParish = new Map<number, typeof allVillages>();
  for (const v of allVillages) {
    const bucket = villagesByParish.get(v.parishId) ?? [];
    bucket.push(v);
    villagesByParish.set(v.parishId, bucket);
  }

  const tree = allRegions.map((region) => ({
    id: region.id,
    name: region.name,
    isoCode: region.isoCode,
    kind: 'Region' as const,
    centroid: { lat: region.centroidLat, lng: region.centroidLng },
    bbox: {
      south: region.bboxSouth,
      west: region.bboxWest,
      north: region.bboxNorth,
      east: region.bboxEast,
    },
    hasGeometry: region.hasGeometry,
    children: (districtsByRegion.get(region.id) ?? []).map((district) => ({
      id: district.id,
      name: district.name,
      kind: district.kind,
      centroid: { lat: district.centroidLat, lng: district.centroidLng },
      bbox: {
        south: district.bboxSouth,
        west: district.bboxWest,
        north: district.bboxNorth,
        east: district.bboxEast,
      },
      hasGeometry: district.hasGeometry,
      children: (subCountiesByDistrict.get(district.id) ?? []).map((sc) => ({
        id: sc.id,
        name: sc.name,
        kind: 'SubCounty' as const,
        centroid:
          sc.centroidLat === null || sc.centroidLng === null
            ? null
            : { lat: sc.centroidLat, lng: sc.centroidLng },
        hasGeometry: sc.hasGeometry,
        children: (parishesBySubCounty.get(sc.id) ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          kind: 'Parish' as const,
          centroid:
            p.centroidLat === null || p.centroidLng === null
              ? null
              : { lat: p.centroidLat, lng: p.centroidLng },
          hasGeometry: p.hasGeometry,
          children: (villagesByParish.get(p.id) ?? []).map((v) => ({
            id: v.id,
            name: v.name,
            kind: 'Village' as const,
            centroid: null,
            hasGeometry: v.hasGeometry,
            children: [] as never[],
          })),
        })),
      })),
    })),
  }));

  const countAt = async (table: typeof regions | typeof districts | typeof subCounties | typeof parishes | typeof villages) =>
    (await db.select({ n: sql<number>`count(*)` }).from(table))[0]?.n ?? 0;

  return json({
    data: tree,
    meta: {
      levels: [
        { level: 'Region', label: 'regions', count: allRegions.length, geometryAvailable: allRegions.some((r) => r.hasGeometry) },
        { level: 'District', label: 'mapped areas', count: allDistricts.length, geometryAvailable: allDistricts.some((d) => d.hasGeometry) },
        { level: 'SubCounty', label: 'sub-counties', count: allSubCounties.length, geometryAvailable: allSubCounties.some((s) => s.hasGeometry) },
        { level: 'Parish', label: 'parishes', count: allParishes.length, geometryAvailable: allParishes.some((p) => p.hasGeometry) },
        { level: 'Village', label: 'villages', count: allVillages.length, geometryAvailable: allVillages.some((v) => v.hasGeometry) },
      ],
      // Kept for callers that just want the headline totals.
      regions: allRegions.length,
      districts: allDistricts.length,
      subCounties: await countAt(subCounties),
      parishes: await countAt(parishes),
      villages: await countAt(villages),
      source:
        'geoBoundaries gbOpen ADM1/ADM2. The ADM2 layer is not a clean district register: it mixes districts with sub-counties and omits 32 of the 40 largest districts, so treat it as mapped boundaries. Use UBOS for an authoritative district list.',
    },
  });
}