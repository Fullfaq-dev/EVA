import { useState, useEffect } from 'react';

export function useTelegramAuth() {
    const [telegramId, setTelegramId] = useState(null);
    const [telegramName, setTelegramName] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const verifyAuth = async () => {
            // Ждём загрузки Telegram WebApp (увеличиваем время ожидания до 10 секунд)
            let attempts = 0;
            const maxAttempts = 100;
            
            while (!window.Telegram?.WebApp && attempts < maxAttempts) {
                // Если скрипт еще не загружен, пробуем пересоздать его (на случай блокировки или сбоя загрузки)
                if (attempts === 20 || attempts === 50) {
                    console.warn(`Telegram SDK loading attempt ${attempts}: script not found, retrying...`);
                    const existingScript = document.querySelector('script[src*="telegram-web-app.js"]');
                    if (existingScript) {
                        const newScript = document.createElement('script');
                        newScript.src = `https://telegram.org/js/telegram-web-app.js?v=${Date.now()}`;
                        newScript.async = true;
                        existingScript.parentNode.replaceChild(newScript, existingScript);
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            try {
                // Проверяем наличие Telegram WebApp
                if (!window.Telegram?.WebApp) {
                    console.error('Telegram SDK failed to load after 10 seconds');
                    throw new Error('Telegram SDK не загружен. Проверьте интернет-соединение или попробуйте использовать VPN.');
                }

                const tg = window.Telegram.WebApp;
                
                // Сообщаем Telegram, что приложение готово
                tg.ready();
                
                // Раскрываем на всю высоту
                if (tg.expand) tg.expand();

                // Получаем данные пользователя
                const user = tg.initDataUnsafe?.user;
                
                if (!user || !user.id) {
                    // В режиме разработки или если открыто не через бота
                    console.warn('User data missing from Telegram initDataUnsafe');
                    throw new Error('Откройте приложение через Telegram бота');
                }

                // Устанавливаем данные пользователя
                const userId = String(user.id);
                const userName = `${user.first_name} ${user.last_name || ''}`.trim();
                
                console.log('Telegram Auth:', { userId, userName });
                
                setTelegramId(userId);
                setTelegramName(userName);
            } catch (err) {
                console.error('Auth error:', err);
                setError(err.message || 'Ошибка авторизации');
            } finally {
                setLoading(false);
            }
        };

        verifyAuth();
    }, []);

    return { telegramId, telegramName, loading, error };
}