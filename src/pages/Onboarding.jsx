import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { manageProfile } from '@/api/functions';
import { createPageUrl } from '@/utils';
import { calculateNutrition } from '@/utils/nutritionCalculator';
import { toast } from 'sonner';

import GenderStep from '@/components/onboarding/GenderStep';
import MeasurementsStep from '@/components/onboarding/MeasurementsStep';
import ActivityStep from '@/components/onboarding/ActivityStep';
import GoalStep from '@/components/onboarding/GoalStep';
import ProblemsStep from '@/components/onboarding/ProblemsStep';
import ResultStep from '@/components/onboarding/ResultStep';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';

export default function Onboarding() {
  const { telegramId, telegramName, loading: authLoading, error: authError } = useTelegramAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    gender: '',
    height: null,
    weight: null,
    age: null,
    activity_level: '',
    goal: '',
    problems: ''
  });
  const [calculatedData, setCalculatedData] = useState(null);

  const calculateNutritionData = () => {
    return calculateNutrition(formData);
  };

  const handleNext = () => {
    if (step === 3) {
      // После шага с целью - рассчитываем
      const nutrition = calculateNutritionData();
      console.log('Calculated nutrition:', nutrition);
      console.log('Form data:', formData);
      setCalculatedData(nutrition);
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleComplete = async () => {
    if (!telegramId) {
      toast.error('Ошибка: не получен Telegram ID');
      console.error('Telegram ID not found');
      return;
    }
    
    setLoading(true);
    try {
      const nutrition = calculatedData || calculateNutritionData();
      
      console.log('Starting profile save with telegram_id:', telegramId);
      console.log('Form data:', formData);
      console.log('Nutrition data:', nutrition);
      
      // Проверяем, есть ли уже профиль
      const { data: existing } = await manageProfile({
        action: 'get',
        data: { telegram_id: telegramId }
      });
      
      console.log('Existing profile:', existing);
      
      const profileData = {
        telegram_id: telegramId,
        full_name: telegramName || 'Пользователь',
        gender: formData.gender,
        height: parseInt(formData.height),
        weight: parseFloat(formData.weight),
        age: parseInt(formData.age),
        activity_level: formData.activity_level,
        goal: formData.goal,
        problems: formData.problems || '',
        daily_calories: Math.round(nutrition.dailyCalories),
        daily_protein: Math.round(nutrition.dailyProtein),
        daily_fat: Math.round(nutrition.dailyFat),
        daily_carbs: Math.round(nutrition.dailyCarbs),
        water_norm: Math.round(nutrition.waterNorm),
        bmi: nutrition.bmi,
        weight_status: nutrition.weightStatus,
        total_points: 0,
        onboarding_completed: true
      };
      
      console.log('Profile data to save:', profileData);
      
      let result;
      if (existing.profile) {
        console.log('Updating existing profile...');
        result = await manageProfile({
          action: 'update',
          data: profileData
        });
      } else {
        console.log('Creating new profile...');
        result = await manageProfile({
          action: 'create',
          data: profileData
        });
      }
      
      console.log('Save result:', result);
      toast.success('Профиль успешно сохранён!');
      
      setTimeout(() => {
        window.location.href = createPageUrl('Dashboard');
      }, 500);
    } catch (error) {
      console.error('Error saving profile:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        error: error
      });
      
      // Показываем более детальную ошибку
      const errorMessage = error.message || 'Неизвестная ошибка';
      toast.error(`Ошибка сохранения профиля: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isStepValid = () => {
    switch (step) {
      case 0: return formData.gender !== '';
      case 1: return formData.height > 0 && formData.weight > 0 && formData.age > 0;
      case 2: return formData.activity_level !== '';
      case 3: return formData.goal !== '';
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const steps = [
    <GenderStep 
      key="gender"
      value={formData.gender} 
      onChange={(v) => updateFormData('gender', v)} 
    />,
    <MeasurementsStep 
      key="measurements"
      height={formData.height}
      weight={formData.weight}
      age={formData.age}
      onChange={updateFormData}
    />,
    <ActivityStep 
      key="activity"
      value={formData.activity_level} 
      onChange={(v) => updateFormData('activity_level', v)} 
    />,
    <GoalStep 
      key="goal"
      value={formData.goal} 
      onChange={(v) => updateFormData('goal', v)} 
    />,
    <ProblemsStep 
      key="problems"
      value={formData.problems} 
      onChange={(v) => updateFormData('problems', v)} 
    />,
    <ResultStep 
      key="result"
      calories={calculatedData?.dailyCalories || 0}
      protein={calculatedData?.dailyProtein || 0}
      fat={calculatedData?.dailyFat || 0}
      carbs={calculatedData?.dailyCarbs || 0}
      waterNorm={calculatedData?.waterNorm || 0}
      goal={formData.goal}
    />
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Загрузка...</div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-2">Ошибка авторизации</p>
          <p className="text-gray-600 text-sm">{authError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 mx-0.5 rounded-full transition-colors ${
                  i <= step ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-500 text-center">
            Шаг {step + 1} из 6
          </p>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 h-12 rounded-xl"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Назад
            </Button>
          )}
          
          {step < 5 ? (
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
              className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600"
            >
              Далее
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Сохранение...
                </span>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-1" />
                  Начать
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}