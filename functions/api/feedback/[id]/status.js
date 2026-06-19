import { allowedStatuses, getDb, json, ensureFeedbackTable, requireAdmin, unauthorized } from '../_shared.js';

export async function onRequestPatch({ request, env, params }) {
  if (!requireAdmin(request, env)) return unauthorized();
  const db = getDb(env);
  if (!db) return json({ error: 'D1 binding is not configured.' }, { status: 500 });
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const status = payload && payload.status;
  if (!allowedStatuses.has(status)) return json({ error: 'Invalid status.' }, { status: 400 });
  if (!/^[a-f0-9-]{20,80}$/i.test(params.id || '')) return json({ error: 'Invalid id.' }, { status: 400 });
  await ensureFeedbackTable(db);
  await db.prepare('UPDATE feedback SET status = ? WHERE id = ?').bind(status, params.id).run();
  return json({ ok: true });
}
