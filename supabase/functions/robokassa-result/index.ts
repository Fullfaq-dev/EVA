// @ts-nocheck
/**
 * Robokassa ResultURL Handler — Supabase Edge Function
 *
 * Robokassa calls this endpoint (POST) after a successful payment.
 * We verify the signature, mark the order as paid, and activate the subscription.
 *
 * Deploy URL: https://<project-ref>.functions.supabase.co/robokassa-result
 * Set this URL as "ResultURL" in your Robokassa shop settings.
 *
 * Required Supabase Edge Function secrets (set via `supabase secrets set`):
 *   ROBOKASSA_PASSWORD2   — Password #2 from Robokassa shop settings
 *   SUPABASE_URL          — Auto-provided by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-provided by Supabase
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

// ---------------------------------------------------------------------------
// MD5 helper — Deno's std/crypto wraps Rust crypto that supports MD5
// ---------------------------------------------------------------------------
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function md5(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('MD5', encoder.encode(message));
  return toHex(hash).toUpperCase();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect all Shp_* params from the request, sort alphabetically, build string.
 * e.g. "Shp_plan=1 Месяц:Shp_telegram_id=123456"
 */
function buildShpString(params: URLSearchParams): string {
  const shpPairs: Array<[string, string]> = [];
  for (const [key, value] of params.entries()) {
    if (key.startsWith('Shp_') || key.startsWith('shp_')) {
      shpPairs.push([key, value]);
    }
  }
  return shpPairs
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(':');
}

/** Calculate months/years to add based on plan name */
function getSubscriptionExtension(planName: string): { months?: number; years?: number } {
  if (planName === '1 Месяц') return { months: 1 };
  if (planName === '3 Месяца') return { months: 3 };
  if (planName === '1 Год') return { years: 1 };
  return { months: 1 }; // fallback
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  // Robokassa always sends POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const password2 = Deno.env.get('ROBOKASSA_PASSWORD2');
  if (!password2) {
    console.error('[robokassa-result] ROBOKASSA_PASSWORD2 secret is not set');
    return new Response('Server configuration error', { status: 500 });
  }

  // Parse form-encoded body
  const body = await req.text();
  const params = new URLSearchParams(body);

  const outSum = params.get('OutSum');
  const invId = params.get('InvId');
  const signatureValue = params.get('SignatureValue');
  const telegramId = params.get('Shp_telegram_id');
  const planName = params.get('Shp_plan');

  console.log('[robokassa-result] Received notification', { outSum, invId, telegramId, planName });

  if (!outSum || !invId || !signatureValue || !telegramId || !planName) {
    console.error('[robokassa-result] Missing required params');
    return new Response('Bad Request: missing params', { status: 400 });
  }

  // -----------------------------------------------------------------------
  // Verify signature: MD5(OutSum:InvId:Password2[:Shp_key=value...])
  // -----------------------------------------------------------------------
  const shpString = buildShpString(params);
  const verifyString = shpString
    ? `${outSum}:${invId}:${password2}:${shpString}`
    : `${outSum}:${invId}:${password2}`;

  const computedSignature = await md5(verifyString);

  if (computedSignature !== signatureValue.toUpperCase()) {
    console.error('[robokassa-result] Signature mismatch', {
      computed: computedSignature,
      received: signatureValue.toUpperCase(),
    });
    return new Response('Forbidden: invalid signature', { status: 403 });
  }

  // -----------------------------------------------------------------------
  // Update DB
  // -----------------------------------------------------------------------
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const invIdNum = parseInt(invId, 10);

  // Mark order as paid (idempotent — only transitions from pending)
  const { data: order, error: orderError } = await supabase
    .from('payment_orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invIdNum)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (orderError) {
    console.error('[robokassa-result] Order update error', orderError);
    // Return OK anyway so Robokassa stops retrying a duplicate
    return new Response(`OK${invId}`, { status: 200 });
  }

  if (!order) {
    // Order not found or already processed — still respond OK
    console.warn('[robokassa-result] Order already processed or not found', { invIdNum });
    return new Response(`OK${invId}`, { status: 200 });
  }

  // -----------------------------------------------------------------------
  // Activate / extend subscription for the user
  // -----------------------------------------------------------------------
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_subscription_active, subscription_end_date')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  const now = new Date();
  const currentEndDate =
    profile?.subscription_end_date ? new Date(profile.subscription_end_date) : now;
  // Extend from current end if still active, otherwise extend from now
  const startDate =
    profile?.is_subscription_active && currentEndDate > now ? currentEndDate : now;

  const newEndDate = new Date(startDate);
  const ext = getSubscriptionExtension(planName);
  if (ext.months) newEndDate.setMonth(newEndDate.getMonth() + ext.months);
  if (ext.years) newEndDate.setFullYear(newEndDate.getFullYear() + ext.years);

  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      is_subscription_active: true,
      subscription_end_date: newEndDate.toISOString(),
    })
    .eq('telegram_id', telegramId);

  if (profileError) {
    console.error('[robokassa-result] Profile update error', profileError);
    // Still respond OK — manual fix can be done; avoid Robokassa retrying
    return new Response(`OK${invId}`, { status: 200 });
  }

  console.log(
    `[robokassa-result] Subscription activated for ${telegramId} until ${newEndDate.toISOString()}`
  );

  // Robokassa requires EXACTLY "OK{InvId}" in the response body
  return new Response(`OK${invId}`, { status: 200 });
});
