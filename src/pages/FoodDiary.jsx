import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFoodEntries, createFoodEntry, deleteFoodEntry, updateFoodEntry } from '@/api/functions';
import { UploadFile } from '@/api/integrations';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Send, Image, ArrowLeft, Plus, Utensils, Trash2, ChevronLeft, ChevronRight, Calendar, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, subDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

const mealTypes = [
  { id: 'breakfast', label: 'Завтрак', emoji: '🌅' },
  { id: 'lunch', label: 'Обед', emoji: '☀️' },
  { id: 'dinner', label: 'Ужин', emoji: '🌙' },
  { id: 'snack', label: 'Перекус/Напиток', emoji: '🍎' }
];

export default function FoodDiary() {
  const { telegramId, loading: authLoading, error: authError } = useTelegramAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('');
  const [description, setDescription] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showWeekView, setShowWeekView] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDate = format(selectedDate, 'yyyy-MM-dd');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['foodEntries', telegramId, today],
    queryFn: async () => {
      if (!telegramId) return [];
      const { data } = await getFoodEntries({
        telegram_id: telegramId
      });
      return data.entries || [];
    },
    enabled: !!telegramId
  });

  const currentEntries = entries.filter(e =>
    format(new Date(e.created_date), 'yyyy-MM-dd') === currentDate
  );

  // Calculate week dates
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Filter entries for the current week
  const weekEntries = entries.filter(e => {
    const entryDate = new Date(e.created_date);
    return entryDate >= weekStart && entryDate <= weekEnd;
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data) => {
      let photoUrls = [];
      
      if (photoFiles.length > 0) {
        for (const file of photoFiles) {
          const result = await UploadFile({ file });
          photoUrls.push(result.file_url);
        }
      }
      
      // Создаем запись через backend function
      const { data: result } = await createFoodEntry({
        telegram_id: telegramId,
        description: data.description,
        meal_type: data.mealType,
        photo_url: photoUrls[0] || null, // Основное фото для совместимости
        photo_urls: photoUrls // Все фото для мультизагрузки
      });

      return result.entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['foodEntries']);
      setIsUploading(false);
      setIsSuccess(true);
    }
  });

  const updateEntryMutation = useMutation({
    mutationFn: async (data) => {
      let photoUrls = data.existingPhotoUrls || [];
      
      if (data.newPhotoFiles && data.newPhotoFiles.length > 0) {
        for (const file of data.newPhotoFiles) {
          const result = await UploadFile({ file });
          photoUrls.push(result.file_url);
        }
      }
      
      const { data: result } = await updateFoodEntry({
        entry_id: data.entryId,
        description: data.description,
        photo_url: photoUrls[0] || null,
        photo_urls: photoUrls,
        is_edit_action: true
      });

      return result.entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['foodEntries']);
      setIsUploading(false);
      setIsSuccess(true);
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId) => {
      return await deleteFoodEntry({ entry_id: entryId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['foodEntries']);
      toast.success('Запись удалена', { icon: '🗑️' });
    },
    onError: (error) => {
      toast.error('Ошибка при удалении записи');
      console.error('Delete error:', error);
    }
  });

  const handleDeleteEntry = async (entry, mealName) => {
    if (confirm(`Удалить запись "${mealName}"?`)) {
      await deleteEntryMutation.mutateAsync(entry.id);
    }
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newFiles = [...photoFiles, ...files].slice(0, 4);
      setPhotoFiles(newFiles);
      
      const newPreviews = [];
      let loadedCount = 0;
      
      newFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews[index] = reader.result;
          loadedCount++;
          if (loadedCount === newFiles.length) {
            setPhotoPreviews(newPreviews);
          }
        };
        reader.readAsDataURL(file);
      });

      if (photoFiles.length + files.length > 4) {
        toast.warning('Максимум 4 фото');
      }
    }
  };

  const handleSubmit = async () => {
    if (!description && photoFiles.length === 0 && (!editingEntry || !editingEntry.photo_url)) {
      toast.error('Добавьте описание или фото');
      return;
    }

    setIsUploading(true);
    try {
      if (editingEntry) {
        await updateEntryMutation.mutateAsync({
          entryId: editingEntry.id,
          description,
          newPhotoFiles: photoFiles,
          existingPhotoUrls: editingEntry.photo_url ? [editingEntry.photo_url] : [] // В идеале тут должны быть все старые URL
        });
      } else {
        if (!selectedMealType) {
          toast.error('Выберите тип приёма пищи');
          setIsUploading(false);
          return;
        }
        
        // Проверка на повторное добавление завтрака/обеда/ужина для текущей даты
        if (['breakfast', 'lunch', 'dinner'].includes(selectedMealType)) {
          const alreadyExists = currentEntries.some(e => e.meal_type === selectedMealType);
          if (alreadyExists) {
            const mealName = mealTypes.find(m => m.id === selectedMealType)?.label.toLowerCase();
            toast.error(`Вы уже добавили ${mealName} в этот день`);
            setIsUploading(false);
            return;
          }
        }

        await createEntryMutation.mutateAsync({
          description,
          mealType: selectedMealType
        });
      }
    } catch (error) {
      setIsUploading(false);
      console.error(error);
      toast.error('Ошибка при сохранении');
    }
  };

  const handleUploadComplete = () => {
    setIsSuccess(false);
    setShowAddModal(false);
    setEditingEntry(null);
    setDescription('');
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setSelectedMealType('');
    toast.success(editingEntry ? 'Запись обновлена!' : 'Запись добавлена! Анализируем...', {
      icon: editingEntry ? '📝' : '🍽️'
    });
  };

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
        
        <LoadingOverlay
          isLoading={isUploading}
          isSuccess={isSuccess}
          onComplete={handleUploadComplete}
          message="Сохраняем запись..."
          successTitle="Запись добавлена!"
          successMessage={`Данные КБЖУ скоро появятся на этом экране.\nВернитесь на эту страницу позже.`}
        />
      </div>
    );
  }

  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    const nextDay = addDays(selectedDate, 1);
    if (nextDay <= new Date()) {
      setSelectedDate(nextDay);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

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
            <h1 className="text-xl font-bold text-gray-900">Пищевой дневник</h1>
            <p className="text-sm text-gray-500">
              {format(selectedDate, "d MMMM", { locale: ru })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowWeekView(!showWeekView)}
            className="text-emerald-600 hover:text-emerald-700"
          >
            <Calendar className="w-5 h-5" />
          </Button>
        </div>

        {/* Date Navigation */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousDay}
              className="text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <div className="text-center">
              <p className="font-semibold text-gray-900">
                {isSameDay(selectedDate, new Date())
                  ? 'Сегодня'
                  : format(selectedDate, "d MMMM yyyy", { locale: ru })}
              </p>
              <p className="text-xs text-gray-500">
                {format(selectedDate, "EEEE", { locale: ru })}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextDay}
              disabled={isSameDay(selectedDate, new Date())}
              className="text-gray-600 hover:text-gray-900 disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {!isSameDay(selectedDate, new Date()) && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="w-full mt-3 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              Вернуться к сегодня
            </Button>
          )}
        </div>

        {/* Week View */}
        <AnimatePresence>
          {showWeekView && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 overflow-hidden"
            >
              <h3 className="font-semibold text-gray-900 mb-3">
                Неделя: {format(weekStart, "d MMM", { locale: ru })} - {format(weekEnd, "d MMM", { locale: ru })}
              </h3>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayEntries = weekEntries.filter(e =>
                    isSameDay(new Date(e.created_date), day)
                  );
                  const dayCalories = dayEntries.reduce((sum, e) => sum + (e.calories || 0), 0);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  const isFuture = day > new Date();

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => !isFuture && setSelectedDate(day)}
                      disabled={isFuture}
                      className={`p-2 rounded-lg text-center transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-white'
                          : isToday
                          ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300'
                          : isFuture
                          ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                          : dayCalories > 0
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className="text-xs font-medium">
                        {format(day, "EEE", { locale: ru })}
                      </div>
                      <div className="text-lg font-bold">
                        {format(day, "d")}
                      </div>
                      {dayCalories > 0 && (
                        <div className="text-[10px] mt-1">
                          {dayCalories}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Week Summary */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">Итого за неделю:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <span className="text-gray-600">Калории:</span>
                    <span className="ml-1 font-semibold text-emerald-700">
                      {weekEntries.reduce((sum, e) => sum + (e.calories || 0), 0)} ккал
                    </span>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <span className="text-gray-600">Белки:</span>
                    <span className="ml-1 font-semibold text-blue-700">
                      {weekEntries.reduce((sum, e) => sum + (parseFloat(e.protein) || 0), 0).toFixed(1)} г
                    </span>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-2">
                    <span className="text-gray-600">Жиры:</span>
                    <span className="ml-1 font-semibold text-yellow-700">
                      {weekEntries.reduce((sum, e) => sum + (parseFloat(e.fat) || 0), 0).toFixed(1)} г
                    </span>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2">
                    <span className="text-gray-600">Углеводы:</span>
                    <span className="ml-1 font-semibold text-orange-700">
                      {weekEntries.reduce((sum, e) => sum + (parseFloat(e.carbs) || 0), 0).toFixed(1)} г
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current day meals */}
        <div className="space-y-3 mb-6">
          {mealTypes.map((meal) => {
            const mealEntries = currentEntries.filter(e => e.meal_type === meal.id);
            
            return (
              <motion.div
                key={meal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meal.emoji}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{meal.label}</p>
                      <p className="text-xs text-gray-500">
                        {mealEntries.length > 0 
                          ? `${mealEntries.length} записей` 
                          : 'Нет записей'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedMealType(meal.id);
                      setShowAddModal(true);
                    }}
                    disabled={['breakfast', 'lunch', 'dinner'].includes(meal.id) && mealEntries.length > 0}
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {mealEntries.length > 0 && ['breakfast', 'lunch', 'dinner'].includes(meal.id) ? 'Добавлено' : 'Добавить'}
                  </Button>
                </div>

                {mealEntries.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {mealEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 group"
                      >
                        {entry.photo_url ? (
                          <img
                            src={entry.photo_url}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Utensils className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">
                            {entry.description || 'Без описания'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {format(new Date(entry.created_date), 'HH:mm')}
                          </p>
                          
                          {/* Macronutrients & Calories */}
                          {(entry.protein > 0 || entry.fat > 0 || entry.carbs > 0 || entry.calories > 0) && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {entry.calories > 0 && (
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                                  {entry.calories} ккал
                                </span>
                              )}
                              {entry.protein > 0 && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">
                                  Б: {parseFloat(entry.protein).toFixed(1)}г
                                </span>
                              )}
                              {entry.fat > 0 && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-md">
                                  Ж: {parseFloat(entry.fat).toFixed(1)}г
                                </span>
                              )}
                              {entry.carbs > 0 && (
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md">
                                  У: {parseFloat(entry.carbs).toFixed(1)}г
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingEntry(entry);
                              setSelectedMealType(entry.meal_type);
                              setDescription(entry.description || '');
                              setShowAddModal(true);
                            }}
                            className="p-2 hover:bg-blue-50 rounded-lg"
                            title="Редактировать"
                          >
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entry, meal.label)}
                            className="p-2 hover:bg-red-50 rounded-lg"
                            title="Удалить запись"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Add Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-end"
              onClick={() => {
                setShowAddModal(false);
                setEditingEntry(null);
                setDescription('');
                setPhotoFiles([]);
                setPhotoPreviews([]);
              }}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-white rounded-t-3xl p-6 pb-24 max-h-[80vh] overflow-y-auto"
              >
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
                
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingEntry ? 'Редактировать' : 'Добавить'} {mealTypes.find(m => m.id === selectedMealType)?.label.toLowerCase()}
                </h2>

                {/* Photo upload */}
                <div className="mb-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoChange}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  
                  {photoPreviews.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {photoPreviews.map((preview, index) => (
                        <div key={index} className="relative aspect-square">
                          <img
                            src={preview}
                            alt=""
                            className="w-full h-full object-cover rounded-xl"
                          />
                          <button
                            onClick={() => {
                              const newFiles = photoFiles.filter((_, i) => i !== index);
                              const newPreviews = photoPreviews.filter((_, i) => i !== index);
                              setPhotoFiles(newFiles);
                              setPhotoPreviews(newPreviews);
                            }}
                            className="absolute top-1 right-1 bg-black/50 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {photoPreviews.length < 4 && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition-colors"
                        >
                          <Plus className="w-6 h-6 text-gray-400" />
                          <span className="text-[10px] text-gray-500">Еще фото</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 h-24 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                      >
                        <Camera className="w-6 h-6 text-gray-400" />
                        <span className="text-xs text-gray-500">Добавить фото</span>
                      </button>
                      <button
                        onClick={() => {
                          // Просто фокусируемся на текстовом поле
                          document.querySelector('textarea')?.focus();
                        }}
                        className="flex-1 h-24 bg-gray-50 rounded-2xl border-2 border-gray-200 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                      >
                        <Utensils className="w-6 h-6 text-gray-400" />
                        <span className="text-xs text-gray-500">Без фото</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Description */}
                <Textarea
                  placeholder={`Напишите, что вы съели… \nРасчеты будут более точными если добавить граммы`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mb-4 min-h-24 resize-none"
                />

                {/* Meal type selector */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {mealTypes.map((meal) => (
                    <button
                      key={meal.id}
                      onClick={() => setSelectedMealType(meal.id)}
                      className={`p-3 rounded-xl text-center transition-all ${
                        selectedMealType === meal.id
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="text-xl block mb-1">{meal.emoji}</span>
                      <span className="text-xs">{meal.label}</span>
                    </button>
                  ))}
                </div>

                {/* Submit button */}
                <Button
                  onClick={handleSubmit}
                  disabled={isUploading || (!description && photoFiles.length === 0)}
                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                >
                  {isUploading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Загрузка...
                    </span>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Добавить запись
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-gray-400 mt-3">
                  💡 Анализ КБЖУ будет выполнен ботом
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <LoadingOverlay
        isLoading={isUploading}
        isSuccess={isSuccess}
        onComplete={handleUploadComplete}
        message="Сохраняем запись..."
        successTitle="Запись добавлена!"
        successMessage={`Данные КБЖУ скоро появятся на этом экране.\nВернитесь на эту страницу позже.`}
      />
    </div>
  );
}