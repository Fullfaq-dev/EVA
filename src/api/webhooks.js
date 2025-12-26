import { supabase } from './supabaseClient';

/**
 * Обработчик обратного вызова от n8n с результатами AI анализа еды
 * n8n должен вызвать эту функцию с результатами анализа
 */
export const handleFoodAnalysisCallback = async (analysisData) => {
  try {
    const {
      entry_id,
      calories,
      protein,
      fat,
      carbs,
      analysis_text
    } = analysisData;

    if (!entry_id) {
      throw new Error('entry_id is required');
    }

    // Обновляем запись о еде с результатами анализа
    const { data: entry, error: updateError } = await supabase
      .from('food_entries')
      .update({
        calories: calories || 0,
        protein: protein || 0,
        fat: fat || 0,
        carbs: carbs || 0
      })
      .eq('id', entry_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Получаем telegram_id и дату из обновлённой записи
    const today = new Date(entry.created_date).toISOString().split('T')[0];
    
    // Пересчитываем дневную статистику
    const { data: foodEntries } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_telegram_id', entry.user_telegram_id)
      .gte('created_date', today)
      .lt('created_date', new Date(new Date(today).getTime() + 86400000).toISOString());

    if (foodEntries && foodEntries.length > 0) {
      const totalCalories = foodEntries.reduce((sum, e) => sum + (e.calories || 0), 0);
      const totalProtein = foodEntries.reduce((sum, e) => sum + (e.protein || 0), 0);
      const totalFat = foodEntries.reduce((sum, e) => sum + (e.fat || 0), 0);
      const totalCarbs = foodEntries.reduce((sum, e) => sum + (e.carbs || 0), 0);

      // Проверяем, есть ли уже запись за сегодня
      const { data: existingStats } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('user_telegram_id', entry.user_telegram_id)
        .eq('date', today)
        .single();

      if (existingStats) {
        // Обновляем существующую статистику
        await supabase
          .from('daily_stats')
          .update({
            total_calories: totalCalories,
            total_protein: totalProtein,
            total_fat: totalFat,
            total_carbs: totalCarbs
          })
          .eq('id', existingStats.id);
      } else {
        // Создаём новую статистику
        await supabase
          .from('daily_stats')
          .insert({
            user_telegram_id: entry.user_telegram_id,
            date: today,
            total_calories: totalCalories,
            total_protein: totalProtein,
            total_fat: totalFat,
            total_carbs: totalCarbs,
            water_glasses: 0,
            exercises_done: 0,
            points_earned: 0
          });
      }
    }

    console.log('Food analysis callback processed successfully:', entry_id);
    return { success: true, entry };
  } catch (error) {
    console.error('handleFoodAnalysisCallback error:', error);
    throw error;
  }
};

/**
 * Прямое обновление КБЖУ записи о еде (можно вызвать из UI или API)
 */
export const updateFoodEntryNutrition = async ({ entry_id, calories, protein, fat, carbs }) => {
  return handleFoodAnalysisCallback({ entry_id, calories, protein, fat, carbs });
};
