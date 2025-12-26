import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { manageProfile } from '@/api/functions';
import { createPageUrl } from '@/utils';

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

  // Проверяем, есть ли уже профиль
  useEffect(() => {
    const checkProfile = async () => {
      if (!telegramId) return;
      
      try {
        const { data } = await manageProfile({
          action: 'get',
          data: { telegram_id: telegramId }
        });
        
        if (data.profile && data.profile.onboarding_completed) {
          window.location.href = createPageUrl('Dashboard');
        }
      } catch (error) {
        console.error('Error checking profile:', error);
      }
    };
    
    checkProfile();
  }, [telegramId]);

  const calculateNutrition = () => {
    const { gender, height, weight, age, activity_level, goal } = formData;
    
    // Формула Миффлина-Сан Жеора
    let bmr;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }
    
    // Коэффициент активности
    const activityMultipliers = {
      sedentary: 1.2,
      moderate: 1.55,
      active: 1.9
    };
    
    let tdee = bmr * activityMultipliers[activity_level];
    
    // Корректировка по цели
    const goalAdjustments = {
      gut_health: 1,
      weight_loss: 0.85,
      muscle_gain: 1.15,
      maintenance: 1
    };
    
    const dailyCalories = tdee * goalAdjustments[goal];
    
    // Расчёт БЖУ
    let proteinRatio, fatRatio, carbRatio;
    
    switch (goal) {
      case 'muscle_gain':
        proteinRatio = 0.3;
        fatRatio = 0.25;
        carbRatio = 0.45;
        break;
      case 'weight_loss':
        proteinRatio = 0.35;
        fatRatio = 0.3;
        carbRatio = 0.35;
        break;
      default:
        proteinRatio = 0.25;
        fatRatio = 0.3;
        carbRatio = 0.45;
    }
    
    const dailyProtein = (dailyCalories * proteinRatio) / 4;
    const dailyFat = (dailyCalories * fatRatio) / 9;
    const dailyCarbs = (dailyCalories * carbRatio) / 4;
    
    // Норма воды
    let waterNorm = weight * 30;
    if (activity_level === 'active') waterNorm *= 1.3;
    else if (activity_level === 'moderate') waterNorm *= 1.15;
    
    return {
      dailyCalories,
      dailyProtein,
      dailyFat,
      dailyCarbs,
      waterNorm
    };
  };

  const handleNext = () => {
    if (step === 3) {
      // После шага с целью - рассчитываем
      const nutrition = calculateNutrition();
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
      return;
    }
    
    setLoading(true);
    try {
      const nutrition = calculatedData || calculateNutrition();
      
      // Проверяем, есть ли уже профиль
      const { data: existing } = await manageProfile({
        action: 'get',
        data: { telegram_id: telegramId }
      });
      
      const profileData = {
        telegram_id: telegramId,
        full_name: telegramName || 'Пользователь',
        gender: formData.gender,
        height: formData.height,
        weight: formData.weight,
        age: formData.age,
        activity_level: formData.activity_level,
        goal: formData.goal,
        problems: formData.problems,
        daily_calories: Math.round(nutrition.dailyCalories),
        daily_protein: Math.round(nutrition.dailyProtein),
        daily_fat: Math.round(nutrition.dailyFat),
        daily_carbs: Math.round(nutrition.dailyCarbs),
        water_norm: Math.round(nutrition.waterNorm),
        total_points: 0,
        onboarding_completed: true
      };
      
      if (existing.profile) {
        // Обновляем существующий
        await manageProfile({
          action: 'update',
          data: profileData
        });
      } else {
        // Создаем новый
        await manageProfile({
          action: 'create',
          data: profileData
        });
      }
      
      window.location.href = createPageUrl('Dashboard');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Ошибка сохранения профиля');
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