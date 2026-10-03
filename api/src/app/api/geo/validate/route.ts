import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { districts, parishes, regions, subCounties, villages } from '@/db/schema';
import { error, json } from '@/lib/http';
import {
  LEVEL_SEQUENCE,
  clearBelow,
  validateSelection,
  type GeoNodeLite,
  type LevelName,
  type Selection,
} from '@/lib/geoValidate';

/**
 * Loads the whole tree and answers three questions the client needs for a
 * cascading select:
 *
 *   /api/geo/children?path=3,17   what may follow this parent, and nothing else
 *   /api/geo/validate?region=…    is this whole selection internally consistent
 *   /api/geo/validate (POST)      the same check for a cascading state object
 *
 * The server is the authority. The client filters optimistically for a
 * responsive UI, but a selection is only ever accepted once it has passed
 * through here, so a hand-crafted request cannot place a Central order in the
 * Northern Region.
 */

type Tree = GeoNodeLite[];

async function loadTree(): Promise<Tree> {
  const [allRegions, allDistricts, allSubCounties, allParishes, allVillages] = await Promise.all([
    db.select().from(regions).orderBy(asc(regions.name)),
    db.select().from(districts).orderBy(asc(districts.name)),
    db.select().from(subCounties).orderBy(asc(subCounties.name)),
    db.select().from(parishes).orderBy(asc(parishes.name)),
    db.select().from(villages).orderBy(asc(villages.name)),
  ]);

  const group = <T>(rows: T[], key: (row: T) => number) => {
    const map = new Map<number, T[]>();
    for (const row of rows) {
      const k = key(row);
      map.set(k, [...(map.get(k) ?? []), row]);
    }
    return map;
  };

  const districtsByRegion = group(allDistricts, (d) => d.regionId);
  const subCountiesByDistrict = group(allSubCounties, (s) => s.districtId);
  const parishesBySubCounty = group(allParishes, (p) => p.subCountyId);
  const villagesByParish = group(allVillages, (v) => v.parishId);

  return allRegions.map((region) => ({
    id: region.id,
    name: region.name,
    kind: 'Region',
    children: (districtsByRegion.get(region.id) ?? []).map((district) => ({
      id: district.id,
      name: district.name,
      kind: district.kind,
      children: (subCountiesByDistrict.get(district.id) ?? []).map((sub) => ({
        id: sub.id,
        name: sub.name,
        kind: 'SubCounty',
        children: (parishesBySubCounty.get(sub.id) ?? []).map((parish) => ({
          id: parish.id,
          name: parish.name,
          kind: 'Parish',
          children: (villagesByParish.get(parish.id) ?? []).map((village) => ({
            id: village.id,
            name: village.name,
            kind: 'Village',
            children: [],
          })),
        })),
      })),
    })),
  }));
}

function readSelection(params: URLSearchParams): Selection {
  const selection: Selection = {};
  for (const level of LEVEL_SEQUENCE) {
    const value = params.get(level);
    if (value !== null) selection[level] = value;
  }
  return selection;
}

/**
 * GET for a one-shot check, POST for a cascading state object that carries the
 * full selection so the client can clear descendants server-side.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Cascading options for one parent. Only ids are accepted, never names, so a
  // caller cannot smuggle a level past the tree by naming it.
  const path = url.searchParams.get('path');
  if (path !== null) {
    const ids = path
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (ids.length === 0) {
      return json({ data: [], meta: { parent: null, path: [] } });
    }

    const tree = await loadTree();
    let level = tree;
    let parent: GeoNodeLite | null = null;

    for (const id of ids) {
      parent = level.find((node) => node.id === id) ?? null;
      if (!parent) {
        return error(`No node with id ${id} at that depth`, 404);
      }
      level = parent.children;
    }

    if (!parent) return error('No node with id 0 at that depth', 404);

    return json({
      data: level.map((node) => ({
        id: node.id,
        name: node.name,
        kind: node.kind,
        hasChildren: node.children.length > 0,
      })),
      meta: {
        parent: { id: parent.id, name: parent.name, kind: parent.kind },
        path: ids,
        nextLevel: level.length > 0 ? level[0].kind : null,
      },
    });
  }

  const selection = readSelection(url.searchParams);
  if (!selection.region) return error('Query parameter "region" is required', 400);

  const tree = await loadTree();
  const result = validateSelection(tree, selection);

  if (!result.ok) return json({ error: result.message, conflict: result }, { status: 422 });

  return json({ data: result });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    selection?: Selection;
    changedLevel?: LevelName;
  } | null;

  if (!body?.selection || typeof body.selection !== 'object') {
    return error('Body must include a selection object', 400);
  }

  const tree = await loadTree();

  // When the client reports which level the user just changed, clear
  // everything below it first. This is the authoritative version of the rule
  // the UI applies locally, so a stale child can never survive a parent change
  // even if the client did not clear it.
  const selection =
    body.changedLevel && LEVEL_SEQUENCE.includes(body.changedLevel)
      ? clearBelow(body.selection, body.changedLevel)
      : body.selection;

  const result = validateSelection(tree, selection);

  if (!result.ok) return json({ error: result.message, conflict: result }, { status: 422 });

  return json({ data: { ...result, selection } });
}