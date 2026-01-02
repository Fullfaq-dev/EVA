/**
 * Расчет питания по формуле Миффлина-Сан Жеора с учётом BMI и весовой категории
 * @param {object} params - Параметры пользователя
 * @param {string} params.gender - 'male' или 'female'
 * @param {number} params.height - Рост в см
 * @param {number} params.weight - Вес в кг
 * @param {number} params.age - Возраст в годах
 * @param {string} params.activity_level - 'sedentary', 'moderate', 'active'
 * @param {string} params.goal - 'gut_health', 'weight_loss', 'muscle_gain', 'maintenance'
 * @returns {object} Рассчитанные значения калорий, БЖУ и воды
 */
export function calculateNutrition({ gender, height, weight, age, activity_level, goal }) {
  // 0️⃣ Определяем BMI
  const height_m = height / 100;
  const bmi = weight / (height_m * height_m);
  
  // 1️⃣ Весовая категория
  let weightStatus;
  if (bmi < 18.5) {
    weightStatus = 'underweight';
  } else if (bmi < 25) {
    weightStatus = 'normal';
  } else if (bmi < 30) {
    weightStatus = 'overweight';
  } else {
    weightStatus = 'obese';
  }
  
  // 2️⃣ Коррекция калорий (к TDEE)
  let calorieModifier;
  if (weightStatus === 'underweight') {
    calorieModifier = 1.10;
  } else if (weightStatus === 'overweight') {
    calorieModifier = 0.95;
  } else if (weightStatus === 'obese') {
    calorieModifier = 0.90;
  } else {
    calorieModifier = 1.00;
  }
  
  // 3️⃣ BMR (Миффлин–Сан Жеор)
  let bmr;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  
  // 4️⃣ Activity → TDEE → Calories
  const activityMultipliers = {
    sedentary: 1.2,    // Малоподвижный образ жизни
    moderate: 1.375,   // Умеренная активность (3-5 раз в неделю)
    active: 1.55       // Высокая активность (6-7 раз в неделю)
  };
  
  const tdee = bmr * activityMultipliers[activity_level];
  
  // Базовые калории в зависимости от цели
  let baseCalories;
  const normalizedGoal = goal === 'weight_loss' ? 'loss' :
                         goal === 'muscle_gain' ? 'gain' :
                         goal === 'maintenance' ? 'maintenance' :
                         'gut_health';
  
  if (normalizedGoal === 'loss') {
    baseCalories = tdee * 0.85;
  } else if (normalizedGoal === 'gain') {
    baseCalories = tdee * 1.10;
  } else if (normalizedGoal === 'maintenance') {
    baseCalories = tdee * 1.00;
  } else if (normalizedGoal === 'gut_health') {
    baseCalories = tdee * 1.00;
  } else {
    baseCalories = tdee;
  }
  
  const dailyCalories = baseCalories * calorieModifier;
  
  // 5️⃣ Белок (автокоррекция по весу)
  let proteinFactor;
  if (normalizedGoal === 'loss') {
    proteinFactor = 1.8;
  } else if (normalizedGoal === 'gain') {
    proteinFactor = 2.0;
  } else if (normalizedGoal === 'maintenance') {
    proteinFactor = 1.6;
  } else if (normalizedGoal === 'gut_health') {
    proteinFactor = 1.4;
  } else {
    proteinFactor = 1.6;
  }
  
  // Коррекция при ожирении и недоборе
  if (weightStatus === 'obese') {
    proteinFactor = Math.min(proteinFactor, 1.6);
  } else if (weightStatus === 'underweight') {
    proteinFactor = Math.max(proteinFactor, 1.8);
  }
  
  const protein_g = weight * proteinFactor;
  const protein_kcal = protein_g * 4;
  
  // 6️⃣ Жиры (защита гормонов)
  let fatFactor;
  if (normalizedGoal === 'loss') {
    fatFactor = 0.8;
  } else if (normalizedGoal === 'gain') {
    fatFactor = 0.9;
  } else if (normalizedGoal === 'maintenance') {
    fatFactor = 0.9;
  } else if (normalizedGoal === 'gut_health') {
    fatFactor = 1.0;
  } else {
    fatFactor = 0.9;
  }
  
  // Коррекция по весу
  if (weightStatus === 'obese') {
    fatFactor = Math.max(0.7, fatFactor - 0.1);
  }
  
  let fat_g = weight * fatFactor;
  let fat_kcal = fat_g * 9;
  
  // 7️⃣ Углеводы (остатком)
  let carbs_kcal = dailyCalories - (protein_kcal + fat_kcal);
  let carbs_g = carbs_kcal / 4;
  
  // 8️⃣ Safety-блок
  if (carbs_g < 0) {
    fat_g = weight * 0.7;
    fat_kcal = fat_g * 9;
    carbs_kcal = dailyCalories - (protein_kcal + fat_kcal);
    carbs_g = carbs_kcal / 4;
  }
  
  // Норма воды: базовая формула 30 мл на кг веса
  let waterNorm = weight * 30;
  if (activity_level === 'active') waterNorm *= 1.3;
  else if (activity_level === 'moderate') waterNorm *= 1.15;
  
  return {
    dailyCalories: Math.round(dailyCalories),
    dailyProtein: Math.round(protein_g),
    dailyFat: Math.round(fat_g),
    dailyCarbs: Math.round(carbs_g),
    waterNorm: Math.round(waterNorm),
    // Дополнительная информация для отладки
    bmi: Math.round(bmi * 10) / 10,
    weightStatus: weightStatus
  };
}
