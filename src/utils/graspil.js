/**
 * Graspil conversion tracking helper
 *
 * Why we proxy through /api/graspil-target:
 *   The Graspil API does not return CORS headers, so a direct fetch() from
 *   the browser (Telegram Mini App) is rejected by the browser before the
 *   request even reaches Graspil. By routing the call through our own
 *   Vercel serverless function the request is server-to-server (no CORS).
 *   All Vercel logs ([graspil-target] …) are visible in the Vercel dashboard
 *   under Functions → graspil-target.
 */

/**
 * Send a conversion target event to Graspil via the server-side proxy.
 *
 * @param {number} targetId      — Graspil target_id
 * @param {string|number} userId — Telegram user ID (telegram_id)
 * @returns {Promise<void>}
 */
export async function sendGraspilTarget(targetId, userId) {
  if (!userId) {
    console.warn('[graspil] sendGraspilTarget called without userId — skipping');
    return;
  }

  console.log(`[graspil] Sending target_id=${targetId} for user_id=${userId}`);

  try {
    const res = await fetch('/api/graspil-target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_id: targetId,
        user_id: String(userId),
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[graspil] Proxy returned ${res.status} for target ${targetId}:`, data);
    } else {
      console.log(`[graspil] ✓ target ${targetId} sent for user ${userId}`, data);
    }
  } catch (err) {
    console.error(`[graspil] target ${targetId} error:`, err.message);
  }
}
