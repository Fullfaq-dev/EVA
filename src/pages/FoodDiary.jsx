import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFoodEntries, createFoodEntry, deleteFoodEntry } from '@/api/functions';
import { UploadFile } from '@/api/integrations';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Send, Image, ArrowLeft, Plus, Utensils, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTelegramAuth } from '@/components/auth/useTelegramAuth';

const mealTypes = [
  { id: 'breakfast', label: 'Завтрак', emoji: '🌅' },
  { id: 'lunch', label: 'Обед', emoji: '☀️' },
  { id: 'dinner', label: 'Ужин', emoji: '🌙' },
  { id: 'snack', label: 'Перекус', emoji: '🍎' }
];

export default function FoodDiary() {
  const { telegramId, loading: authLoading, error: authError } = useTelegramAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

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

  const todayEntries = entries.filter(e => 
    format(new Date(e.created_date), 'yyyy-MM-dd') === today
  );

  const createEntryMutation = useMutation({
    mutationFn: async (data) => {
      let photoUrl = null;
      
      if (photoFile) {
        const result = await UploadFile({ file: photoFile });
        photoUrl = result.file_url;
      }
      
      // Создаем запись через backend function
      const { data: result } = await createFoodEntry({
        telegram_id: telegramId,
        description: data.description,
        meal_type: data.mealType,
        photo_url: photoUrl
      });

      return result.entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['foodEntries']);
      setShowAddModal(false);
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setSelectedMealType('');
      toast.success('Запись добавлена! Анализируем...', { icon: '🍽️' });
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
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!description && !photoFile) {
      toast.error('Добавьте описание или фото');
      return;
    }
    if (!selectedMealType) {
      toast.error('Выберите тип приёма пищи');
      return;
    }
    
    // Проверка на повторное добавление завтрака/обеда/ужина
    if (['breakfast', 'lunch', 'dinner'].includes(selectedMealType)) {
      const alreadyExists = todayEntries.some(e => e.meal_type === selectedMealType);
      if (alreadyExists) {
        const mealName = mealTypes.find(m => m.id === selectedMealType)?.label.toLowerCase();
        toast.error(`Вы уже добавили ${mealName} сегодня`);
        return;
      }
    }
    
    setIsUploading(true);
    try {
      await createEntryMutation.mutateAsync({
        description,
        mealType: selectedMealType
      });
    } finally {
      setIsUploading(false);
    }
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
            <h1 className="text-xl font-bold text-gray-900">Пищевой дневник</h1>
            <p className="text-sm text-gray-500">
              {format(new Date(), "d MMMM", { locale: ru })}
            </p>
          </div>
        </div>

        {/* Today's meals */}
        <div className="space-y-3 mb-6">
          {mealTypes.map((meal) => {
            const mealEntries = todayEntries.filter(e => e.meal_type === meal.id);
            
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
                        </div>
                        {entry.calories > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {entry.calories} ккал
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => handleDeleteEntry(entry, meal.label)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg"
                          title="Удалить запись"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
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
              onClick={() => setShowAddModal(false)}
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
                  Добавить {mealTypes.find(m => m.id === selectedMealType)?.label.toLowerCase()}
                </h2>

                {/* Photo upload */}
                <div className="mb-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoChange}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {photoPreview ? (
                    <div className="relative">
                      <img 
                        src={photoPreview} 
                        alt="" 
                        className="w-full h-48 object-cover rounded-2xl"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="absolute top-2 right-2"
                      >
                        Удалить
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-32 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                      <Camera className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-500">Добавить фото еды</span>
                    </button>
                  )}
                </div>

                {/* Description */}
                <Textarea
                  placeholder="Опишите, что вы съели..."
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
                  disabled={isUploading || (!description && !photoFile)}
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
    </div>
  );
}