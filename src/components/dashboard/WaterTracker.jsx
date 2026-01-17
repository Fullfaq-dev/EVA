import React from 'react';
import { motion } from 'framer-motion';
import { Droplet } from 'lucide-react';

export default function WaterTracker({ glasses, targetMl, onFullNormClick }) {
  const glassSize = 250; // мл
  const targetGlasses = Math.ceil(targetMl / glassSize);
  const currentMl = glasses * glassSize;
  const percentage = Math.min((currentMl / targetMl) * 100, 100);
  const isFull = glasses >= targetGlasses;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-100 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <Droplet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Вода</p>
            <p className="text-xs text-gray-500">Норма: {Math.round(targetMl)} мл</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">{currentMl}</p>
          <p className="text-xs text-gray-500">мл выпито</p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-3">
        {Array.from({ length: Math.min(targetGlasses, 12) }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: i < glasses ? 1 : 0.9, 
              opacity: 1 
            }}
            transition={{ delay: i * 0.05 }}
            className={`flex-1 h-8 rounded-lg flex items-center justify-center ${
              i < glasses 
                ? 'bg-blue-500' 
                : 'bg-white border border-blue-200'
            }`}
          >
            <Droplet className={`w-3 h-3 ${i < glasses ? 'text-white' : 'text-blue-200'}`} />
          </motion.div>
        ))}
      </div>

      <div className="h-2 bg-white rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full"
        />
      </div>
      
      <div className="flex items-center justify-between mt-3">
        <p className="text-sm text-blue-600 font-medium">
          {glasses} / {targetGlasses} стаканов
        </p>
        {!isFull && onFullNormClick && (
          <button
            onClick={onFullNormClick}
            className="text-xs bg-blue-500 text-white px-3 py-1 rounded-full hover:bg-blue-600 transition-colors shadow-sm"
          >
            Выпил всю норму
          </button>
        )}
        {isFull && (
          <span className="text-xs bg-green-500 text-white px-3 py-1 rounded-full shadow-sm">
            Норма выполнена!
          </span>
        )}
      </div>
    </div>
  );
}