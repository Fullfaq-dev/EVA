
import React, { useEffect } from 'react';
import { Toaster } from 'sonner';
import BottomNav from '@/components/navigation/BottomNav';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { SubscriptionGuard } from '@/components/auth/SubscriptionGuard';

export default function Layout({ children, currentPageName }) {
  const showNav = ['Dashboard', 'FoodDiary', 'Stats', 'Profile', 'Analysis', 'Actions'].includes(currentPageName);
  const isSubscriptionProtected = currentPageName !== 'Onboarding' && currentPageName !== 'Home';
  
  // Подключаем Telegram WebApp SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    document.head.appendChild(script);
    
    return () => {
      document.head.removeChild(script);
    };
  }, []);
  
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <style>{`
          :root {
            --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
          }
          .pb-safe {
            padding-bottom: max(8px, env(safe-area-inset-bottom));
          }
          body {
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }
          input, textarea {
            -webkit-user-select: auto;
            user-select: auto;
          }
        `}</style>
        
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              borderRadius: '12px'
            }
          }}
        />
        
        <main className={showNav ? 'pb-20' : ''}>
          {isSubscriptionProtected ? (
            <SubscriptionGuard>
              {children}
            </SubscriptionGuard>
          ) : (
            children
          )}
        </main>
        
        {showNav && <BottomNav />}
      </div>
    </AuthGuard>
  );
}
