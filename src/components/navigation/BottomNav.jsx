import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, BookOpen, BarChart2, User, Zap } from 'lucide-react';

const navItems = [
  { icon: Home, label: 'Главная', page: 'Dashboard' },
  { icon: Zap, label: 'Действия', page: 'Actions', pulse: true },
  { icon: BookOpen, label: 'Дневник', page: 'FoodDiary' },
  { icon: BarChart2, label: 'Статистика', page: 'Stats' },
  { icon: User, label: 'Профиль', page: 'Profile' }
];

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname.toLowerCase();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe z-50">
      <div className="max-w-md mx-auto flex items-center overflow-x-auto no-scrollbar py-2 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const url = createPageUrl(item.page);
          const isActive = currentPath.includes(item.page.toLowerCase());

          const iconEl = item.pulse ? (
            <div className="relative flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-50 animate-ping" />
              <span className="absolute inset-[-4px] rounded-full bg-emerald-300 opacity-20 animate-pulse-slow" />
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-emerald-400'} shadow-md`}>
                <Icon className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
            </div>
          ) : (
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
          );
          
          return (
            <Link
              key={item.page}
              to={url}
              className={`flex flex-col items-center gap-1 min-w-[80px] px-2 py-2 rounded-xl transition-colors flex-shrink-0 ${
                isActive
                  ? 'text-emerald-600'
                  : item.pulse
                  ? 'text-emerald-500 hover:text-emerald-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {iconEl}
              <span className={`text-xs font-medium whitespace-nowrap ${item.pulse ? 'text-emerald-600 font-semibold' : ''}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}