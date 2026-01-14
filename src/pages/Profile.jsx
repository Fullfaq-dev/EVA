import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manageProfile } from '@/api/functions';
import { calculateNutrition } from '@/utils/nutritionCalculator';
import { Reminder } from '@/api/entities';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Ruler, Weight, Calendar, Target, Activity, Edit2, Save, X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';

const goalLabels = {
  gut_health: 'Здоровье ЖКТ',
  weight_loss: 'Похудение',
  muscle_gain: 'Набор массы',
  maintenance: 'Поддержание'
};

const activityLabels = {
  sedentary: 'Низкая',
  moderate: 'Умеренная',
  active: 'Высокая'
};

const genderLabels = {
  male: 'Мужской',
  female: 'Женский'
};

export default function Profile() {
  const { telegramId, loading: authLoading, error: authError } = useTelegramAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
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

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', telegramId],
    queryFn: async () => {
      if (!telegramId) return [];
      return Reminder.filter({ user_telegram_id: telegramId });
    },
    enabled: !!telegramId
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      return manageProfile({
        action: 'update',
        data: { telegram_id: telegramId, ...data }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      setIsEditing(false);
      toast.success('Профиль обновлён');
    }
  });

  const toggleReminderMutation = useMutation({
    mutationFn: async ({ type, enabled }) => {
      const existing = reminders.find(r => r.type === type);
      if (existing) {
        return Reminder.update(existing.id, { enabled });
      } else {
        return Reminder.create({
          user_telegram_id: telegramId,
          type,
          enabled,
          interval_hours: type === 'water' ? 2 : 4
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reminders']);
      toast.success('Настройки уведомлений обновлены');
    }
  });

  const handleEdit = () => {
    setEditData({
      height: profile.height,
      weight: profile.weight,
      age: profile.age,
      gender: profile.gender,
      goal: profile.goal,
      activity_level: profile.activity_level
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    // Пересчитываем КБЖУ при изменении параметров
    const recalculatedNutrition = calculateNutrition({
      gender: editData.gender,
      height: editData.height,
      weight: editData.weight,
      age: editData.age,
      activity_level: editData.activity_level,
      goal: editData.goal
    });

    const updatedData = {
      ...editData,
      daily_calories: recalculatedNutrition.dailyCalories,
      daily_protein: recalculatedNutrition.dailyProtein,
      daily_fat: recalculatedNutrition.dailyFat,
      daily_carbs: recalculatedNutrition.dailyCarbs,
      water_norm: recalculatedNutrition.waterNorm,
      bmi: recalculatedNutrition.bmi,
      weight_status: recalculatedNutrition.weightStatus
    };

    updateProfileMutation.mutate(updatedData);
    toast.success('КБЖУ пересчитаны на основе новых параметров', { icon: '🔄' });
  };

  if (authLoading || isLoading || !profile) {
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
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Профиль</h1>
          </div>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={handleEdit}>
              <Edit2 className="w-4 h-4 mr-1" />
              Изменить
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600">
                <Save className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">Пол</span>
              </div>
              {isEditing ? (
                <Select
                  value={editData.gender || ''}
                  onValueChange={(value) => setEditData({ ...editData, gender: value })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Мужской</SelectItem>
                    <SelectItem value="female">Женский</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-medium">{genderLabels[profile.gender]}</span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Ruler className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">Рост</span>
              </div>
              {isEditing ? (
                <Input
                  type="number"
                  value={editData.height || ''}
                  onChange={(e) => setEditData({ ...editData, height: Number(e.target.value) })}
                  className="w-20 text-right"
                />
              ) : (
                <span className="font-medium">{profile.height} см</span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Weight className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">Вес</span>
              </div>
              {isEditing ? (
                <Input
                  type="number"
                  value={editData.weight || ''}
                  onChange={(e) => setEditData({ ...editData, weight: Number(e.target.value) })}
                  className="w-20 text-right"
                />
              ) : (
                <span className="font-medium">{profile.weight} кг</span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">Возраст</span>
              </div>
              {isEditing ? (
                <Input
                  type="number"
                  value={editData.age || ''}
                  onChange={(e) => setEditData({ ...editData, age: Number(e.target.value) })}
                  className="w-20 text-right"
                />
              ) : (
                <span className="font-medium">{profile.age} лет</span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">Активность</span>
              </div>
              {isEditing ? (
                <Select
                  value={editData.activity_level || ''}
                  onValueChange={(value) => setEditData({ ...editData, activity_level: value })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">Низкая</SelectItem>
                    <SelectItem value="moderate">Умеренная</SelectItem>
                    <SelectItem value="active">Высокая</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-medium">{activityLabels[profile.activity_level]}</span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">Цель</span>
              </div>
              {isEditing ? (
                <Select
                  value={editData.goal || ''}
                  onValueChange={(value) => setEditData({ ...editData, goal: value })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gut_health">Здоровье ЖКТ</SelectItem>
                    <SelectItem value="weight_loss">Похудение</SelectItem>
                    <SelectItem value="muscle_gain">Набор массы</SelectItem>
                    <SelectItem value="maintenance">Поддержание</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-medium">{goalLabels[profile.goal]}</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* КБЖУ Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <h3 className="font-semibold text-gray-900 mb-4">Ваша норма КБЖУ</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{profile.daily_calories}</p>
              <p className="text-xs text-gray-500">ккал</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{profile.daily_protein}г</p>
              <p className="text-xs text-gray-500">белки</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{profile.daily_fat}г</p>
              <p className="text-xs text-gray-500">жиры</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{profile.daily_carbs}г</p>
              <p className="text-xs text-gray-500">углеводы</p>
            </div>
          </div>
          <div className="mt-3 bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{profile.water_norm} мл</p>
            <p className="text-xs text-gray-500">норма воды</p>
          </div>
        </motion.div>

        {/* Reminders Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Напоминания</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">Вода</span>
                <span className="text-xs text-gray-500">Пить воду каждые 2 часа</span>
              </div>
              <Switch
                checked={reminders.find(r => r.type === 'water')?.enabled ?? false}
                onCheckedChange={(checked) => toggleReminderMutation.mutate({ type: 'water', enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">Еда</span>
                <span className="text-xs text-gray-500">Напоминание сфотографировать еду</span>
              </div>
              <Switch
                checked={reminders.find(r => r.type === 'food_photo')?.enabled ?? false}
                onCheckedChange={(checked) => toggleReminderMutation.mutate({ type: 'food_photo', enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">Зарядка</span>
                <span className="text-xs text-gray-500">Разминка в течение дня</span>
              </div>
              <Switch
                checked={reminders.find(r => r.type === 'exercise')?.enabled ?? false}
                onCheckedChange={(checked) => toggleReminderMutation.mutate({ type: 'exercise', enabled: checked })}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}