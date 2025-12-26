import { supabase } from './supabaseClient';

// Helper function to create entity operations
const createEntityHelper = (tableName) => ({
  async filter(conditions = {}, orderBy = null, limit = null) {
    let query = supabase.from(tableName).select('*');
    
    // Apply filters
    Object.entries(conditions).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    // Apply ordering
    if (orderBy) {
      const isDescending = orderBy.startsWith('-');
      const column = isDescending ? orderBy.substring(1) : orderBy;
      query = query.order(column, { ascending: !isDescending });
    }
    
    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  
  async create(data) {
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  
  async update(id, data) {
    const { data: result, error } = await supabase
      .from(tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  
  async delete(id) {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },
  
  async get(id) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
});

// Export entities
export const UserProfile = createEntityHelper('user_profiles');
export const FoodEntry = createEntityHelper('food_entries');
export const AnalysisUpload = createEntityHelper('analysis_uploads');
export const Reminder = createEntityHelper('reminders');
export const DailyStats = createEntityHelper('daily_stats');
export const Achievement = createEntityHelper('achievements');

// Auth placeholder (Telegram auth is handled differently)
export const User = {
  // This is handled via Telegram WebApp, not traditional auth
};
