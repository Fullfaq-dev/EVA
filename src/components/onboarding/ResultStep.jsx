import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Beef, Droplet, Wheat, Sparkles } from 'lucide-react';

export default function ResultStep({ calories, protein, fat, carbs, waterNorm, goal }) {
  const goalLabels = {
    gut_health: 'Здоровье ЖКТ',
    weight_loss: 'Похудение',
    muscle_gain: 'Набор массы',
    maintenance: 'Поддержание'
  };

  const stats = [
    { 
      icon: Flame, 
      label: 'Калории', 
      value: calories, 
      unit: 'ккал',
      color: 'bg-orange-500',
      bgLight: 'bg-orange-100'
    },
    { 
      icon: Beef, 
      label: 'Белки', 
      value: protein, 
      unit: 'г',
      color: 'bg-red-500',
      bgLight: 'bg-red-100'
    },
    { 
      icon: Droplet, 
      label: 'Жиры', 
      value: fat, 
      unit: 'г',
      color: 'bg-amber-500',
      bgLight: 'bg-amber-100'
    },
    { 
      icon: Wheat, 
      label: 'Углеводы', 
      value: carbs, 
      unit: 'г',
      color: 'bg-emerald-500',
      bgLight: 'bg-emerald-100'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4"
        >
          <Sparkles className="w-8 h-8 text-emerald-600" />
        </motion.div>
        <h2 className="text-2xl font-semibold text-gray-900">Ваш план готов!</h2>
        <p className="text-gray-500 mt-2">
          Расчёт по формуле Миффлина-Сан Жеора для цели "{goalLabels[goal]}"
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
            >
              <div className={`w-10 h-10 rounded-xl ${stat.bgLight} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${stat.color.replace('bg-', 'text-')}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{Math.round(stat.value)}</p>
              <p className="text-sm text-gray-500">{stat.label} ({stat.unit})</p>
            </motion.div>
          );
        })}
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-blue-50 rounded-2xl p-4 border border-blue-100"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Droplet className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-blue-900">{Math.round(waterNorm)} мл</p>
            <p className="text-sm text-blue-600">Норма воды в день</p>
          </div>
        </div>
      </motion.div>
      
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-sm text-gray-600 text-center">
          ✨ Начните вести пищевой дневник, чтобы следить за прогрессом
        </p>
      </div>
    </div>
  );
}