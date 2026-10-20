/**
 * Top-down validation of a Ugandan administrative selection.
 *
 * The rule the whole app depends on: a child may only be selected if it is a
 * descendant of the parent already chosen. Picking Central Region and then a
 * district in Northern Region is not "corrected" by guessing which one the
 * user meant. It is rejected, naming the level that conflicts, because
 * silently substituting one for the other is how a delivery ends up in the
 * wrong region.
 *
 * The functions here are pure and take the hierarchy as an argument, so they
 * can be tested against a synthetic tree at any depth even while the lower
 * levels are still unpopulated.
 */

export type GeoKind = 'Region' | 'District' | 'City' | 'Municipality' | 'SubCounty' | 'Parish' | 'Village';

export type GeoNodeLite = {
  id: number;
  name: string;
  kind: string;
  children: GeoNodeLite[];
};

/** Canonical order. A selection may skip levels but may never reorder them. */
export const LEVEL_ORDER: GeoKind[] = [
  'Region',
  'District',
  'City',
  'Municipality',
  'SubCounty',
  'Parish',
  'Village',
];

/**
 * District, City, Municipality and Town are all children of a Region. They are
 * siblings, not successive levels, so they share one rank.
 */
export function rankOf(kind: string): number {
  switch (kind) {
    case 'District':
    case 'City':
    case 'Municipality':
    case 'Town':
      return 1;
    case 'SubCounty':
      return 2;
    case 'Parish':
      return 3;
    case 'Village':
      return 4;
    default:
      return 0;
  }
}

export type Selection = {
  region?: string | null;
  district?: string | null;
  subCounty?: string | null;
  parish?: string | null;
  village?: string | null;
};

export type LevelName = keyof Selection;

export const LEVEL_SEQUENCE: LevelName[] = ['region', 'district', 'subCounty', 'parish', 'village'];

export type ValidationOk = {
  ok: true;
  /** The deepest matched node, so the caller can centre a map on it. */
  node: GeoNodeLite;
  /** Every level that was matched, in top-down order. */
  resolved: { level: LevelName; id: number; name: string; kind: string }[];
  /** Levels that were left empty. */
  missing: LevelName[];
};

export type ValidationError = {
  ok: false;
  /** Which input conflicted, e.g. "district". */
  level: LevelName;
  /** The parent that was already fixed, e.g. "Central Region". */
  parentName: string;
  parentLevel: LevelName;
  /** What the user asked for. */
  requested: string;
  message: string;
};

export type Validation = ValidationOk | ValidationError;

/** "Kampala (City)" -> "Kampala"; also trims and collapses whitespace. */
export function normaliseName(name: string): string {
  return name
    .replace(/\s*\((?:City|Municipality|Town|District|Sub-?county|Parish|Village)\)\s*$/i, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function findChild(siblings: GeoNodeLite[], name: string): GeoNodeLite | undefined {
  const wanted = normaliseName(name).toLowerCase();
  return siblings.find((child) => normaliseName(child.name).toLowerCase() === wanted);
}

/**
 * Walk a selection from the region downwards, refusing any level whose parent
 * has not been chosen or does not contain it.
 *
 * A level may be skipped: choosing a district without naming its sub-county is
 * valid, because the lower levels are not populated yet. But once a level is
 * given, every level above it must be given too, and each must be a real
 * descendant of the one before.
 */
export function validateSelection(regions: GeoNodeLite[], selection: Selection): Validation {
  const resolved: ValidationOk['resolved'] = [];
  const missing: LevelName[] = [];

  // The region is matched against the root list, and every deeper level against
  // the children of the level above it. Handling the region separately keeps
  // the rest of the walk free of null checks: once a region is fixed there is
  // always a parent to descend from.
  const regionName = selection.region;

  if (!regionName || regionName.trim() === '') {
    // Report the first deeper level that was supplied, since that is what the
    // caller actually needs to fix.
    const firstDeeper = LEVEL_SEQUENCE.slice(1).find(
      (level) => selection[level] && selection[level]!.trim() !== '',
    );

    return {
      ok: false,
      level: 'region',
      parentName: 'Uganda',
      parentLevel: 'region',
      requested: firstDeeper ? selection[firstDeeper]! : '',
      message: firstDeeper
        ? `Choose a region before choosing a ${humanLevel(firstDeeper).toLowerCase()}.`
        : 'Choose a region.',
    };
  }

  const region = findChild(regions, regionName);

  if (!region) {
    return {
      ok: false,
      level: 'region',
      parentName: 'Uganda',
      parentLevel: 'region',
      requested: regionName,
      message: `"${regionName}" is not in Uganda. Choose one of: ${regions
        .slice(0, 12)
        .map((r) => r.name)
        .join(', ')}.`,
    };
  }

  resolved.push({ level: 'region', id: region.id, name: region.name, kind: region.kind });

  let current: GeoNodeLite = region;
  let currentLevel: LevelName = 'region';

  for (const level of LEVEL_SEQUENCE.slice(1)) {
    const raw = selection[level];

    if (!raw || raw.trim() === '') {
      missing.push(level);
      continue;
    }

    const child = findChild(current.children, raw);

    if (!child) {
      const names = current.children.map((c) => c.name);
      return {
        ok: false,
        level,
        parentName: current.name,
        parentLevel: currentLevel,
        requested: raw,
        message:
          names.length === 0
            ? `${current.name} has no ${pluralLevel(level)} recorded yet, so "${raw}" cannot be matched against it.`
            : `"${raw}" is not in ${current.name}. Choose one of: ${names.slice(0, 12).join(', ')}${names.length > 12 ? ', …' : ''}.`,
      };
    }

    // Guard against a mislabelled row that would otherwise let the walk jump
    // levels, e.g. a Region nested under a Region.
    if (rankOf(child.kind) <= rankOf(current.kind)) {
      return {
        ok: false,
        level,
        parentName: current.name,
        parentLevel: currentLevel,
        requested: raw,
        message: `"${child.name}" is recorded as a ${child.kind}, which is not below the level of ${current.name}. The hierarchy data is inconsistent.`,
      };
    }

    resolved.push({ level, id: child.id, name: child.name, kind: child.kind });
    current = child;
    currentLevel = level;
  }

  return { ok: true, node: current, resolved, missing };
}

function humanLevel(level: LevelName): string {
  switch (level) {
    case 'region':
      return 'Region';
    case 'district':
      return 'District';
    case 'subCounty':
      return 'Sub-county';
    case 'parish':
      return 'Parish';
    case 'village':
      return 'Village';
    default:
      return level;
  }
}

/** "no sub-counties recorded", not "no sub-countys". */
function pluralLevel(level: LevelName): string {
  switch (level) {
    case 'subCounty':
      return 'sub-counties';
    case 'district':
      return 'districts or towns';
    default:
      return `${humanLevel(level).toLowerCase()}s`;
  }
}

/**
 * Clear every level below the one that changed.
 *
 * This is what stops a stale selection surviving a parent change: choosing
 * Northern Region while a Central district is set must not leave that district
 * in place, because the pair is now invalid.
 */
export function clearBelow(selection: Selection, changedLevel: LevelName): Selection {
  const start = LEVEL_SEQUENCE.indexOf(changedLevel) + 1;
  const next: Selection = { ...selection };

  for (const level of LEVEL_SEQUENCE.slice(start)) {
    next[level] = '';
  }

  return next;
}

/**
 * Turn a hierarchy into the flat option lists a cascading select needs,
 * keeping only children of the given parent.
 */
export function childrenOf(
  regions: GeoNodeLite[],
  path: number[],
): { id: number; name: string; kind: string }[] {
  if (path.length === 0) return regions.map(toOption);
  return descend(regions, path)?.children.map(toOption) ?? [];
}

function descend(regions: GeoNodeLite[], path: number[]): GeoNodeLite | null {
  let level = regions;
  let node: GeoNodeLite | null = null;

  for (const id of path) {
    node = level.find((candidate) => candidate.id === id) ?? null;
    if (!node) return null;
    level = node.children;
  }

  return node;
}

function toOption(node: GeoNodeLite) {
  return { id: node.id, name: node.name, kind: node.kind };
}