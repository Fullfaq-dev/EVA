import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Check } from 'lucide-react';

export function LoadingOverlay({
  isLoading,
  isSuccess,
  onComplete,
  message = "Загрузка данных...",
  successTitle = "Успешно загружено!",
  successMessage = "Данные сохранены и отправлены на обработку"
}) {
  const [progress, setProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset state when loading starts
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      setShowSuccess(false);
      
      // Simulate progress
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          // Slow down as we get closer to 90%
          const increment = Math.max(1, (90 - prev) / 10);
          return prev + increment;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // Handle success state
  useEffect(() => {
    if (isSuccess && !isLoading) {
      setProgress(100);
      setShowSuccess(true);
      
      // Fire confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
      });

      // Close after delay
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
        setShowSuccess(false); // Reset for next time
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, isLoading, onComplete]);

  return (
    <AnimatePresence>
      {(isLoading || showSuccess) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center relative overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500" />

            <div className="mb-6 flex justify-center items-center h-24">
              {showSuccess ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center"
                >
                  <Check className="w-10 h-10 text-emerald-600" strokeWidth={3} />
                </motion.div>
              ) : (
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      className="text-gray-100 stroke-current"
                      strokeWidth="8"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                    />
                    <motion.circle
                      className="text-emerald-500 stroke-current"
                      strokeWidth="8"
                      strokeLinecap="round"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - progress / 100) }}
                      transition={{ duration: 0.5 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-700">{Math.round(progress)}%</span>
                  </div>
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {showSuccess ? successTitle : message}
            </h3>
            
            <p className="text-gray-500 text-sm mb-6 whitespace-pre-line">
              {showSuccess
                ? successMessage
                : "Пожалуйста, не закрывайте страницу до завершения загрузки"}
            </p>

            {!showSuccess && (
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <motion.div 
                  className="h-full bg-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
