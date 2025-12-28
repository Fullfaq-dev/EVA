/**
 * Расчет питания по формуле Миффлина-Сан Жеора
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
  // Формула Миффлина-Сан Жеора для расчета базального метаболизма (BMR)
  let bmr;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  
  // Коэффициент активности (скорректированные значения)
  const activityMultipliers = {
    sedentary: 1.2,    // Малоподвижный образ жизни
    moderate: 1.375,   // Умеренная активность (3-5 раз в неделю)
    active: 1.55       // Высокая активность (6-7 раз в неделю)
  };
  
  // Расчет TDEE (Total Daily Energy Expenditure)
  let tdee = bmr * activityMultipliers[activity_level];
  
  // Корректировка по цели
  const goalAdjustments = {
    gut_health: 1,      // Без изменений
    weight_loss: 0.85,  // -15% калорий для похудения
    muscle_gain: 1.15,  // +15% калорий для набора массы
    maintenance: 1      // Без изменений
  };
  
  const dailyCalories = tdee * goalAdjustments[goal];
  
  // Расчёт БЖУ (Белки, Жиры, Углеводы)
  let proteinRatio, fatRatio, carbRatio;
  
  switch (goal) {
    case 'muscle_gain':
      proteinRatio = 0.3;  // 30% белков
      fatRatio = 0.25;     // 25% жиров
      carbRatio = 0.45;    // 45% углеводов
      break;
    case 'weight_loss':
      proteinRatio = 0.35; // 35% белков
      fatRatio = 0.3;      // 30% жиров
      carbRatio = 0.35;    // 35% углеводов
      break;
    default:
      proteinRatio = 0.25; // 25% белков
      fatRatio = 0.3;      // 30% жиров
      carbRatio = 0.45;    // 45% углеводов
  }
  
  // Расчет граммов: калории / калорий на грамм
  // Белки и углеводы = 4 ккал/г, Жиры = 9 ккал/г
  const dailyProtein = (dailyCalories * proteinRatio) / 4;
  const dailyFat = (dailyCalories * fatRatio) / 9;
  const dailyCarbs = (dailyCalories * carbRatio) / 4;
  
  // Норма воды: базовая формула 30 мл на кг веса
  let waterNorm = weight * 30;
  if (activity_level === 'active') waterNorm *= 1.3;
  else if (activity_level === 'moderate') waterNorm *= 1.15;
  
  return {
    dailyCalories: Math.round(dailyCalories),
    dailyProtein: Math.round(dailyProtein),
    dailyFat: Math.round(dailyFat),
    dailyCarbs: Math.round(dailyCarbs),
    waterNorm: Math.round(waterNorm)
  };
}
