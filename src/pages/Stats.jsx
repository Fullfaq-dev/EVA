import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserProfile, DailyStats, Achievement } from '@/api/entities';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Calendar, Flame, Award, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';
import Leaderboard from '@/components/dashboard/Leaderboard';

export default function Stats() {
  const { telegramId, loading: authLoading, error: authError } = useTelegramAuth();
  const [period, setPeriod] = useState('week');

  const { data: profile } = useQuery({
    queryKey: ['profile', telegramId],
    queryFn: async () => {
      if (!telegramId) return null;
      const profiles = await UserProfile.filter({ telegram_id: telegramId });
      return profiles[0] || null;
    },
    enabled: !!telegramId
  });

  const { data: stats = [] } = useQuery({
    queryKey: ['allStats', telegramId],
    queryFn: async () => {
      if (!telegramId) return [];
      return DailyStats.filter({
        user_telegram_id: telegramId
      }, '-date', 30);
    },
    enabled: !!telegramId
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', telegramId],
    queryFn: async () => {
      if (!telegramId) return [];
      return Achievement.filter({ user_telegram_id: telegramId });
    },
    enabled: !!telegramId
  });

  // Подготовка данных для графика
  const chartData = stats.slice(0, 7).reverse().map(s => ({
    date: format(new Date(s.date), 'd MMM', { locale: ru }),
    calories: s.total_calories || 0,
    target: profile?.daily_calories || 2000
  }));

  // Расчёт средних показателей
  const weekStats = stats.slice(0, 7);
  const avgCalories = weekStats.length > 0 
    ? Math.round(weekStats.reduce((sum, s) => sum + (s.total_calories || 0), 0) / weekStats.length)
    : 0;
  const totalPoints = weekStats.reduce((sum, s) => sum + (s.points_earned || 0), 0);
  const totalWater = weekStats.reduce((sum, s) => sum + (s.water_glasses || 0), 0);
  const totalExercises = weekStats.reduce((sum, s) => sum + (s.exercises_done || 0), 0);

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
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link 
            to={createPageUrl('Dashboard')}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Статистика</h1>
            <p className="text-sm text-gray-500">За последнюю неделю</p>
          </div>
        </div>

        {/* Week Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-2">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{avgCalories}</p>
            <p className="text-sm text-gray-500">ккал/день (ср.)</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-2">
              <Award className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalPoints}</p>
            <p className="text-sm text-gray-500">баллов за неделю</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
              <span className="text-xl">💧</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalWater}</p>
            <p className="text-sm text-gray-500">стаканов воды</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-2">
              <span className="text-xl">💪</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalExercises}</p>
            <p className="text-sm text-gray-500">разминок</p>
          </div>
        </motion.div>

        {/* Calories Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6"
        >
          <h3 className="font-semibold text-gray-900 mb-4">Калории за неделю</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="calories" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fill="url(#colorCalories)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              Нет данных за эту неделю
            </div>
          )}
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <h3 className="font-semibold text-gray-900 mb-4">Достижения</h3>
          {achievements.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {achievements.map((achievement) => (
                <div 
                  key={achievement.id}
                  className="bg-amber-50 rounded-xl p-3 text-center"
                >
                  <span className="text-2xl">🏆</span>
                  <p className="text-xs font-medium text-amber-700 mt-1">
                    {achievement.title}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl">🎯</span>
              <p className="text-gray-500 mt-2">Пока нет достижений</p>
              <p className="text-sm text-gray-400">Продолжайте вести дневник!</p>
            </div>
          )}
        </motion.div>

        {/* Leaderboard */}
        <div className="mt-6">
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}