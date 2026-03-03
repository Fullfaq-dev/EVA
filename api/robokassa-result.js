/**
 * Vercel Serverless Function — Robokassa ResultURL Handler
 *
 * Robokassa вызывает этот endpoint (POST) после успешной оплаты.
 * Мы проверяем подпись (MD5 с Password#2), помечаем заказ оплаченным,
 * и активируем подписку пользователя в Supabase.
 *
 * URL функции: https://ВАШ_ДОМЕН.vercel.app/api/robokassa-result
 * Вставьте этот URL в личном кабинете Robokassa → Тех. настройки → ResultURL (метод POST)
 *
 * Обязательные переменные окружения в Vercel:
 *   ROBOKASSA_PASSWORD2        — Пароль #2 из настроек магазина Robokassa
 *   SUPABASE_URL               — https://XXXX.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  — service_role ключ из Supabase Dashboard → Settings → API
 */

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** MD5 hex string (uppercase) — Node.js built-in crypto, no deps */
function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

/**
 * Собирает строку из Shp_* параметров отсортированных по алфавиту.
 * Пример: "Shp_plan=1 Месяц:Shp_telegram_id=123456"
 */
function buildShpString(params) {
  return Object.keys(params)
    .filter((k) => k.startsWith('Shp_') || k.startsWith('shp_'))
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join(':');
}

/** Вычисляет количество месяцев/лет для тарифа */
function getExtension(planName) {
  if (planName === '1 Месяц')  return { months: 1 };
  if (planName === '3 Месяца') return { months: 3 };
  if (planName === '1 Год')    return { years: 1 };
  return { months: 1 };
}

// ────────────────────────────────────────────────────────────────────────────
// Parse URL-encoded body (Vercel serverless function receives raw body)
// ────────────────────────────────────────────────────────────────────────────
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const params = {};
        new URLSearchParams(body).forEach((v, k) => { params[k] = v; });
        resolve(params);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const password2 = process.env.ROBOKASSA_PASSWORD2;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!password2 || !supabaseUrl || !supabaseServiceKey) {
    console.error('[robokassa-result] Missing env vars', {
      password2: !!password2,
      supabaseUrl: !!supabaseUrl,
      supabaseServiceKey: !!supabaseServiceKey,
    });
    return res.status(500).send('Server configuration error');
  }

  // Parse form body
  const params = await parseBody(req);
  console.log('[robokassa-result] Received:', params);

  const { OutSum, InvId, SignatureValue } = params;
  const telegramId = params['Shp_telegram_id'];
  const planName   = params['Shp_plan'];

  if (!OutSum || !InvId || !SignatureValue || !telegramId || !planName) {
    console.error('[robokassa-result] Missing required params');
    return res.status(400).send('Bad Request: missing params');
  }

  // ── Verify signature ─────────────────────────────────────────────────────
  // Formula: MD5(OutSum:InvId:Password2[:Shp_key=value...])
  const shpString   = buildShpString(params);
  const verifyInput = shpString
    ? `${OutSum}:${InvId}:${password2}:${shpString}`
    : `${OutSum}:${InvId}:${password2}`;
  const computed = md5(verifyInput);

  if (computed !== SignatureValue.toUpperCase()) {
    console.error('[robokassa-result] Signature mismatch', {
      computed,
      received: SignatureValue.toUpperCase(),
      verifyInput,
    });
    return res.status(403).send('Forbidden: invalid signature');
  }

  // ── DB operations ────────────────────────────────────────────────────────
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const invIdNum = parseInt(InvId, 10);

  // Mark order paid (idempotent — only pending → paid)
  const { data: order, error: orderErr } = await supabase
    .from('payment_orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invIdNum)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (orderErr) {
    console.error('[robokassa-result] Order update error', orderErr);
    // Respond OK to stop Robokassa retries on a race condition
    return res.status(200).send(`OK${InvId}`);
  }
  if (!order) {
    console.warn('[robokassa-result] Order already processed or not found', invIdNum);
    return res.status(200).send(`OK${InvId}`);
  }

  // Activate / extend subscription
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_subscription_active, subscription_end_date')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  const now            = new Date();
  const currentEnd     = profile?.subscription_end_date ? new Date(profile.subscription_end_date) : now;
  const startDate      = profile?.is_subscription_active && currentEnd > now ? currentEnd : now;
  const newEnd         = new Date(startDate);
  const ext            = getExtension(planName);
  if (ext.months) newEnd.setMonth(newEnd.getMonth() + ext.months);
  if (ext.years)  newEnd.setFullYear(newEnd.getFullYear() + ext.years);

  const { error: profileErr } = await supabase
    .from('user_profiles')
    .update({ is_subscription_active: true, subscription_end_date: newEnd.toISOString() })
    .eq('telegram_id', telegramId);

  if (profileErr) {
    console.error('[robokassa-result] Profile update error', profileErr);
    return res.status(200).send(`OK${InvId}`); // Still OK for Robokassa
  }

  console.log(`[robokassa-result] ✅ Subscription activated: ${telegramId} → ${newEnd.toISOString()}`);

  // Robokassa требует ТОЧНЫЙ ответ "OK{InvId}"
  return res.status(200).send(`OK${InvId}`);
}
