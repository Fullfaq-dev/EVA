import React, { useEffect, useState } from 'react';
import { UserProfile } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { useTelegramAuth } from './useTelegramAuth';

export function AuthGuard({ children }) {
  const { telegramId, telegramName, loading: authLoading, error: authError } = useTelegramAuth();
  const [checking, setChecking] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(null);

  useEffect(() => {
    const checkUserProfile = async () => {
      if (authLoading) return;
      if (authError) {
        setChecking(false);
        return;
      }

      // Хаптик вибрация при старте проверки
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }

      if (!telegramId) {
        setShouldRedirect('Onboarding');
        setChecking(false);
        return;
      }

      try {
        // Проверяем есть ли профиль пользователя
        const profiles = await UserProfile.filter({ telegram_id: telegramId });
        
        // Хаптик вибрация при успешной проверке
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }

        const currentPath = window.location.pathname;
        
        if (profiles.length > 0 && profiles[0].onboarding_completed) {
          // Пользователь зарегистрирован
          if (currentPath === '/' || currentPath === '/home' || currentPath === '/onboarding') {
            setShouldRedirect('Dashboard');
          } else {
            // Пользователь уже на нужной странице
            setShouldRedirect(null);
          }
        } else {
          // Пользователь не прошел онбординг
          if (currentPath !== '/onboarding') {
            setShouldRedirect('Onboarding');
          } else {
            setShouldRedirect(null);
          }
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        setShouldRedirect('Onboarding');
      } finally {
        setChecking(false);
      }
    };

    checkUserProfile();
  }, [telegramId, authLoading, authError]);

  // Выполняем редирект если нужно
  useEffect(() => {
    if (shouldRedirect) {
      window.location.href = createPageUrl(shouldRedirect);
    }
  }, [shouldRedirect]);

  // Показываем загрузку пока проверяем
  if (checking || authLoading || shouldRedirect) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-emerald-500 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <span className="text-4xl animate-bounce">🥗</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">EVA nuti bot</h1>
          <p className="text-gray-500">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <span className="text-4xl">⚠️</span>
          </div>
          <p className="text-red-500 mb-2 font-semibold">Ошибка авторизации</p>
          <p className="text-gray-600 text-sm">{authError}</p>
        </div>
      </div>
    );
  }

  return children;
}
