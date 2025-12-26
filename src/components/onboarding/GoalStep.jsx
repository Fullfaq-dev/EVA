import React from 'react';
import { motion } from 'framer-motion';
import { Heart, TrendingDown, Dumbbell, Scale } from 'lucide-react';

const goals = [
  {
    id: 'gut_health',
    icon: Heart,
    title: 'Наладить работу ЖКТ',
    description: 'Улучшить пищеварение и самочувствие',
    color: 'rose'
  },
  {
    id: 'weight_loss',
    icon: TrendingDown,
    title: 'Похудеть',
    description: 'Снизить вес и уменьшить жировую массу',
    color: 'orange'
  },
  {
    id: 'muscle_gain',
    icon: Dumbbell,
    title: 'Набор мышечной массы',
    description: 'Увеличить мышечную массу',
    color: 'blue'
  },
  {
    id: 'maintenance',
    icon: Scale,
    title: 'Поддержание веса',
    description: 'Сохранить текущую форму',
    color: 'emerald'
  }
];

const colorClasses = {
  rose: {
    bg: 'bg-rose-100',
    bgActive: 'bg-rose-500',
    text: 'text-rose-600',
    border: 'border-rose-500',
    bgLight: 'bg-rose-50'
  },
  orange: {
    bg: 'bg-orange-100',
    bgActive: 'bg-orange-500',
    text: 'text-orange-600',
    border: 'border-orange-500',
    bgLight: 'bg-orange-50'
  },
  blue: {
    bg: 'bg-blue-100',
    bgActive: 'bg-blue-500',
    text: 'text-blue-600',
    border: 'border-blue-500',
    bgLight: 'bg-blue-50'
  },
  emerald: {
    bg: 'bg-emerald-100',
    bgActive: 'bg-emerald-500',
    text: 'text-emerald-600',
    border: 'border-emerald-500',
    bgLight: 'bg-emerald-50'
  }
};

export default function GoalStep({ value, onChange }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Ваша цель</h2>
        <p className="text-gray-500 mt-2">Чего вы хотите достичь?</p>
      </div>
      
      <div className="space-y-3">
        {goals.map((goal) => {
          const Icon = goal.icon;
          const colors = colorClasses[goal.color];
          const isSelected = value === goal.id;
          
          return (
            <motion.button
              key={goal.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onChange(goal.id)}
              className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                isSelected 
                  ? `${colors.border} ${colors.bgLight}` 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isSelected ? colors.bgActive : colors.bg
              }`}>
                <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : colors.text}`} />
              </div>
              <div className="text-left">
                <p className={`font-medium ${isSelected ? colors.text : 'text-gray-700'}`}>
                  {goal.title}
                </p>
                <p className="text-sm text-gray-500">{goal.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}