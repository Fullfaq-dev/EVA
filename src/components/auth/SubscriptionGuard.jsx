import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { manageProfile } from '@/api/functions';
import { supabase } from '@/api/supabaseClient';
import { useTelegramAuth } from './useTelegramAuth';
import { startRobokassaPayment } from '@/utils/robokassa';
import { Button } from '@/components/ui/button';
import { Crown, Check, Lock, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// ─── Plan definitions ────────────────────────────────────────────────────────
const PLANS = [
  {
    name: '1 Месяц',
    price: 10,
    badge: null,
    badgeColor: null,
    highlight: false,
    originalPrice: null,
  },
  {
    name: '3 Месяца',
    price: 799,
    badge: 'Популярный',
    badgeColor: 'bg-violet-500',
    highlight: true,
    originalPrice: 1497,
  },
  {
    name: '1 Год',
    price: 2100,
    badge: '-65%',
    badgeColor: 'bg-green-500',
    highlight: false,
    originalPrice: 5988,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
export function SubscriptionGuard({ children }) {
  const { telegramId } = useTelegramAuth();
  const queryClient = useQueryClient();
  const location = useLocation();

  const isProfilePage = location.pathname === '/profile';

  const [showWarning, setShowWarning] = useState(true);
  const [payingPlan, setPayingPlan] = useState(null);   // plan being processed
  const [paymentPending, setPaymentPending] = useState(false); // iFrame opened
  const pollRef = useRef(null);

  // ── Fetch profile ──────────────────────────────────────────────────────────
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

  // ── Poll for subscription activation after payment ─────────────────────────
  useEffect(() => {
    if (!paymentPending) {
      clearInterval(pollRef.current);
      return;
    }
    // Poll every 5 seconds
    pollRef.current = setInterval(async () => {
      await queryClient.invalidateQueries(['profile', telegramId]);
      const cached = queryClient.getQueryData(['profile', telegramId]);
      const endDate = cached?.subscription_end_date
        ? new Date(cached.subscription_end_date)
        : null;
      if (cached?.is_subscription_active && endDate && endDate > new Date()) {
        clearInterval(pollRef.current);
        setPaymentPending(false);
        setPayingPlan(null);
        toast.success('🎉 Подписка активирована!');
      }
    }, 5000);

    return () => clearInterval(pollRef.current);
  }, [paymentPending, telegramId, queryClient]);

  // ── Handle payment button click ────────────────────────────────────────────
  const handlePayment = async (plan) => {
    if (payingPlan) return; // prevent double clicks
    setPayingPlan(plan.name);

    try {
      // 1. Create a pending order in Supabase → get auto-generated integer id (InvId)
      const { data: order, error } = await supabase
        .from('payment_orders')
        .insert({
          telegram_id: String(telegramId),
          plan_name: plan.name,
          amount: plan.price,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error || !order) {
        throw new Error(error?.message || 'Failed to create payment order');
      }

      const invId = order.id; // integer — used as Robokassa InvId

      // 2. Open Robokassa iFrame
      startRobokassaPayment({
        outSum: plan.price.toFixed(2),
        invId,
        description: `Подписка FitBot — ${plan.name}`,
        // Shp_ params are embedded in the signature and returned to ResultURL
        shpParams: {
          plan: plan.name,
          telegram_id: String(telegramId),
        },
      });

      // 3. Enter pending state — polling will detect activation
      setPaymentPending(true);
      toast.info('Форма оплаты открыта. После оплаты подписка активируется автоматически.');
    } catch (err) {
      console.error('[SubscriptionGuard] Payment error:', err);
      toast.error('Не удалось открыть форму оплаты. Попробуйте ещё раз.');
      setPayingPlan(null);
    }
  };

  // ── Manual refresh after payment ───────────────────────────────────────────
  const handleCheckPayment = async () => {
    await queryClient.invalidateQueries(['profile', telegramId]);
    toast.info('Проверяем статус подписки...');
  };

  const handleCancelPending = () => {
    clearInterval(pollRef.current);
    setPaymentPending(false);
    setPayingPlan(null);
  };

  // ── Render: loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Проверка подписки...</div>
      </div>
    );
  }

  if (!profile) return children;

  const isSubscriptionActive = profile.is_subscription_active;
  const subscriptionEndDate = profile.subscription_end_date
    ? new Date(profile.subscription_end_date)
    : null;
  const isExpired = subscriptionEndDate && subscriptionEndDate < new Date();
  const daysRemaining = subscriptionEndDate
    ? Math.ceil((subscriptionEndDate - new Date()) / (1000 * 60 * 60 * 24))
    : 0;
  const isExpiringSoon = !isExpired && daysRemaining <= 3 && daysRemaining >= 0;

  // ── Render: active subscription ────────────────────────────────────────────
  if ((isSubscriptionActive && !isExpired) || isProfilePage) {
    return (
      <>
        {isExpiringSoon && showWarning && !isProfilePage && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 relative">
            <div className="flex items-center justify-between max-w-md mx-auto">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <Crown className="w-4 h-4" />
                <span>
                  Подписка истекает через {daysRemaining}{' '}
                  {daysRemaining === 1
                    ? 'день'
                    : daysRemaining > 1 && daysRemaining < 5
                    ? 'дня'
                    : 'дней'}
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

  // ── Render: paywall ────────────────────────────────────────────────────────
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

        {/* Features banner */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-4 text-white mb-6 text-left">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-yellow-300" />
            <h3 className="font-bold">FitBot Premium</h3>
          </div>
          <ul className="space-y-2 text-sm text-violet-50">
            {[
              'Персональный план питания',
              'Расширенная аналитика',
              'Безлимитный AI-ассистент',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-300 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Payment pending state */}
        {paymentPending ? (
          <div className="rounded-xl border-2 border-violet-200 bg-violet-50 p-4 mb-4 text-center">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin mx-auto mb-2" />
            <p className="text-sm font-medium text-violet-800 mb-1">
              Ожидаем подтверждение оплаты…
            </p>
            <p className="text-xs text-violet-600 mb-3">
              После успешной оплаты подписка активируется автоматически (обычно до 1 минуты).
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckPayment}
                className="gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Проверить
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelPending}
                className="text-gray-500"
              >
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          /* Plan cards */
          <div className="grid gap-3 mb-4">
            {PLANS.map((plan) => {
              const isLoading = payingPlan === plan.name;
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-xl border-2 p-3 cursor-pointer flex items-center justify-between transition-colors
                    ${plan.highlight
                      ? 'border-violet-500 bg-violet-50/50 shadow-sm'
                      : 'border-gray-100 hover:border-violet-400'
                    }
                    ${payingPlan && !isLoading ? 'opacity-50 pointer-events-none' : ''}
                  `}
                  onClick={() => handlePayment(plan)}
                >
                  {plan.badge && (
                    <div
                      className={`absolute -top-2.5 left-4 ${plan.badgeColor} text-white px-2 py-0.5 rounded text-[10px] font-bold`}
                    >
                      {plan.badge}
                    </div>
                  )}
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    {isLoading && (
                      <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                    )}
                    <div>
                      <span className="font-bold text-gray-900">{plan.price}₽</span>
                      {plan.originalPrice && (
                        <div className="text-[10px] text-gray-500 line-through">
                          {plan.originalPrice}₽
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link to={createPageUrl('Profile')}>
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
