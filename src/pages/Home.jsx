import React from 'react';

export default function Home() {
  // Эта страница используется только как точка входа
  // Фактическая проверка и редирект происходят в AuthGuard
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-72 h-72 mx-auto mb-8 flex items-center justify-center">
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
              className="w-3 h-3 rounded-full bg-emerald-100"
              style={{
                borderRadius: '60% 40% 60% 40% / 60% 40% 60% 40%'
              }}
            />
          ))}
        </div>
        
        <h1 className="text-xl font-bold text-emerald-900 mb-1">EVA NutriBot</h1>
        <p className="text-emerald-600/60 text-sm font-medium">Загрузка...</p>
      </div>
    </div>
  );
}
