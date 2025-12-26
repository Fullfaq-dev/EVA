import { supabase } from './supabaseClient';

// Verify Telegram Auth (handled client-side via Telegram WebApp)
export const verifyTelegramAuth = async (authData) => {
  // In Telegram WebApp, authentication is handled by Telegram itself
  // No server-side verification needed for basic use case
  return { success: true, data: authData };
};

// Manage Profile (get, create, update)
export const manageProfile = async ({ action, data }) => {
  try {
    switch (action) {
      case 'get': {
        const { data: profiles, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('telegram_id', data.telegram_id)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
        return { data: { profile: profiles } };
      }
      
      case 'create': {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return { data: { profile } };
      }
      
      case 'update': {
        const { telegram_id, ...updateData } = data;
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('telegram_id', telegram_id)
          .select()
          .single();
        
        if (error) throw error;
        return { data: { profile } };
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('manageProfile error:', error);
    throw error;
  }
};

// Create Food Entry
export const createFoodEntry = async ({ telegram_id, description, meal_type, photo_url }) => {
  try {
    const { data: entry, error } = await supabase
      .from('food_entries')
      .insert({
        user_telegram_id: telegram_id,
        description,
        meal_type,
        photo_url,
        calories: 0, // Will be updated by analysis
        protein: 0,
        fat: 0,
        carbs: 0
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Отправляем вебхуки на n8n для AI анализа
    if (photo_url) {
      await sendFoodAnalysisWebhooks({
        entry_id: entry.id,
        telegram_id,
        description,
        meal_type,
        photo_url,
        created_date: entry.created_date
      });
    }
    
    return { data: { entry } };
  } catch (error) {
    console.error('createFoodEntry error:', error);
    throw error;
  }
};

// Send webhooks to n8n for AI food analysis
const sendFoodAnalysisWebhooks = async (data) => {
  const webhookUrl = import.meta.env.VITE_N8N_FOOD_WEBHOOK_URL;
  const webhookTestUrl = import.meta.env.VITE_N8N_FOOD_WEBHOOK_TEST_URL;
  
  const payload = {
    entry_id: data.entry_id,
    telegram_id: data.telegram_id,
    description: data.description,
    meal_type: data.meal_type,
    photo_url: data.photo_url,
    created_date: data.created_date,
    timestamp: new Date().toISOString()
  };
  
  // Отправляем на основной webhook
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      console.log('Food analysis webhook sent to production:', webhookUrl);
    } catch (error) {
      console.error('Error sending production webhook:', error);
    }
  }
  
  // Отправляем на тестовый webhook
  if (webhookTestUrl) {
    try {
      await fetch(webhookTestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      console.log('Food analysis webhook sent to test:', webhookTestUrl);
    } catch (error) {
      console.error('Error sending test webhook:', error);
    }
  }
};

// Update Food Entry
export const updateFoodEntry = async ({ entry_id, calories, protein, fat, carbs }) => {
  try {
    const { data: entry, error } = await supabase
      .from('food_entries')
      .update({
        calories,
        protein,
        fat,
        carbs
      })
      .eq('id', entry_id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const { data: foodEntries } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_telegram_id', entry.user_telegram_id)
      .gte('created_date', today)
      .lt('created_date', new Date(new Date(today).getTime() + 86400000).toISOString());
    
    if (foodEntries) {
      const totalCalories = foodEntries.reduce((sum, e) => sum + (e.calories || 0), 0);
      const totalProtein = foodEntries.reduce((sum, e) => sum + (e.protein || 0), 0);
      const totalFat = foodEntries.reduce((sum, e) => sum + (e.fat || 0), 0);
      const totalCarbs = foodEntries.reduce((sum, e) => sum + (e.carbs || 0), 0);
      
      const { data: existingStats } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('user_telegram_id', entry.user_telegram_id)
        .eq('date', today)
        .single();
      
      if (existingStats) {
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
        await supabase
          .from('daily_stats')
          .insert({
            user_telegram_id: entry.user_telegram_id,
            date: today,
            total_calories: totalCalories,
            total_protein: totalProtein,
            total_fat: totalFat,
            total_carbs: totalCarbs
          });
      }
    }
    
    return { data: { entry } };
  } catch (error) {
    console.error('updateFoodEntry error:', error);
    throw error;
  }
};

// Get Food Entries
export const getFoodEntries = async ({ telegram_id }) => {
  try {
    const { data: entries, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_telegram_id', telegram_id)
      .order('created_date', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    return { data: { entries: entries || [] } };
  } catch (error) {
    console.error('getFoodEntries error:', error);
    throw error;
  }
};
