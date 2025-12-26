import { useState, useEffect } from 'react';

export function useTelegramAuth() {
    const [telegramId, setTelegramId] = useState(null);
    const [telegramName, setTelegramName] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const verifyAuth = async () => {
            // Ждём загрузки Telegram WebApp
            let attempts = 0;
            while (!window.Telegram?.WebApp && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            try {
                // Проверяем наличие Telegram WebApp
                if (!window.Telegram?.WebApp) {
                    setError('Откройте приложение через Telegram бота');
                    setLoading(false);
                    return;
                }

                const tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();

                // Получаем данные пользователя
                const user = tg.initDataUnsafe?.user;
                
                if (!user || !user.id) {
                    setError('Не удалось получить данные пользователя из Telegram');
                    setLoading(false);
                    return;
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