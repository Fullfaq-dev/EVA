import React from 'react';
import { motion } from 'framer-motion';
import { User, UserCircle } from 'lucide-react';

export default function GenderStep({ value, onChange }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Ваш пол</h2>
        <p className="text-gray-500 mt-2">Это поможет точнее рассчитать норму калорий</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChange('male')}
          className={`p-6 rounded-2xl border-2 transition-all ${
            value === 'male' 
              ? 'border-emerald-500 bg-emerald-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
            value === 'male' ? 'bg-emerald-500' : 'bg-gray-100'
          }`}>
            <User className={`w-8 h-8 ${value === 'male' ? 'text-white' : 'text-gray-400'}`} />
          </div>
          <p className={`mt-4 font-medium ${value === 'male' ? 'text-emerald-700' : 'text-gray-700'}`}>
            Мужской
          </p>
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChange('female')}
          className={`p-6 rounded-2xl border-2 transition-all ${
            value === 'female' 
              ? 'border-emerald-500 bg-emerald-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
            value === 'female' ? 'bg-emerald-500' : 'bg-gray-100'
          }`}>
            <UserCircle className={`w-8 h-8 ${value === 'female' ? 'text-white' : 'text-gray-400'}`} />
          </div>
          <p className={`mt-4 font-medium ${value === 'female' ? 'text-emerald-700' : 'text-gray-700'}`}>
            Женский
          </p>
        </motion.button>
      </div>
    </div>
  );
}