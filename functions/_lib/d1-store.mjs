// Small JSON key/value adapter backed by Cloudflare D1.
// It keeps the existing API logic independent from the hosting platform.

const ready = new WeakSet();
const pending = new WeakMap();

async function ensureTable(db) {
  if (ready.has(db)) return;
  let setup = pending.get(db);
  if (!setup) {
    setup = db.prepare(`
      CREATE TABLE IF NOT EXISTS laredo_data (
        storage_key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run().then(() => ready.add(db)).finally(() => pending.delete(db));
    pending.set(db, setup);
  }
  await setup;
}

export class D1Store {
  constructor(db) {
    this.db = db;
  }

  async get(key) {
    await ensureTable(this.db);
    const row = await this.db.prepare(
      'SELECT value_json FROM laredo_data WHERE storage_key = ?'
    ).bind(key).first();
    return row ? JSON.parse(row.value_json) : null;
  }

  async setJSON(key, value) {
    await ensureTable(this.db);
    await this.db.prepare(`
      INSERT INTO laredo_data (storage_key, value_json)
      VALUES (?, ?)
      ON CONFLICT(storage_key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = CURRENT_TIMESTAMP
    `).bind(key, JSON.stringify(value)).run();
  }

  async delete(key) {
    await ensureTable(this.db);
    await this.db.prepare('DELETE FROM laredo_data WHERE storage_key = ?').bind(key).run();
  }

  async list({ prefix = '' } = {}) {
    await ensureTable(this.db);
    const result = await this.db.prepare(`
      SELECT storage_key FROM laredo_data
      WHERE substr(storage_key, 1, length(?)) = ?
      ORDER BY storage_key
    `).bind(prefix, prefix).all();
    return { blobs: (result.results || []).map((row) => ({ key: row.storage_key })) };
  }
}
