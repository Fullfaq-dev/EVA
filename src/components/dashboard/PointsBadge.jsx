import React from 'react';
import { motion } from 'framer-motion';
import { Star, Trophy } from 'lucide-react';

export default function PointsBadge({ points, level }) {
  const getLevelInfo = (pts) => {
    if (pts >= 1000) return { level: 'Мастер', nextLevel: null, progress: 100, color: 'amber' };
    if (pts >= 500) return { level: 'Эксперт', nextLevel: 1000, progress: ((pts - 500) / 500) * 100, color: 'purple' };
    if (pts >= 100) return { level: 'Продвинутый', nextLevel: 500, progress: ((pts - 100) / 400) * 100, color: 'blue' };
    return { level: 'Новичок', nextLevel: 100, progress: (pts / 100) * 100, color: 'emerald' };
  };

  const levelInfo = getLevelInfo(points);

  const colorClasses = {
    emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700' },
    blue: { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700' },
    purple: { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
    amber: { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700' }
  };

  const colors = colorClasses[levelInfo.color];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center`}>
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Уровень</p>
            <p className={`font-bold ${colors.text}`}>{levelInfo.level}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-xl font-bold text-gray-900">{points}</span>
          </div>
          <p className="text-xs text-gray-500">баллов</p>
        </div>
      </div>
      
      {levelInfo.nextLevel && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{points} / {levelInfo.nextLevel}</span>
            <span>До следующего уровня</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelInfo.progress}%` }}
              className={`h-full ${colors.bg} rounded-full`}
            />
          </div>
        </div>
      )}
    </div>
  );
}