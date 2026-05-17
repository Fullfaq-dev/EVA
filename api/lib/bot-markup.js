/**
 * Shared Telegram inline keyboard builder for funnel messages.
 */

export function buildMarkup(msg, appUrl) {
  if (!msg.has_button || !msg.button_text) return undefined;

  const callbackActions = [
    'show_meal_plan',
    'enable_water_reminders',
    'enable_sport_reminders',
    'continue',
    'choose_onboarding',
  ];
  if (callbackActions.includes(msg.button_action)) {
    return { inline_keyboard: [[{ text: msg.button_text, callback_data: msg.button_action }]] };
  }

  // «Заполнить анкету» → выбор: в приложении или в чате
  if (msg.button_action === 'open_onboarding') {
    return { inline_keyboard: [[{ text: msg.button_text, callback_data: 'choose_onboarding' }]] };
  }

  const urlMap = {
    open_app: appUrl,
    subscribe: `${appUrl}?startapp=subscribe`,
    restore_access: `${appUrl}?startapp=subscribe`,
    open_water_reminders: `${appUrl}?startapp=water_reminders`,
  };
  const targetUrl = urlMap[msg.button_action] || appUrl;

  const isTgLink =
    targetUrl.startsWith('https://t.me') || targetUrl.startsWith('http://t.me');
  const buttonObj = isTgLink
    ? { text: msg.button_text, url: targetUrl }
    : { text: msg.button_text, web_app: { url: targetUrl } };

  return { inline_keyboard: [[buttonObj]] };
}

/** Кнопки выбора способа прохождения анкеты */
export function buildOnboardingChoiceMarkup(appUrl) {
  const onboardingUrl = `${appUrl}?startapp=onboarding`;
  const isTgLink =
    onboardingUrl.startsWith('https://t.me') || onboardingUrl.startsWith('http://t.me');
  const appButton = isTgLink
    ? { text: '📱 В приложении', url: onboardingUrl }
    : { text: '📱 В приложении', web_app: { url: onboardingUrl } };

  return {
    inline_keyboard: [
      [appButton],
      [{ text: '💬 В чате', callback_data: 'onboard_chat' }],
    ],
  };
}
