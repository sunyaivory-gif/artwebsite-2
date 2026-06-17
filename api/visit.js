const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function redis(command, key) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error('Missing Upstash Redis environment variables');
  }

  const endpoint = `${REDIS_URL.replace(/\/$/, '')}/${command}/${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Redis request failed: ${response.status}`);
  }

  return response.json();
}

async function getCount(key) {
  const data = await redis('get', key);
  return Number(data.result || 0);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    await redis('incr', 'site:visits:total');
    await redis('incr', `site:visits:${todayKey()}`);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const [total, today] = await Promise.all([
      getCount('site:visits:total'),
      getCount(`site:visits:${todayKey()}`),
    ]);
    return res.status(200).json({ ok: true, total, today });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
