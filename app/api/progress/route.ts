import { progressHandlers } from '../../../lib/skills/server';

export const dynamic = 'force-dynamic';
export function GET(request: Request) { return progressHandlers().GET(request); }
