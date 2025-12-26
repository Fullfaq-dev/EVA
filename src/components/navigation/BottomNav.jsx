import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, BookOpen, BarChart2, User } from 'lucide-react';

const navItems = [
  { icon: Home, label: 'Главная', page: 'Dashboard' },
  { icon: BookOpen, label: 'Дневник', page: 'FoodDiary' },
  { icon: BarChart2, label: 'Статистика', page: 'Stats' },
  { icon: User, label: 'Профиль', page: 'Profile' }
];

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname.toLowerCase();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 pb-safe z-50">
      <div className="max-w-md mx-auto flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const url = createPageUrl(item.page);
          const isActive = currentPath.includes(item.page.toLowerCase());
          
          return (
            <Link
              key={item.page}
              to={url}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                isActive 
                  ? 'text-emerald-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}