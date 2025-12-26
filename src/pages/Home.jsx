import React, { useEffect, useState } from 'react';
import { UserProfile } from '@/api/entities';
import { createPageUrl } from '@/utils';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const checkUser = async () => {
      let telegramId = null;
      
      // Получаем Telegram ID
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        
        if (tg.initDataUnsafe?.user) {
          telegramId = String(tg.initDataUnsafe.user.id);
        }
      }
      
      if (telegramId) {
        // Проверяем есть ли профиль
        const profiles = await UserProfile.filter({ telegram_id: telegramId });
        
        if (profiles.length > 0 && profiles[0].onboarding_completed) {
          window.location.href = createPageUrl('Dashboard');
        } else {
          window.location.href = createPageUrl('Onboarding');
        }
      } else {
        // Если нет Telegram - редирект на онбординг для тестирования
        window.location.href = createPageUrl('Onboarding');
      }
      
      setIsLoading(false);
    };
    
    checkUser();
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-emerald-500 rounded-3xl mx-auto mb-6 flex items-center justify-center animate-pulse">
          <span className="text-4xl">🥗</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">NutriBot</h1>
        <p className="text-gray-500">Загрузка...</p>
      </div>
    </div>
  );
}