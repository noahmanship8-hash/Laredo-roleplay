// Lets core.mjs use a Cloudflare KV namespace as its storage.
export function kvStore(kv) {
  return {
    async get(key) { return kv.get(key, 'json'); },
    async setJSON(key, value) { await kv.put(key, JSON.stringify(value)); },
    async delete(key) { await kv.delete(key); },
    async list({ prefix = '' } = {}) {
      const blobs = [];
      let cursor;
      do {
        const page = await kv.list({ prefix, cursor, limit: 1000 });
        for (const k of page.keys) blobs.push({ key: k.name });
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return { blobs };
    }
  };
}
