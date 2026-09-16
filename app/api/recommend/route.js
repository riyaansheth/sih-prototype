import { verifyBidder } from '../../../lib/engine.js';
import { recommend } from '../../../lib/ai.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('bidder');
  if (!id) return Response.json({ error: 'bidder query param required' }, { status: 400 });
  try {
    return Response.json(await recommend(await verifyBidder(id)));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
