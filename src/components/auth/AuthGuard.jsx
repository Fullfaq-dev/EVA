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
    return <LoadingScreen />;
  }

  function LoadingScreen() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setProgress(prev => (prev < 10 ? prev + 1 : prev));
      }, 200);
      return () => clearInterval(interval);
    }, []);

    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-48 h-48 mx-auto mb-8 flex items-center justify-center">
            <img
              src="/assets/logo.webp"
              alt="EVA Logo"
              className="w-full h-full object-contain"
            />
          </div>
          
          <div className="flex gap-2 justify-center mb-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i < progress
                    ? 'bg-emerald-500 scale-110 shadow-sm shadow-emerald-200'
                    : 'bg-emerald-100'
                }`}
                style={{
                  // Имитация формы листика/тарелки через border-radius
                  borderRadius: '60% 40% 60% 40% / 60% 40% 60% 40%'
                }}
              />
            ))}
          </div>
          
          <h1 className="text-xl font-bold text-emerald-900 mb-1">EVA nutri bot</h1>
          <p className="text-emerald-600/60 text-sm font-medium">Загрузка...</p>
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
