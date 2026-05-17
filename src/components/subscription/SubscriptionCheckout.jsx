import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { startRobokassaPayment } from '@/utils/robokassa';
import { Button } from '@/components/ui/button';
import { Crown, Check, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export const SUBSCRIPTION_PLANS = [
  { name: '1 Месяц', price: 499, badge: null, badgeColor: null, highlight: false, originalPrice: null },
  { name: '3 Месяца', price: 799, badge: 'Популярный', badgeColor: 'bg-violet-500', highlight: true, originalPrice: 1497 },
  { name: '1 Год', price: 2100, badge: '-65%', badgeColor: 'bg-green-500', highlight: false, originalPrice: 5988 },
];

export function SubscriptionCheckout({ telegramId, compact = false, onPaid }) {
  const queryClient = useQueryClient();
  const [payingPlan, setPayingPlan] = useState(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!paymentPending || !telegramId) {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      await queryClient.invalidateQueries(['profile', telegramId]);
      await queryClient.invalidateQueries(['hasPaid', telegramId]);
      const { count } = await supabase
        .from('payment_orders')
        .select('id', { count: 'exact', head: true })
        .eq('telegram_id', String(telegramId))
        .eq('status', 'paid');
      if ((count || 0) > 0) {
        clearInterval(pollRef.current);
        setPaymentPending(false);
        setPayingPlan(null);
        toast.success('🎉 Подписка активирована!');
        onPaid?.();
      }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [paymentPending, telegramId, queryClient, onPaid]);

  const handlePayment = async (plan) => {
    if (payingPlan || !telegramId) return;
    setPayingPlan(plan.name);
    try {
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

      if (error || !order) throw new Error(error?.message || 'Не удалось создать заказ');

      startRobokassaPayment({
        outSum: plan.price.toFixed(2),
        invId: order.id,
        description: `Подписка FitBot — ${plan.name}`,
        shpParams: { plan: plan.name, telegram_id: String(telegramId) },
      });

      setPaymentPending(true);
      toast.info('Форма оплаты открыта. После оплаты подписка активируется автоматически.');
    } catch (err) {
      console.error('[SubscriptionCheckout]', err);
      toast.error('Не удалось открыть форму оплаты');
      setPayingPlan(null);
    }
  };

  if (paymentPending) {
    return (
      <div className="rounded-xl border-2 border-violet-200 bg-violet-50 p-4 text-center">
        <Loader2 className="w-6 h-6 text-violet-500 animate-spin mx-auto mb-2" />
        <p className="text-sm font-medium text-violet-800 mb-1">Ожидаем подтверждение оплаты…</p>
        <p className="text-xs text-violet-600 mb-3">
          После успешной оплаты подписка активируется автоматически (обычно до 1 минуты).
        </p>
        <PendingActions
          onCheck={() => queryClient.invalidateQueries(['profile', telegramId])}
          onCancel={() => {
            clearInterval(pollRef.current);
            setPaymentPending(false);
            setPayingPlan(null);
          }}
        />
      </div>
    );
  }

  return (
    <>
      {!compact && (
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-4 text-white mb-4 text-left">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-yellow-300" />
            <h3 className="font-bold">FitBot Premium</h3>
          </div>
          <ul className="space-y-2 text-sm text-violet-50">
            {[
              'Подсчёт КБЖУ по фото и тексту',
              'План питания и чат с AI-нутрициологом',
              'Анализ медицинских отчётов',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-300 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            isLoading={payingPlan === plan.name}
            disabled={!!payingPlan && payingPlan !== plan.name}
            onPay={() => handlePayment(plan)}
          />
        ))}
      </div>
    </>
  );
}

function PendingActions({ onCheck, onCancel }) {
  return (
    <div className="flex gap-2 justify-center">
      <Button size="sm" variant="outline" onClick={onCheck} className="gap-1">
        <RefreshCw className="w-3 h-3" />
        Проверить
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} className="text-gray-500">
        Отмена
      </Button>
    </div>
  );
}

function PlanCard({ plan, isLoading, disabled, onPay }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && onPay()}
      className={`relative rounded-xl border-2 p-3 cursor-pointer flex items-center justify-between transition-colors
        ${plan.highlight ? 'border-violet-500 bg-violet-50/50 shadow-sm' : 'border-gray-100 hover:border-violet-400'}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
      onClick={() => !disabled && onPay()}
    >
      {plan.badge && (
        <div className={`absolute -top-2.5 left-4 ${plan.badgeColor} text-white px-2 py-0.5 rounded text-[10px] font-bold`}>
          {plan.badge}
        </div>
      )}
      <div className="text-left">
        <h4 className="font-semibold text-gray-900">{plan.name}</h4>
      </div>
      <div className="text-right flex items-center gap-2">
        {isLoading && <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />}
        <div>
          <span className="font-bold text-gray-900">{plan.price}₽</span>
          {plan.originalPrice && (
            <div className="text-[10px] text-gray-500 line-through">{plan.originalPrice}₽</div>
          )}
        </div>
      </div>
    </div>
  );
}
