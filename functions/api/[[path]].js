// Cloudflare Pages Functions entry point. Every request to /api/... lands here.
// The real logic is in src/core.mjs. Storage is the KV namespace bound as LAREDO.
import { createApi } from '../../src/core.mjs';
import { kvStore } from '../../src/kv.mjs';

const sharedMemberCache = new Map(); // keeps role checks quick between requests

export async function onRequest({ request, env }) {
  if (!env.LAREDO) {
    return new Response(JSON.stringify({ error: 'Storage is not connected. Add a KV binding named LAREDO to this Pages project (see README).' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
  const handle = createApi({ store: kvStore(env.LAREDO), env, memberCache: sharedMemberCache });
  return handle(request);
}
