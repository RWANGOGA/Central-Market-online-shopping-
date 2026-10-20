import { error } from '@/lib/http';

/** Customer creation and lookup are not public API operations. */
export function GET(_request: Request) {
  return error('Not found', 404);
}

export function POST(_request: Request) {
  return error('Not found', 404);
}
