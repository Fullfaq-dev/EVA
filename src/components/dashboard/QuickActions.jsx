import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Droplet, Activity, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function QuickActions({ onWaterClick, onExerciseClick }) {
  const actions = [
    {
      icon: Camera,
      label: 'Добавить еду',
      description: 'Фото или текст',
      color: 'emerald',
      link: 'FoodDiary'
    },
    {
      icon: Droplet,
      label: 'Выпил воду',
      description: '+250 мл',
      color: 'blue',
      onClick: onWaterClick
    },
    {
      icon: Activity,
      label: 'Разминка',
      description: 'Сделал!',
      color: 'purple',
      onClick: onExerciseClick
    },
    {
      icon: FileText,
      label: 'Анализы',
      description: 'Разбор',
      color: 'rose',
      link: 'Analysis'
    }
  ];

  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-50',
      icon: 'bg-emerald-500',
      text: 'text-emerald-700'
    },
    blue: {
      bg: 'bg-blue-50',
      icon: 'bg-blue-500',
      text: 'text-blue-700'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'bg-purple-500',
      text: 'text-purple-700'
    },
    rose: {
      bg: 'bg-rose-50',
      icon: 'bg-rose-500',
      text: 'text-rose-700'
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action, index) => {
        const Icon = action.icon;
        const colors = colorClasses[action.color];
        
        const content = (
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`${colors.bg} rounded-2xl p-4 cursor-pointer transition-shadow hover:shadow-md`}
          >
            <div className={`w-10 h-10 ${colors.icon} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <p className={`font-semibold ${colors.text}`}>{action.label}</p>
            <p className="text-sm text-gray-500 mt-0.5">{action.description}</p>
          </motion.div>
        );
        
        if (action.link) {
          return (
            <Link key={action.label} to={createPageUrl(action.link)}>
              {content}
            </Link>
          );
        }
        
        return (
          <div key={action.label} onClick={action.onClick}>
            {content}
          </div>
        );
      })}
    </div>
  );
}