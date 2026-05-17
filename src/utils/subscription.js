import { supabase } from '@/api/supabaseClient';

/** Есть ли хотя бы одна успешная оплата (не trial). */
export async function fetchHasPaidSubscription(telegramId) {
  if (!telegramId) return false;
  const { count, error } = await supabase
    .from('payment_orders')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', String(telegramId))
    .eq('status', 'paid');

  if (error) {
    console.error('[subscription] payment_orders check failed:', error.message);
    return false;
  }
  return (count || 0) > 0;
}

export function getTrialDaysRemaining(subscriptionEndDate) {
  if (!subscriptionEndDate) return null;
  const end = new Date(subscriptionEndDate);
  const days = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}
