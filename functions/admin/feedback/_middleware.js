function isAuthorized(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = env.FEEDBACK_ADMIN_TOKEN || env.ADMIN_TOKEN;
  if (token && header === `Bearer ${token}`) return true;

  const user = env.FEEDBACK_ADMIN_USER || env.ADMIN_USER;
  const pass = env.FEEDBACK_ADMIN_PASSWORD || env.ADMIN_PASSWORD;
  if (!user || !pass || !header.startsWith('Basic ')) return false;

  const decoded = atob(header.slice(6));
  return decoded === `${user}:${pass}`;
}

export async function onRequest({ request, env, next }) {
  if (isAuthorized(request, env)) return next();
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'www-authenticate': 'Basic realm="PerfusionTools Feedback"' },
  });
}
