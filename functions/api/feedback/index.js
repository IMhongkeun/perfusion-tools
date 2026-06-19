import { getDb, json, validateFeedbackPayload, ensureFeedbackTable, requireAdmin, unauthorized } from './_shared.js';

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return unauthorized();
  const db = getDb(env);
  if (!db) return json({ error: 'D1 binding is not configured.' }, { status: 500 });
  await ensureFeedbackTable(db);

  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || 'all';
  const clauses = [];
  const params = [];
  if (filter === 'urgent') clauses.push("priority = 'urgent'");
  else if (filter === 'calculation_issues') clauses.push("category = 'calculation_issue'");
  else if (filter === 'general_feedback') clauses.push("category = 'general_feedback'");
  else if (['open', 'reviewing', 'fixed', 'closed'].includes(filter)) {
    clauses.push('status = ?');
    params.push(filter);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const stmt = db.prepare(`SELECT id, created_at, visitor_id, page_path, calculator_key, rating, category, message, email, language, device_type, app_version, commit_sha, priority, status FROM feedback ${where} ORDER BY created_at DESC LIMIT 100`).bind(...params);
  const result = await stmt.all();
  return json({ entries: result.results || [] });
}

export async function onRequestPost({ request, env }) {
  const db = getDb(env);
  if (!db) return json({ error: 'D1 binding is not configured.' }, { status: 500 });
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const validated = validateFeedbackPayload(payload);
  if (validated.error) return json({ error: validated.error }, { status: 400 });
  const data = validated.value;
  await ensureFeedbackTable(db);

  if (data.visitorId) {
    const rateLimitCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recent = await db.prepare('SELECT COUNT(*) AS count FROM feedback WHERE visitor_id = ? AND created_at > ?').bind(data.visitorId, rateLimitCutoff).first();
    if (recent && recent.count >= 3) return json({ error: 'Too many feedback submissions. Please try again later.' }, { status: 429 });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.prepare(`INSERT INTO feedback (id, created_at, visitor_id, page_path, calculator_key, rating, category, message, email, language, device_type, app_version, commit_sha, priority, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`)
    .bind(id, createdAt, data.visitorId, data.pagePath, data.calculatorKey, data.rating, data.category, data.message, data.email, data.language, data.deviceType, env.APP_VERSION || null, env.COMMIT_SHA || env.CF_PAGES_COMMIT_SHA || null, data.priority)
    .run();

  if (data.category === 'calculation_issue' && env.FEEDBACK_WEBHOOK_URL) {
    const body = JSON.stringify({ id, created_at: createdAt, page_path: data.pagePath, calculator_key: data.calculatorKey, rating: data.rating, category: data.category, priority: data.priority, message: data.message, app_version: env.APP_VERSION || null, commit_sha: env.COMMIT_SHA || env.CF_PAGES_COMMIT_SHA || null });
    await fetch(env.FEEDBACK_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => null);
  }

  return json({ ok: true, id });
}
