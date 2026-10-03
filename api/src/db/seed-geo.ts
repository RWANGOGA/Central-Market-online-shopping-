import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { districts, regions } from './schema';
import { db } from './index';

/**
 * Regions and districts come from api/data/geo/places.json, which is derived
 * from geoBoundaries gbOpen ADM1 and ADM2 (public domain). Centroids and
 * bounding boxes are precomputed there so seeding stays a plain insert.
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

type PlacesFile = {
  regions: SeedRegion[];
  districts: SeedDistrict[];
};

function readPlaces(): PlacesFile {
  // Seed runs from the api/ directory via npm scripts, but resolve from this
  // file so it works regardless of the caller's cwd. fileURLToPath is needed
  // because the project path contains spaces, which pathname leaves encoded.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(here, '../../data/geo/places.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PlacesFile;
}

async function seedGeo() {
  const { regions: regionRows, districts: districtRows } = readPlaces();

  console.log(`Seeding ${regionRows.length} regions and ${districtRows.length} districts...`);

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

  const districtCount = await db.select().from(districts);
  console.log(`Done. ${allRegions.length} regions, ${districtCount.length} districts in the database.`);
}

seedGeo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Geo seed failed:', err);
    process.exit(1);
  });