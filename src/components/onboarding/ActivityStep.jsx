import React from 'react';
import { motion } from 'framer-motion';
import { Armchair, PersonStanding, Flame } from 'lucide-react';

const activities = [
  {
    id: 'sedentary',
    icon: Armchair,
    title: 'Низкая активность',
    color: 'blue'
  },
  {
    id: 'moderate',
    icon: PersonStanding,
    title: 'Умеренная активность',
    color: 'amber'
  },
  {
    id: 'active',
    icon: Flame,
    title: 'Высокая активность',
    color: 'emerald'
  }
];

const colorClasses = {
  blue: {
    bg: 'bg-blue-100',
    bgActive: 'bg-blue-500',
    text: 'text-blue-600',
    border: 'border-blue-500',
    bgLight: 'bg-blue-50'
  },
  amber: {
    bg: 'bg-amber-100',
    bgActive: 'bg-amber-500',
    text: 'text-amber-600',
    border: 'border-amber-500',
    bgLight: 'bg-amber-50'
  },
  emerald: {
    bg: 'bg-emerald-100',
    bgActive: 'bg-emerald-500',
    text: 'text-emerald-600',
    border: 'border-emerald-500',
    bgLight: 'bg-emerald-50'
  }
};

export default function ActivityStep({ value, onChange }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Уровень активности</h2>
        <p className="text-gray-500 mt-2">Насколько вы физически активны?</p>
      </div>
      
      <div className="space-y-3">
        {activities.map((activity) => {
          const Icon = activity.icon;
          const colors = colorClasses[activity.color];
          const isSelected = value === activity.id;
          
          return (
            <motion.button
              key={activity.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onChange(activity.id)}
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
                  {activity.title}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}