import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { manageProfile } from '@/api/functions';
import { useTelegramAuth } from './useTelegramAuth';
import { Button } from '@/components/ui/button';
import { Crown, Lock } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { SubscriptionCheckout } from '@/components/subscription/SubscriptionCheckout';

export function SubscriptionGuard({ children }) {
  const { telegramId } = useTelegramAuth();
  const location = useLocation();
  const isProfilePage = location.pathname.toLowerCase().includes('profile');
  const [showWarning, setShowWarning] = useState(true);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', telegramId],
    queryFn: async () => {
      if (!telegramId) return null;
      const { data } = await manageProfile({
        action: 'get',
        data: { telegram_id: telegramId },
      });
      return data.profile;
    },
    enabled: !!telegramId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Проверка подписки...</div>
      </div>
    );
  }

  if (!profile) return children;

  const subscriptionEndDate = profile.subscription_end_date
    ? new Date(profile.subscription_end_date)
    : null;
  const isExpired = subscriptionEndDate && subscriptionEndDate < new Date();
  const isSubscriptionActive = profile.is_subscription_active && !isExpired;
  const daysRemaining = subscriptionEndDate
    ? Math.ceil((subscriptionEndDate - new Date()) / (1000 * 60 * 60 * 24))
    : 0;
  const isExpiringSoon = isSubscriptionActive && daysRemaining <= 3 && daysRemaining >= 0;

  if (isSubscriptionActive || isProfilePage) {
    return (
      <>
        {isExpiringSoon && showWarning && !isProfilePage && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 relative">
            <div className="flex items-center justify-between max-w-md mx-auto">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <Crown className="w-4 h-4" />
                <span>
                  Подписка истекает через {daysRemaining}{' '}
                  {daysRemaining === 1 ? 'день' : daysRemaining < 5 ? 'дня' : 'дней'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowWarning(false)}
                className="text-amber-600 hover:text-amber-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-lg text-center">
        <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-violet-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Доступ ограничен</h2>
        <p className="text-gray-600 mb-6">
          Срок действия вашей пробной версии или подписки истёк. Оформите подписку, чтобы
          продолжить пользоваться всеми функциями FitBot.
        </p>
        <SubscriptionCheckout telegramId={telegramId} />
        <Link to={createPageUrl('Profile')} className="block mt-4">
          <Button variant="outline" className="w-full">
            Перейти в профиль
          </Button>
        </Link>
        <p className="mt-4 text-xs text-gray-400">
          Оплата через Robokassa. Если подписка не активировалась — перезагрузите приложение.
        </p>
      </div>
    </div>
  );
}
