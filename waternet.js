// This runs on Vercel's server, NOT in the browser — same pattern as
// api/snapshot.js, so the Firebase URL and secret below are never visible
// to anyone viewing the site's source code.
//
// Deliberately a SEPARATE endpoint/path from snapshot.js: the HP/LP water
// network files (PDF or HTML) can be several MB, much larger than the
// small text/number fields snapshot.js normally carries. Keeping them on
// their own Firebase path (waterNetwork/hp, waterNetwork/lp) means a big
// water-network upload can never slow down or break the sync for the rest
// of the dashboard (Punch List, DPR data, etc).

// Vercel's hard platform cap on request body size is 4.5MB — this raises
// the *parser's* threshold up to that cap (it defaults lower), so larger
// PDF uploads (as base64, ~33% bigger than the original file) don't get
// rejected before reaching the handler below. Your two current PDFs
// (~700–900KB each) are well within this either way.
export const config = { api: { bodyParser: { sizeLimit: '4.5mb' } } };

const FIREBASE_DB_URL = 'https://project-wave-6d228-default-rtdb.firebaseio.com';
const FIREBASE_SECRET = 'WAVE-C3B-1983'; // must match what's in your Firebase Rules
const UPLOAD_PASSWORD = '1983'; // must match the password used in the dashboard

export default async function handler(req, res) {
  // Same no-cache-anywhere policy as snapshot.js — a GET here must always
  // reflect the latest upload, never a stale cached copy.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const kind = (req.query && req.query.kind) || (req.body && req.body.kind);
    if (kind !== 'hp' && kind !== 'lp') {
      res.status(400).json({ error: "kind must be 'hp' or 'lp'" });
      return;
    }

    if (req.method === 'GET') {
      const r = await fetch(`${FIREBASE_DB_URL}/waterNetwork/${kind}.json`, { cache: 'no-store' });
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
      if (!body.html) {
        res.status(400).json({ error: 'Missing html/content field' });
        return;
      }

      const payload = {
        html: body.html,               // raw HTML text, or a data:application/pdf;base64,... URI
        type: body.type || 'html',     // 'html' | 'pdf'
        ts: body.ts || Date.now(),
        secret: FIREBASE_SECRET
      };

      const r = await fetch(`${FIREBASE_DB_URL}/waterNetwork/${kind}.json`, {
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
