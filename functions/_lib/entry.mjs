import { createApi } from './core.mjs';
import { D1Store } from './d1-store.mjs';

export async function handleApi({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: "Cloudflare D1 binding 'DB' is not configured." }, { status: 503 });
  }
  return createApi({ store: new D1Store(env.DB), env })(request);
}
