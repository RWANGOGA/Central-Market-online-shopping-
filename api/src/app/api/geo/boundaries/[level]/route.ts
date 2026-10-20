import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Serves Uganda boundary polygons as GeoJSON.
 *
 * Only Region (ADM1) and District (ADM2) have real geometry. Sub-counties,
 * parishes and villages return 404 with an explanation rather than an empty
 * FeatureCollection, because an empty collection renders as a map that fails
 * to draw and looks like a bug.
 */

type Ctx = { params: Promise<{ level: string }> };

type FileInfo = { file: string; name: string; source: string };

const here = path.dirname(fileURLToPath(import.meta.url));
// this file lives at api/src/app/api/geo/boundaries/[level]/route.ts, so the
// api/ root is six levels up.
const geoRoot = path.resolve(here, '../../../../../../data/geo');

const LEVELS: Record<string, FileInfo> = {
  regions: {
    file: 'regions.geojson',
    name: 'Region',
    source: 'geoBoundaries gbOpen UGA ADM1',
  },
  districts: {
    file: 'districts.geojson',
    name: 'District',
    source: 'geoBoundaries gbOpen UGA ADM2',
  },
};

const MISSING_LEVELS: Record<string, string> = {
  subcounties:
    'Uganda sub-county boundaries are not available as an open dataset. geoBoundaries ADM3 for Uganda returns 137 features named after districts, so it is not sub-county data. Populate sub_counties from UBOS or OpenStreetMap, then add a boundary file.',
  parishes:
    'Parish boundaries are not published as an open dataset. Populate the parishes table from a district registry or OpenStreetMap admin_level boundaries, then add a boundary file.',
  villages:
    'Village boundaries do not exist as geographic outlines. Villages are addressed by name and landmark, overseen by the Local Council 1 chairperson, so this level is list-only by nature.',
};

function fail(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(_request: Request, { params }: Ctx) {
  const { level } = await params;
  const key = String(level).toLowerCase();

  const missing = MISSING_LEVELS[key];
  if (missing) return fail({ error: missing, level, geometryAvailable: false }, 404);

  const info = LEVELS[key];
  if (!info) {
    return fail(
      {
        error: `Unknown level "${level}".`,
        available: Object.keys(LEVELS),
      },
      400,
    );
  }

  const file = path.join(geoRoot, info.file);
  if (!file.startsWith(geoRoot + path.sep) || !fs.existsSync(file)) {
    return fail({ error: `No boundary file for ${info.name}` }, 404);
  }

  const body = fs.readFileSync(file);
  return new Response(body, {
    headers: {
      'content-type': 'application/geo+json',
      'content-length': String(body.byteLength),
      // Boundaries change on a district reorganisation, so cache briefly and
      // let a deploy invalidate it.
      'cache-control': 'public, max-age=3600',
      'x-geo-source': info.source,
      'x-geo-level': info.name,
    },
  });
}