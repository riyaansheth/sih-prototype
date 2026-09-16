import { verifyBidder } from '../../../lib/engine.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('bidder');
  if (!id) return Response.json({ error: 'bidder query param required' }, { status: 400 });
  try {
    return Response.json(await verifyBidder(id));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 404 });
  }
}
