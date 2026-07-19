import { ensureFeedbackEventsTable, getDb, json, validateFeedbackEventPayload } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  const db = getDb(env);
  if (!db) return json({ error: 'D1 binding is not configured.' }, { status: 500 });
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 4096) return json({ error: 'Payload is too large.' }, { status: 413 });

  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const validated = validateFeedbackEventPayload(payload);
  if (validated.error) return json({ error: validated.error }, { status: 400 });
  const data = validated.value;
  await ensureFeedbackEventsTable(db);

  if (data.visitorId) {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recent = await db.prepare('SELECT COUNT(*) AS count FROM feedback_events WHERE visitor_id = ? AND created_at > ?').bind(data.visitorId, cutoff).first();
    if (recent && recent.count >= 120) return json({ error: 'Too many feedback events. Please try again later.' }, { status: 429 });
  }

  await db.prepare(`INSERT INTO feedback_events (id, created_at, visitor_id, prompt_id, page_path, calculator_key, event_type, rating, language, device_type, app_version, commit_sha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), new Date().toISOString(), data.visitorId, data.promptId, data.pagePath, data.calculatorKey, data.eventType, data.rating, data.language, data.deviceType, env.APP_VERSION || null, env.COMMIT_SHA || env.CF_PAGES_COMMIT_SHA || null).run();
  return json({ ok: true });
}
