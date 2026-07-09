// This runs on Vercel's server, NOT in the browser — so the Firebase URL and
// secret below are never visible to anyone viewing the site's source code.
const FIREBASE_DB_URL = 'https://project-wave-6d228-default-rtdb.firebaseio.com';
const FIREBASE_SECRET = 'WAVE-C3B-1983'; // must match what's in your Firebase Rules
const UPLOAD_PASSWORD = '1983';          // must match the password used in the dashboard

export default async function handler(req, res) {
  // Explicitly forbid caching this response anywhere (browser, Vercel edge,
  // any proxy in between) — without this, a GET here could keep returning an
  // old snapshot even minutes after a real update, since nothing was telling
  // intermediate caches this data changes on every request.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${FIREBASE_DB_URL}/waveDashboard.json`, { cache: 'no-store' });
      const data = await r.json();
      res.status(200).json(data || {});
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.password !== UPLOAD_PASSWORD) {
        res.status(401).json({ error: 'Invalid password' });
        return;
      }
      const payload = { ...(body.data || {}), secret: FIREBASE_SECRET };
      const r = await fetch(`${FIREBASE_DB_URL}/waveDashboard.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });
      if (!r.ok) throw new Error('Firebase write failed: ' + r.status);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
