import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manageProfile } from '@/api/functions';
import { calculateNutrition } from '@/utils/nutritionCalculator';
import { Reminder } from '@/api/entities';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Ruler, Weight, Calendar, Target, Activity, Edit2, Save, X, Bell, Ban, MessageSquare, Crown, Check, CreditCard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import LegalModal from "@/components/LegalModal";
import { LEGAL_DOCUMENTS } from "@/utils/legalTexts";

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
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [currentLegalDoc, setCurrentLegalDoc] = useState(null);
  const queryClient = useQueryClient();

  const openLegalDoc = async (docKey) => {
    const doc = LEGAL_DOCUMENTS[docKey];
    if (!doc) return;
    
    try {
      const response = await fetch(doc.path);
      const text = await response.text();
      setCurrentLegalDoc({ ...doc, content: text });
      setLegalModalOpen(true);
    } catch (error) {
      console.error('Error loading document:', error);
      toast.error('Не удалось загрузить документ');
    }
  };

  const handlePayment = (plan) => {
    console.log('Processing payment for plan:', plan);
    toast.success(`Оплата тарифа "${plan.name}"... (тестовый режим)`);
    // Here we would integrate with a payment provider
    setIsSubscriptionModalOpen(false);
  };

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
      activity_level: profile.activity_level,
      problems: profile.problems,
      allergies: profile.allergies
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
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
              <div className="flex flex-col gap-1 mt-1">
                {profile.is_subscription_active ? (
                  <>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 w-fit">
                      <Crown className="w-3 h-3 mr-1" />
                      Premium активен
                    </span>
                    {profile.subscription_end_date && (
                      <span className="text-xs text-gray-500">
                        до {new Date(profile.subscription_end_date).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 w-fit">
                    Базовый план
                  </span>
                )}
              </div>
            </div>
          </div>

          {!profile.is_subscription_active && (
            <div className="mb-6 p-4 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl text-white shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">FitBot Premium</h3>
                  <p className="text-violet-100 text-sm">Откройте все возможности</p>
                </div>
                <Crown className="w-6 h-6 text-yellow-300" />
              </div>
              <ul className="space-y-2 mb-4 text-sm text-violet-50">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-300" />
                  Персональный план питания
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-300" />
                  Расширенная аналитика
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-300" />
                  Безлимитный AI-ассистент
                </li>
              </ul>
              <Dialog open={isSubscriptionModalOpen} onOpenChange={setIsSubscriptionModalOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-white text-violet-600 hover:bg-violet-50 font-semibold">
                    Оформить подписку
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center mb-2">Выберите тариф</DialogTitle>
                    <DialogDescription className="text-center mb-6">
                      Инвестируйте в свое здоровье с выгодой
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* 1 Month */}
                    <div className="relative rounded-xl border-2 border-gray-100 p-4 hover:border-violet-500 transition-colors cursor-pointer"
                         onClick={() => handlePayment({ name: '1 Месяц', price: 499 })}>
                      <div className="text-center">
                        <h4 className="font-semibold text-gray-900">1 Месяц</h4>
                        <div className="mt-2 mb-4">
                          <span className="text-3xl font-bold text-gray-900">499₽</span>
                        </div>
                        <Button className="w-full" variant="outline">Выбрать</Button>
                      </div>
                    </div>

                    {/* 3 Months */}
                    <div className="relative rounded-xl border-2 border-violet-500 bg-violet-50/50 p-4 cursor-pointer transform scale-105 shadow-lg"
                         onClick={() => handlePayment({ name: '3 Месяца', price: 799 })}>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-500 text-white px-3 py-0.5 rounded-full text-xs font-bold">
                        Популярный
                      </div>
                      <div className="text-center">
                        <h4 className="font-semibold text-gray-900">3 Месяца</h4>
                        <div className="mt-2 mb-4">
                          <span className="text-3xl font-bold text-gray-900">799₽</span>
                          <div className="text-xs text-gray-500 line-through">1497₽</div>
                        </div>
                        <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">Выбрать</Button>
                      </div>
                    </div>

                    {/* 1 Year */}
                    <div className="relative rounded-xl border-2 border-gray-100 p-4 hover:border-violet-500 transition-colors cursor-pointer"
                         onClick={() => handlePayment({ name: '1 Год', price: 2100 })}>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white px-3 py-0.5 rounded-full text-xs font-bold">
                        -65%
                      </div>
                      <div className="text-center">
                        <h4 className="font-semibold text-gray-900">1 Год</h4>
                        <div className="mt-2 mb-4">
                          <span className="text-3xl font-bold text-gray-900">2100₽</span>
                          <div className="text-xs text-gray-500 line-through">5988₽</div>
                        </div>
                        <Button className="w-full" variant="outline">Выбрать</Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-center text-xs text-gray-500">
                    <p>Нажимая кнопку, вы соглашаетесь с условиями использования и политикой конфиденциальности.</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <CreditCard className="w-4 h-4" />
                      <span>Безопасная оплата картой</span>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

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

        {/* Health Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <h3 className="font-semibold text-gray-900 mb-4">Здоровье и ограничения</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <Ban className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Аллергии и ограничения</span>
              </div>
              {isEditing ? (
                <Textarea
                  value={editData.allergies || ''}
                  onChange={(e) => setEditData({ ...editData, allergies: e.target.value })}
                  placeholder="Нет ограничений"
                  className="min-h-[80px] text-sm"
                />
              ) : (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
                  {profile.allergies || 'Не указано'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <MessageSquare className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium">Жалобы и проблемы</span>
              </div>
              {isEditing ? (
                <Textarea
                  value={editData.problems || ''}
                  onChange={(e) => setEditData({ ...editData, problems: e.target.value })}
                  placeholder="Нет жалоб"
                  className="min-h-[80px] text-sm"
                />
              ) : (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
                  {profile.problems || 'Не указано'}
                </p>
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

        {/* Legal Documents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Правовая информация</h3>
          </div>
          
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-emerald-600 hover:bg-emerald-50"
              onClick={() => openLegalDoc('userAgreement')}
            >
              Пользовательское соглашение
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-emerald-600 hover:bg-emerald-50"
              onClick={() => openLegalDoc('privacyPolicy')}
            >
              Политика конфиденциальности
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-emerald-600 hover:bg-emerald-50"
              onClick={() => openLegalDoc('dataProcessing')}
            >
              Согласие на обработку данных
            </Button>
          </div>
        </motion.div>
      </div>

      {currentLegalDoc && (
        <LegalModal
          isOpen={legalModalOpen}
          onClose={setLegalModalOpen}
          title={currentLegalDoc.title}
          content={currentLegalDoc.content}
        />
      )}
    </div>
  );
}