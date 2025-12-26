import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Beef, Droplet, Wheat } from 'lucide-react';

export default function DailyProgress({ current, target }) {
  const stats = [
    {
      icon: Flame,
      label: 'Калории',
      current: current.calories,
      target: target.calories,
      unit: 'ккал',
      color: 'orange'
    },
    {
      icon: Beef,
      label: 'Белки',
      current: current.protein,
      target: target.protein,
      unit: 'г',
      color: 'red'
    },
    {
      icon: Droplet,
      label: 'Жиры',
      current: current.fat,
      target: target.fat,
      unit: 'г',
      color: 'amber'
    },
    {
      icon: Wheat,
      label: 'Углеводы',
      current: current.carbs,
      target: target.carbs,
      unit: 'г',
      color: 'emerald'
    }
  ];

  const colorClasses = {
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500'
  };

  const bgColorClasses = {
    orange: 'bg-orange-100',
    red: 'bg-red-100',
    amber: 'bg-amber-100',
    emerald: 'bg-emerald-100'
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Прогресс за сегодня</h3>
      <div className="space-y-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const percentage = Math.min((stat.current / stat.target) * 100, 100);
          
          return (
            <div key={stat.label}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${bgColorClasses[stat.color]} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${colorClasses[stat.color].replace('bg-', 'text-')}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{stat.label}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {Math.round(stat.current)} / {Math.round(stat.target)} {stat.unit}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`h-full ${colorClasses[stat.color]} rounded-full`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}