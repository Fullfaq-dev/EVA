import { useState, useEffect } from 'react';

export function useTelegramAuth() {
    const [telegramId, setTelegramId] = useState(null);
    const [telegramName, setTelegramName] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const verifyAuth = async () => {
            // Ждём загрузки Telegram WebApp (увеличиваем время ожидания до 5 секунд)
            let attempts = 0;
            const maxAttempts = 50;
            
            while (!window.Telegram?.WebApp && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            try {
                // Проверяем наличие Telegram WebApp
                if (!window.Telegram?.WebApp) {
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