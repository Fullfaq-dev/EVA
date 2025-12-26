import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manageProfile } from '@/api/functions';
import { DailyStats, UserProfile } from '@/api/entities';
import { motion } from 'framer-motion';
import { Settings, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';

import DailyProgress from '@/components/dashboard/DailyProgress';
import QuickActions from '@/components/dashboard/QuickActions';
import PointsBadge from '@/components/dashboard/PointsBadge';
import WaterTracker from '@/components/dashboard/WaterTracker';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';

export default function Dashboard() {
  const { telegramId, telegramName, loading: authLoading, error: authError } = useTelegramAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', telegramId],
    queryFn: async () => {
      if (!telegramId) return null;
      console.log('Dashboard: Fetching profile for telegram_id:', telegramId);
      const { data } = await manageProfile({
        action: 'get',
        data: { telegram_id: telegramId }
      });
      console.log('Dashboard: Profile result:', data.profile);
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

  const handleExerciseClick = () => {
    const newExercises = (todayStats?.exercises_done || 0) + 1;
    updateStatsMutation.mutate({
      exercises_done: newExercises,
      points_earned: (todayStats?.points_earned || 0) + 10
    });
    updateProfilePointsMutation.mutate(10);
    toast.success('Разминка выполнена! +10 баллов', { icon: '💪' });
  };

  // Редирект на онбординг если нет профиля
  useEffect(() => {
    if (!authLoading && telegramId && !profileLoading && !profile) {
      window.location.href = createPageUrl('Onboarding');
    }
  }, [authLoading, telegramId, profileLoading, profile]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Загрузка...</div>
      </div>
    );
  }

  if (!profile) {
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-500 text-sm">
              {format(new Date(), "d MMMM, EEEE", { locale: ru })}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              Привет, {profile.full_name?.split(' ')[0] || 'друг'}! 👋
            </h1>
          </div>
          <Link 
            to={createPageUrl('Profile')}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"
          >
            <User className="w-5 h-5 text-gray-600" />
          </Link>
        </div>

        {/* Points Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <PointsBadge points={profile.total_points || 0} />
        </motion.div>

        {/* Daily Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-5"
        >
          <DailyProgress
            current={{
              calories: todayStats?.total_calories || 0,
              protein: todayStats?.total_protein || 0,
              fat: todayStats?.total_fat || 0,
              carbs: todayStats?.total_carbs || 0
            }}
            target={{
              calories: profile.daily_calories || 2000,
              protein: profile.daily_protein || 100,
              fat: profile.daily_fat || 70,
              carbs: profile.daily_carbs || 250
            }}
          />
        </motion.div>

        {/* Water Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-5"
        >
          <WaterTracker 
            glasses={todayStats?.water_glasses || 0} 
            targetMl={profile.water_norm || 2000} 
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Быстрые действия</h3>
          <QuickActions 
            onWaterClick={handleWaterClick}
            onExerciseClick={handleExerciseClick}
          />
        </motion.div>
      </div>
    </div>
  );
}