import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { districts, regions } from '@/db/schema';
import { error, json } from '@/lib/http';

/**
 * Resolve a place name typed at checkout into coordinates.
 *
 * Order of preference:
 *  1. the seeded boundary data, which gives a real centroid, a bounding box and
 *     a real polygon outline
 *  2. the town-centre fallback table, for the districts the ADM2 layer omits
 *
 * The checkout form stores the district with its kind attached, as in
 * "Kampala (City)", so the suffix is stripped before matching.
 */

type TownCentre = { name: string; region: string; lat: number; lng: number };

let townCentres: TownCentre[] | null = null;

function loadTownCentres(): TownCentre[] {
  if (townCentres) return townCentres;

  // this file lives at api/src/app/api/geo/locate/route.ts, so the api/ root is
  // five levels up.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(here, '../../../../../data/geo/town-centres.json');

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { places: TownCentre[] };
    townCentres = parsed.places;
  } catch (err) {
    // A missing fallback table should degrade to "unresolved", not take the
    // route down with a 500.
    console.error('geo/locate: could not read the town-centre table', err);
    townCentres = [];
  }

  return townCentres;
}

/** "Kampala (City)" -> "Kampala" */
function normalise(name: string) {
  return name.replace(/\s*\((?:City|Municipality|Town|District)\)\s*$/i, '').trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPlace = url.searchParams.get('place')?.trim();
  const rawRegion = url.searchParams.get('region')?.trim() ?? null;

  if (!rawPlace) return error('Query parameter "place" is required', 400);

  const place = normalise(rawPlace);

  const regionRow = rawRegion
    ? await db.query.regions.findFirst({ where: eq(regions.name, rawRegion) })
    : null;

  // Region names by id, so a rejection can say where the district actually is.
  const allRegions = await db.select({ id: regions.id, name: regions.name }).from(regions);
  const regionNameById = new Map(allRegions.map((r) => [r.id, r.name]));
  const regionOf = (id: number) => regionNameById.get(id) ?? 'another region';

  // A named region that does not exist is a hard error. Guessing would place a
  // delivery in the wrong region.
  if (rawRegion && !regionRow) {
    return error(`Unknown region "${rawRegion}".`, 422);
  }

  const candidates = await db.select().from(districts).where(eq(districts.name, place));

  // When a region was supplied, only a district inside that region will do.
  // Previously this fell back to any candidate, which meant Central Region plus
  // a Northern district silently resolved to the Northern district.
  const district = regionRow
    ? candidates.find((d) => d.regionId === regionRow.id)
    : candidates[0];

  if (rawRegion && candidates.length > 0 && !district) {
    const recorded = candidates
      .map((d) => `${d.name} (${regionOf(d.regionId) ?? 'another region'})`)
      .join(', ');
    return error(
      `"${place}" is not in ${rawRegion}. It is recorded as ${recorded}. Check that the district and region belong together.`,
      422,
    );
  }

  if (district) {
    return json({
      data: {
        name: district.name,
        kind: district.kind,
        region: rawRegion,
        centroid: { lat: district.centroidLat, lng: district.centroidLng },
        bbox: {
          south: district.bboxSouth,
          west: district.bboxWest,
          north: district.bboxNorth,
          east: district.bboxEast,
        },
        source: 'boundary',
        // True means an outline can be drawn, not that the address is known.
        hasOutline: district.hasGeometry,
        precision: 'district-centroid',
      },
    });
  }

  const centre = loadTownCentres().find(
    (t) => t.name.toLowerCase() === place.toLowerCase() && (!rawRegion || t.region === rawRegion),
  );

  if (rawRegion && !centre && candidates.length === 0) {
    return error(
      `"${place}" is not recorded in ${rawRegion}. Check that the district and region belong together.`,
      422,
    );
  }

  if (centre) {
    return json({
      data: {
        name: centre.name,
        kind: 'Town',
        region: centre.region,
        centroid: { lat: centre.lat, lng: centre.lng },
        bbox: null,
        source: 'town-centre',
        hasOutline: false,
        precision: 'town-centre',
      },
    });
  }

  return json(
    {
      error: `Could not resolve "${rawPlace}".`,
      // The client falls back to the region, or to a country-wide view.
      fallback: 'region',
    },
    { status: 404 },
  );
}
