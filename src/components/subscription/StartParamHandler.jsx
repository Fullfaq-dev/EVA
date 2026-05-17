import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTelegramStartParam } from '@/hooks/useTelegramStartParam';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';
import { Reminder } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

/**
 * Обрабатывает ?startapp= из кнопок воронки бота.
 */
export function StartParamHandler() {
  const startParam = useTelegramStartParam();
  const { telegramId } = useTelegramAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!startParam || !telegramId) return;

    const run = async () => {
      if (startParam === 'subscribe') {
        navigate(createPageUrl('Profile') + '?pay=1', { replace: true });
        return;
      }

      if (startParam === 'water_reminders') {
        try {
          const existing = await Reminder.filter({ user_telegram_id: telegramId, type: 'water' });
          if (existing[0]) {
            await Reminder.update(existing[0].id, { enabled: true, interval_hours: 2 });
          } else {
            await Reminder.create({
              user_telegram_id: telegramId,
              type: 'water',
              enabled: true,
              interval_hours: 2,
            });
          }
          queryClient.invalidateQueries(['reminders', telegramId]);
          toast.success('💧 Напоминания о воде включены');
        } catch (e) {
          console.error('[StartParam] water_reminders:', e);
        }
        navigate(createPageUrl('Profile'), { replace: true });
        return;
      }

      if (startParam === 'onboarding') {
        navigate(createPageUrl('Onboarding'), { replace: true });
      }
    };

    run();
  }, [startParam, telegramId, navigate, queryClient]);

  return null;
}
