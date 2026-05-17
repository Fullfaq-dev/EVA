import { useEffect, useState } from 'react';

/** startapp из Telegram Mini App (t.me/.../app?startapp=...) */
export function useTelegramStartParam() {
  const [startParam, setStartParam] = useState(null);

  useEffect(() => {
    const read = () => {
      const fromTg = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      if (fromTg) {
        setStartParam(String(fromTg));
        return;
      }
      const fromUrl = new URLSearchParams(window.location.search).get('startapp');
      if (fromUrl) setStartParam(fromUrl);
    };

    read();
    const t = setTimeout(read, 300);
    return () => clearTimeout(t);
  }, []);

  return startParam;
}
