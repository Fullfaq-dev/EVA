/**
 * Vercel Serverless Function — Graspil Conversion Tracking Proxy
 *
 * Why this exists:
 *   The Graspil API does not send CORS headers, so a direct fetch()
 *   from the Mini App (browser) is blocked before it even reaches Graspil.
 *   This endpoint acts as a server-side proxy: the browser calls this
 *   function, which then calls Graspil server-to-server (no CORS issues).
 *
 * Usage:
 *   POST /api/graspil-target
 *   Body: { "target_id": 10757, "user_id": "123456789" }
 */

const GRASPIL_API_URL = 'https://api.graspil.com/v1/send-target';
const GRASPIL_API_KEY =
  '69a7054fa6660:2bef5cf6d28a76382b453114ab3de8259050f80445215ef50aecf48a9aaca0d6';

export default async function handler(req, res) {
  // Allow cross-origin calls from the Mini App
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { target_id, user_id } = req.body || {};

  console.log(`[graspil-target] Incoming request — target_id=${target_id} user_id=${user_id}`);

  if (!target_id || !user_id) {
    console.warn('[graspil-target] Missing target_id or user_id', req.body);
    return res.status(400).json({ error: 'target_id and user_id are required' });
  }

  const payload = {
    target_id: Number(target_id),
    user_id: String(user_id),
  };

  console.log('[graspil-target] Sending to Graspil:', JSON.stringify(payload));

  try {
    const graspilRes = await fetch(GRASPIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': GRASPIL_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await graspilRes.text();

    console.log(
      `[graspil-target] Graspil response — status=${graspilRes.status} body=${responseText}`
    );

    if (!graspilRes.ok) {
      console.error(
        `[graspil-target] Graspil returned non-OK status ${graspilRes.status}: ${responseText}`
      );
      return res.status(502).json({
        error: 'Graspil API error',
        status: graspilRes.status,
        body: responseText,
      });
    }

    return res.status(200).json({ ok: true, graspil: responseText });
  } catch (err) {
    console.error('[graspil-target] Fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
