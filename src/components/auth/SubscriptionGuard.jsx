import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { manageProfile } from '@/api/functions';
import { useTelegramAuth } from './useTelegramAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Crown, Check, CreditCard, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export function SubscriptionGuard({ children }) {
  const { telegramId } = useTelegramAuth();
  const location = useLocation();
  
  // Allow access to Profile page to pay
  const isProfilePage = location.pathname === '/profile';

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', telegramId],
    queryFn: async () => {
      if (!telegramId) return null;
      const { data } = await manageProfile({
        action: 'get',
        data: { telegram_id: telegramId }
      });
      return data.profile;
    },
    enabled: !!telegramId
  });

  const handlePayment = (plan) => {
    console.log('Processing payment for plan:', plan);
    toast.success(`Оплата тарифа "${plan.name}"... (тестовый режим)`);
    // Here we would integrate with a payment provider
    // For now, we can't really update the subscription state without a backend endpoint for payment success
    // But in a real app, this would redirect to payment or handle success
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Проверка подписки...</div>
      </div>
    );
  }

  // If no profile (should be handled by AuthGuard, but just in case)
  if (!profile) {
    return children;
  }

  const isSubscriptionActive = profile.is_subscription_active;
  const subscriptionEndDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null;
  const isExpired = subscriptionEndDate && subscriptionEndDate < new Date();
  
  // Calculate days remaining
  const daysRemaining = subscriptionEndDate
    ? Math.ceil((subscriptionEndDate - new Date()) / (1000 * 60 * 60 * 24))
    : 0;
  
  const isExpiringSoon = !isExpired && daysRemaining <= 3 && daysRemaining >= 0;
  const [showWarning, setShowWarning] = useState(true);

  // If subscription is active and not expired, or if we are on the profile page, allow access
  if ((isSubscriptionActive && !isExpired) || isProfilePage) {
    return (
      <>
        {isExpiringSoon && showWarning && !isProfilePage && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 relative">
            <div className="flex items-center justify-between max-w-md mx-auto">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <Crown className="w-4 h-4" />
                <span>
                  Подписка истекает через {daysRemaining} {daysRemaining === 1 ? 'день' : daysRemaining > 1 && daysRemaining < 5 ? 'дня' : 'дней'}
                </span>
              </div>
              <button
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

  // Blocking UI
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-lg text-center">
        <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-violet-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Доступ ограничен</h2>
        <p className="text-gray-600 mb-6">
          Срок действия вашей пробной версии или подписки истек. Чтобы продолжить пользоваться всеми функциями FitBot, пожалуйста, оформите подписку.
        </p>

        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-4 text-white mb-6 text-left">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-yellow-300" />
            <h3 className="font-bold">FitBot Premium</h3>
          </div>
          <ul className="space-y-2 text-sm text-violet-50">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-300" />
              Персональный план питания
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-300" />
              Расширенная аналитика
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-300" />
              Безлимитный AI-ассистент
            </li>
          </ul>
        </div>

        <div className="grid gap-3 mb-4">
           {/* 1 Month */}
           <div className="relative rounded-xl border-2 border-gray-100 p-3 hover:border-violet-500 transition-colors cursor-pointer flex items-center justify-between"
                 onClick={() => handlePayment({ name: '1 Месяц', price: 499 })}>
              <div className="text-left">
                <h4 className="font-semibold text-gray-900">1 Месяц</h4>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-900">499₽</span>
              </div>
            </div>

            {/* 3 Months */}
            <div className="relative rounded-xl border-2 border-violet-500 bg-violet-50/50 p-3 cursor-pointer shadow-sm flex items-center justify-between"
                 onClick={() => handlePayment({ name: '3 Месяца', price: 799 })}>
              <div className="absolute -top-2.5 left-4 bg-violet-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                Популярный
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-gray-900">3 Месяца</h4>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-900">799₽</span>
                <div className="text-[10px] text-gray-500 line-through">1497₽</div>
              </div>
            </div>

            {/* 1 Year */}
            <div className="relative rounded-xl border-2 border-gray-100 p-3 hover:border-violet-500 transition-colors cursor-pointer flex items-center justify-between"
                 onClick={() => handlePayment({ name: '1 Год', price: 2100 })}>
              <div className="absolute -top-2.5 left-4 bg-green-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                -65%
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-gray-900">1 Год</h4>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-900">2100₽</span>
                <div className="text-[10px] text-gray-500 line-through">5988₽</div>
              </div>
            </div>
        </div>

        <Link to={createPageUrl('Profile')}>
          <Button variant="outline" className="w-full">
            Перейти в профиль
          </Button>
        </Link>
        
        <p className="mt-4 text-xs text-gray-400">
          Если вы уже оплатили подписку, попробуйте перезагрузить приложение.
        </p>
      </div>
    </div>
  );
}
