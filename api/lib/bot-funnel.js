/**
 * Sleeping funnel enrollment and active → sleeping handoff.
 */

/** Mark sleeping day-1 blocks as delivered (user already saw welcome + 3h push on active). */
export async function markSleepingDay1Complete(telegramId, supabase) {
  const { data: templates } = await supabase
    .from('bot_funnel_messages')
    .select('id, block_id')
    .eq('funnel_type', 'sleeping')
    .eq('day_number', 1);

  if (!templates?.length) return;

  for (const tpl of templates) {
    const { count } = await supabase
      .from('bot_message_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_telegram_id', telegramId)
      .eq('funnel_message_id', tpl.id)
      .in('delivery_status', ['sent', 'skipped']);

    if (count > 0) continue;

    await supabase.from('bot_message_log').insert({
      user_telegram_id: telegramId,
      funnel_message_id: tpl.id,
      funnel_type: 'sleeping',
      day_number: 1,
      block_id: tpl.block_id,
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }
}

/** Start day 2 so the same-day 20:00 nudge can fire after handoff from active. */
export async function advanceSleepingToDay2(telegramId, supabase) {
  await supabase
    .from('user_funnel_state')
    .update({ current_day: 2, updated_at: new Date().toISOString() })
    .eq('user_telegram_id', telegramId)
    .eq('funnel_type', 'sleeping')
    .eq('is_active', true)
    .eq('status', 'in_progress');
}

/**
 * Close active funnel and open sleeping (day 2).
 * Call after active day-1 block 1.1 was sent, or from reconcile cron.
 */
export async function switchActiveToSleeping(telegramId, activeStateId, supabase) {
  await supabase
    .from('user_funnel_state')
    .update({ status: 'completed', is_active: false, updated_at: new Date().toISOString() })
    .eq('id', activeStateId);

  const { data: existing } = await supabase
    .from('user_funnel_state')
    .select('id')
    .eq('user_telegram_id', telegramId)
    .eq('funnel_type', 'sleeping')
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_funnel_state')
      .update({
        current_day: 1,
        is_active: true,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        last_message_sent_at: null,
        extra_data: { source: 'active_switch' },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('user_funnel_state').insert({
      user_telegram_id: telegramId,
      funnel_type: 'sleeping',
      current_day: 1,
      is_active: true,
      status: 'in_progress',
      extra_data: { source: 'active_switch' },
    });
  }

  await markSleepingDay1Complete(telegramId, supabase);
  await advanceSleepingToDay2(telegramId, supabase);

  console.log(`[funnel] active → sleeping (day 2) for ${telegramId}`);
}

export function shouldSwitchToSleeping(msg, user, dispatchResult) {
  return (
    dispatchResult === 'sent' &&
    msg.funnel_type === 'active' &&
    msg.day_number === 1 &&
    msg.block_id === '1.1' &&
    msg.send_condition === 'if_onboarding_incomplete' &&
    !user.onboarding_completed
  );
}

/**
 * Users stuck on active without onboarding ≥3h — send 1.1 or move to sleeping.
 * Returns number of users reconciled.
 */
export async function reconcileSleepingHandoffs(supabase, dispatchFn) {
  const { data: activeStates } = await supabase
    .from('user_funnel_state')
    .select('*')
    .eq('funnel_type', 'active')
    .eq('is_active', true)
    .eq('status', 'in_progress');

  if (!activeStates?.length) return 0;

  let reconciled = 0;
  const minHours = 3;

  for (const state of activeStates) {
    try {
      const { data: user } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('telegram_id', state.user_telegram_id)
        .maybeSingle();

      if (!user || user.onboarding_completed) continue;

      const { data: sleeping } = await supabase
        .from('user_funnel_state')
        .select('id, is_active, status')
        .eq('user_telegram_id', state.user_telegram_id)
        .eq('funnel_type', 'sleeping')
        .maybeSingle();

      if (sleeping?.is_active && sleeping?.status === 'in_progress') continue;

      const hoursSinceStart =
        (Date.now() - new Date(state.started_at).getTime()) / 3_600_000;
      if (hoursSinceStart < minHours) continue;

      const { data: msg11 } = await supabase
        .from('bot_funnel_messages')
        .select('id')
        .eq('funnel_type', 'active')
        .eq('day_number', 1)
        .eq('block_id', '1.1')
        .eq('is_active', true)
        .maybeSingle();

      let block11Sent = false;
      if (msg11) {
        const { count } = await supabase
          .from('bot_message_log')
          .select('id', { count: 'exact', head: true })
          .eq('user_telegram_id', state.user_telegram_id)
          .eq('funnel_message_id', msg11.id)
          .eq('delivery_status', 'sent');
        block11Sent = (count || 0) > 0;
      }

      if (state.current_day === 1 && !block11Sent && msg11) {
        const { data: template } = await supabase
          .from('bot_funnel_messages')
          .select('*')
          .eq('id', msg11.id)
          .single();
        if (template) {
          const result = await dispatchFn(state, user, template);
          if (result === 'sent') {
            reconciled++;
            continue;
          }
        }
      }

      await switchActiveToSleeping(state.user_telegram_id, state.id, supabase);
      reconciled++;
    } catch (err) {
      console.error(`[funnel] reconcile error ${state.user_telegram_id}:`, err.message);
    }
  }

  return reconciled;
}
