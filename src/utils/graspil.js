/**
 * Graspil conversion tracking helper
 * Docs: https://graspil.com
 *
 * API key is hardcoded here since it's a public-facing tracking endpoint
 * (same approach as client-side pixel integrations).
 */

const GRASPIL_API_URL = 'https://api.graspil.com/v1/send-target';
const GRASPIL_API_KEY = '69a7054fa6660:2bef5cf6d28a76382b453114ab3de8259050f80445215ef50aecf48a9aaca0d6';

/**
 * Send a conversion target event to Graspil.
 *
 * @param {number} targetId   — Graspil target_id
 * @param {string|number} userId — Telegram user ID (telegram_id)
 * @returns {Promise<void>}
 */
export async function sendGraspilTarget(targetId, userId) {
  if (!userId) {
    console.warn('[graspil] sendGraspilTarget called without userId — skipping');
    return;
  }

  try {
    const res = await fetch(GRASPIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': GRASPIL_API_KEY,
      },
      body: JSON.stringify({
        target_id: targetId,
        user_id: String(userId),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[graspil] target ${targetId} failed: ${res.status}`, text);
    } else {
      console.log(`[graspil] ✓ target ${targetId} sent for user ${userId}`);
    }
  } catch (err) {
    console.error(`[graspil] target ${targetId} error:`, err.message);
  }
}
