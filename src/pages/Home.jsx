import React from 'react';

export default function Home() {
  // Эта страница используется только как точка входа
  // Фактическая проверка и редирект происходят в AuthGuard
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-emerald-500 rounded-3xl mx-auto mb-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">NutriBot</h1>
        <p className="text-gray-500">Загрузка...</p>
      </div>
    </div>
  );
}
