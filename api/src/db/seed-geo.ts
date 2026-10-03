import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { districts, regions } from './schema';
import { db } from './index';

/**
 * Regions and districts come from api/data/geo/places.json, which is derived
 * from geoBoundaries gbOpen ADM1 and ADM2 (public domain). Centroids and
 * bounding boxes are precomputed there so seeding stays a plain insert.
 *
 * One caveat worth carrying forward: geoBoundaries' ADM2 for Uganda is not a
 * clean district layer. It mixes whole districts with sub-counties, and 32 of
 * the 40 largest districts and cities are absent, though the sub-counties
 * inside them are present. Gulu, Mbale, Jinja and Mbarara are missing as
 * districts while Dodoth, Chua and Bungokho appear in their place.
 *
 * api/data/geo/town-centres.json fills those gaps with approximate
 * headquarters coordinates. Those places are seeded into the same districts
 * table with hasGeometry false, so the hierarchy a customer selects from and
 * the hierarchy the validator checks are the same tree. Without this, a
 * district offered by the checkout dropdown could be rejected by validation as
 * belonging to no region at all.
 *
 * Use UBOS for an authoritative district register; the mapped-area rows should
 * be reconciled against it before this drives a real delivery operation.
 */

type SeedRegion = {
  name: string;
  iso: string | null;
  centroid: [number, number];
  bbox: [number, number, number, number];
};

type SeedDistrict = {
  name: string;
  kind: 'District' | 'City' | 'Municipality';
  centroid: [number, number];
  bbox: [number, number, number, number];
  region: string;
  assignedByNearestRegion?: boolean;
};

type TownCentre = { name: string; region: string; lat: number; lng: number };

type PlacesFile = {
  regions: SeedRegion[];
  districts: SeedDistrict[];
};

type TownCentresFile = {
  _comment?: string;
  places: TownCentre[];
};

function readJson<T>(relativePath: string): T {
  // Seed runs from the api/ directory via npm scripts, but resolve from this
  // file so it works regardless of the caller's cwd. fileURLToPath is needed
  // because the project path contains spaces, which pathname leaves encoded.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(here, relativePath);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/**
 * A town centre has no outline, so give it a small bounding box around the
 * point. That keeps bboxOf working for map framing while hasGeometry stays
 * false, so nothing ever draws a polygon that does not exist.
 */
const TOWN_HALF_SPAN_DEG = 0.12;

function bboxAround(lat: number, lng: number): [number, number, number, number] {
  return [
    +(lat - TOWN_HALF_SPAN_DEG).toFixed(4),
    +(lng - TOWN_HALF_SPAN_DEG).toFixed(4),
    +(lat + TOWN_HALF_SPAN_DEG).toFixed(4),
    +(lng + TOWN_HALF_SPAN_DEG).toFixed(4),
  ];
}

async function seedGeo() {
  const { regions: regionRows, districts: districtRows } = readJson<PlacesFile>(
    '../../data/geo/places.json',
  );
  const townCentres = readJson<TownCentresFile>('../../data/geo/town-centres.json').places ?? [];

  console.log(
    `Seeding ${regionRows.length} regions, ${districtRows.length} mapped districts and ${townCentres.length} town centres...`,
  );

  const insertedRegions = await db
    .insert(regions)
    .values(
      regionRows.map((r) => ({
        name: r.name,
        isoCode: r.iso,
        centroidLat: r.centroid[1],
        centroidLng: r.centroid[0],
        bboxSouth: r.bbox[1],
        bboxWest: r.bbox[0],
        bboxNorth: r.bbox[3],
        bboxEast: r.bbox[2],
        hasGeometry: true,
      })),
    )
    .onConflictDoNothing()
    .returning();

  // onConflictDoNothing returns nothing when the rows already exist, so fall
  // back to reading them back to build the id map for seeding districts.
  const allRegions =
    insertedRegions.length > 0 ? insertedRegions : await db.select().from(regions);

  const regionIdByName = new Map(allRegions.map((r) => [r.name, r.id]));

  const values = districtRows
    .map((d) => {
      const regionId = regionIdByName.get(d.region);
      if (!regionId) return null;
      return {
        name: d.name,
        kind: d.kind,
        regionId,
        centroidLat: d.centroid[1],
        centroidLng: d.centroid[0],
        bboxSouth: d.bbox[1],
        bboxWest: d.bbox[0],
        bboxNorth: d.bbox[3],
        bboxEast: d.bbox[2],
        hasGeometry: true,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  await db.insert(districts).values(values).onConflictDoNothing();

  // Town centres fill the districts the boundary layer omits. Marked as Towns
  // with no geometry, and skipped where a mapped row of the same name already
  // exists so the boundary data always wins.
  const mapped = new Set(districtRows.map((d) => d.name.toLowerCase()));
  const townValues = townCentres
    .filter((t) => !mapped.has(t.name.toLowerCase()))
    .map((t) => {
      const regionId = regionIdByName.get(t.region);
      if (!regionId) return null;
      const [south, west, north, east] = bboxAround(t.lat, t.lng);
      return {
        name: t.name,
        kind: 'Town' as const,
        regionId,
        centroidLat: t.lat,
        centroidLng: t.lng,
        bboxSouth: south,
        bboxWest: west,
        bboxNorth: north,
        bboxEast: east,
        hasGeometry: false,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (townValues.length > 0) {
    await db.insert(districts).values(townValues).onConflictDoNothing();
  }

  const districtCount = await db.select().from(districts);
  const withGeometry = districtCount.filter((d) => d.hasGeometry).length;
  console.log(
    `Done. ${allRegions.length} regions, ${districtCount.length} districts (${withGeometry} with outlines, ${districtCount.length - withGeometry} town centres).`,
  );
}

seedGeo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Geo seed failed:', err);
    process.exit(1);
  });