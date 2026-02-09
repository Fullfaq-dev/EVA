import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manageProfile } from '@/api/functions';
import { DailyStats, UserProfile } from '@/api/entities';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import QuickActions from '@/components/dashboard/QuickActions';
import WorkoutSelector from '@/components/dashboard/WorkoutSelector';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';

export default function Actions() {
  const { telegramId } = useTelegramAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: profile } = useQuery({
    queryKey: ['profile', telegramId],
    queryFn: async () => {
      if (!telegramId) return null;
      const { data } = await manageProfile({
        action: 'get',
        data: { telegram_id: telegramId }
      });
      return data.profile;
    },
    enabled: !!telegramId
  });

  const { data: todayStats } = useQuery({
    queryKey: ['dailyStats', telegramId, today],
    queryFn: async () => {
      if (!telegramId) return null;
      const stats = await DailyStats.filter({
        user_telegram_id: telegramId,
        date: today
      });
      return stats[0] || {
        total_calories: 0,
        total_protein: 0,
        total_fat: 0,
        total_carbs: 0,
        water_glasses: 0,
        exercises_done: 0,
        burned_calories: 0,
        points_earned: 0
      };
    },
    enabled: !!telegramId
  });

  const updateStatsMutation = useMutation({
    mutationFn: async (updates) => {
      const stats = await DailyStats.filter({
        user_telegram_id: telegramId,
        date: today
      });
      
      if (stats[0]) {
        return DailyStats.update(stats[0].id, updates);
      } else {
        return DailyStats.create({
          user_telegram_id: telegramId,
          date: today,
          ...updates
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dailyStats']);
    }
  });

  const updateProfilePointsMutation = useMutation({
    mutationFn: async (pointsToAdd) => {
      if (!profile) return;
      return UserProfile.update(profile.id, {
        total_points: (profile.total_points || 0) + pointsToAdd
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
    }
  });

  const handleWaterClick = () => {
    const newGlasses = (todayStats?.water_glasses || 0) + 1;
    updateStatsMutation.mutate({
      water_glasses: newGlasses,
      points_earned: (todayStats?.points_earned || 0) + 5
    });
    updateProfilePointsMutation.mutate(5);
    toast.success('+250 мл воды! +5 баллов', { icon: '💧' });
  };

  const [isWorkoutSelectorOpen, setIsWorkoutSelectorOpen] = useState(false);

  const handleExerciseClick = () => {
    setIsWorkoutSelectorOpen(true);
  };

  const handleWorkoutSelect = (workoutType) => {
    const newExercises = (todayStats?.exercises_done || 0) + 1;
    const newBurnedCalories = (todayStats?.burned_calories || 0) + workoutType.calories;
    
    updateStatsMutation.mutate({
      exercises_done: newExercises,
      burned_calories: newBurnedCalories,
      points_earned: (todayStats?.points_earned || 0) + workoutType.points
    });
    updateProfilePointsMutation.mutate(workoutType.points);
    toast.success(`${workoutType.label} выполнена! +${workoutType.points} баллов`, { icon: '💪' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Действия</h1>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <QuickActions 
            onWaterClick={handleWaterClick}
            onExerciseClick={handleExerciseClick}
          />
        </motion.div>

        <WorkoutSelector
          isOpen={isWorkoutSelectorOpen}
          onClose={() => setIsWorkoutSelectorOpen(false)}
          onSelect={handleWorkoutSelect}
        />
      </div>
    </div>
  );
}
