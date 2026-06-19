const allowedRatings = new Set(['useful', 'needs_improvement', 'not_useful']);
const allowedCategories = new Set(['general_feedback', 'calculation_issue']);
const allowedStatuses = new Set(['open', 'reviewing', 'fixed', 'closed']);
const calculatorPaths = new Map([
  ['/bsa/', 'bsa'],
  ['/gdp/', 'gdp'],
  ['/heparin/', 'heparin'],
  ['/predicted-hct/', 'predicted_hct'],
  ['/lbm/', 'lbm'],
  ['/timecalc/', 'timecalc'],
  ['/z-score/', 'z_score'],
  ['/cannula-pressure-drop/', 'cannula_pressure_drop'],
  ['/priming-volume/', 'priming_volume'],
  ['/unit-converter/', 'unit_converter'],
  ['/phn-echo/', 'phn_echo'],
]);

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) },
  });
}

function getDb(env) {
  return env.FEEDBACK_DB || env.DB || env.D1;
}

function normalizePath(value) {
  if (typeof value !== 'string') return '';
  try {
    const path = value.startsWith('http') ? new URL(value).pathname : value;
    if (!path.startsWith('/') || path.includes('..') || path.length > 120) return '';
    return path.length > 1 && !path.endsWith('/') ? `${path}/` : path;
  } catch {
    return '';
  }
}

function validateFeedbackPayload(payload) {
  if (!payload || typeof payload !== 'object') return { error: 'Invalid payload.' };
  const rating = typeof payload.rating === 'string' ? payload.rating : '';
  if (!allowedRatings.has(rating)) return { error: 'Invalid rating.' };

  const pagePath = normalizePath(payload.page_path);
  if (!pagePath || !calculatorPaths.has(pagePath)) return { error: 'Invalid page_path.' };

  const expectedKey = calculatorPaths.get(pagePath);
  const calculatorKey = typeof payload.calculator_key === 'string' ? payload.calculator_key.trim() : expectedKey;
  if (calculatorKey !== expectedKey) return { error: 'Invalid calculator_key.' };

  const category = typeof payload.category === 'string' ? payload.category : 'general_feedback';
  if (!allowedCategories.has(category)) return { error: 'Invalid category.' };

  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (message.length > 1000) return { error: 'Message is too long.' };

  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email.' };

  const visitorId = typeof payload.visitor_id === 'string' ? payload.visitor_id.trim() : '';
  if (!/^pt_[a-zA-Z0-9_-]{5,97}$/.test(visitorId)) return { error: 'Invalid visitor_id.' };
  const language = typeof payload.language === 'string' ? payload.language.slice(0, 35) : null;
  const deviceType = ['mobile', 'tablet', 'desktop'].includes(payload.device_type) ? payload.device_type : null;
  const priority = category === 'calculation_issue' ? 'urgent' : 'normal';

  return { value: { rating, pagePath, calculatorKey, category, message: message || null, email: email || null, visitorId, language, deviceType, priority } };
}

async function ensureFeedbackTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    visitor_id TEXT,
    page_path TEXT NOT NULL,
    calculator_key TEXT,
    rating TEXT,
    category TEXT NOT NULL,
    message TEXT,
    email TEXT,
    language TEXT,
    device_type TEXT,
    app_version TEXT,
    commit_sha TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open'
  )`).run();
}

function requireAdmin(request, env) {
  const token = env.FEEDBACK_ADMIN_TOKEN || env.ADMIN_TOKEN;
  if (token) return request.headers.get('authorization') === `Bearer ${token}`;
  const user = env.FEEDBACK_ADMIN_USER || env.ADMIN_USER;
  const pass = env.FEEDBACK_ADMIN_PASSWORD || env.ADMIN_PASSWORD;
  if (!user || !pass) return false;
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = atob(header.slice(6));
  return decoded === `${user}:${pass}`;
}

function unauthorized() {
  return json({ error: 'Unauthorized.' }, { status: 401, headers: { 'www-authenticate': 'Basic realm="PerfusionTools Feedback"' } });
}

export { allowedStatuses, getDb, json, validateFeedbackPayload, ensureFeedbackTable, requireAdmin, unauthorized };
