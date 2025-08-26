// Smart health assessment and personalization logic
export interface UserProfile {
  // Basic Info
  age?: number;
  height?: number; // in cm
  weight?: number; // in kg
  gender?: 'male' | 'female' | 'other';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  
  // Health Goals & Conditions
  goals?: string[];
  healthConditions?: string[];
  targetWeight?: number;
  weightLossPerWeek?: number; // kg per week
  
  // Dietary Preferences & Lifestyle  
  dietaryType?: 'vegetarian' | 'vegan' | 'non-vegetarian' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
  foodAllergies?: string[];
  foodIntolerances?: string[];
  dislikes?: string[];
  cookingSkill?: 'beginner' | 'intermediate' | 'advanced';
  cookingTime?: 'under-15min' | '15-30min' | '30-60min' | 'over-60min';
  mealPrepHabits?: 'daily-cooking' | 'weekly-prep' | 'occasional' | 'takeout-mostly';
  
  // Budget & Access
  budgetLevel?: 'low' | 'medium' | 'high';
  kitchenAccess?: 'full' | 'basic' | 'minimal';
  shoppingAccess?: 'grocery-stores' | 'limited' | 'online-mostly';
  
  // Challenges & Preferences
  biggestChallenges?: string[];
  strugglingTimes?: string[]; // e.g., 'morning', 'evening', 'late-night'
  motivationFactors?: string[];
  previousAttempts?: string[];
  
  // Metadata
  lastAssessment?: Date;
  conversationCount?: number;
}

export class HealthAssessment {
  static calculateBMI(weight: number, height: number): { bmi: number; category: string; advice: string } {
    const bmi = weight / ((height / 100) ** 2);
    
    let category: string;
    let advice: string;
    
    if (bmi < 18.5) {
      category = 'Underweight';
      advice = 'You may want to focus on healthy weight gain with nutrient-rich foods and strength training.';
    } else if (bmi < 25) {
      category = 'Normal weight';
      advice = 'Great job maintaining a healthy weight! Focus on maintaining your current lifestyle.';
    } else if (bmi < 30) {
      category = 'Overweight';
      advice = 'Consider adopting a balanced diet and increasing physical activity for gradual weight loss.';
    } else {
      category = 'Obese';
      advice = 'I recommend consulting with a healthcare professional for a comprehensive weight management plan.';
    }
    
    return { bmi: Math.round(bmi * 10) / 10, category, advice };
  }

  static calculateCalorieNeeds(profile: UserProfile): number | null {
    if (!profile.age || !profile.height || !profile.weight || !profile.gender) {
      return null;
    }

    // BMR calculation using Mifflin-St Jeor Equation
    let bmr: number;
    if (profile.gender === 'male') {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
    } else {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
    }

    // Activity multipliers
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    const multiplier = profile.activityLevel ? activityMultipliers[profile.activityLevel] : 1.2;
    return Math.round(bmr * multiplier);
  }

  static generatePersonalizedQuestions(topic: string, profile: UserProfile): string[] {
    const questions: string[] = [];
    const topicLower = topic.toLowerCase();

    // Phase 1: Essential basics (only if missing)
    if (!profile.age) questions.push("What's your age?");
    if (!profile.gender) questions.push("What's your gender?");
    if (!profile.height) questions.push("What's your height (in cm or feet/inches)?");
    if (!profile.weight) questions.push("What's your current weight?");

    // Phase 2: Context-specific deep dive questions
    if (topicLower.includes('weight') || topicLower.includes('lose') || topicLower.includes('diet')) {
      return this.generateWeightLossQuestions(profile);
    }
    
    if (topicLower.includes('food') || topicLower.includes('recipe') || topicLower.includes('meal') || topicLower.includes('nutrition')) {
      return this.generateNutritionQuestions(profile);
    }

    if (topicLower.includes('exercise') || topicLower.includes('fitness') || topicLower.includes('workout')) {
      return this.generateFitnessQuestions(profile);
    }

    if (topicLower.includes('stress') || topicLower.includes('mental') || topicLower.includes('sleep')) {
      return this.generateMentalHealthQuestions(profile);
    }

    // Default questions for general health topics
    if (!profile.activityLevel) questions.push("How would you describe your current activity level?");
    if (!profile.goals || profile.goals.length === 0) questions.push("What are your main health goals?");

    return questions.slice(0, 3);
  }

  static generateWeightLossQuestions(profile: UserProfile): string[] {
    const questions: string[] = [];

    // Essential questions first
    if (!profile.targetWeight) questions.push("What's your target weight goal?");
    if (!profile.dietaryType) questions.push("Are you vegetarian, vegan, or do you eat meat? Any specific diet you follow?");
    if (!profile.biggestChallenges || profile.biggestChallenges.length === 0) {
      questions.push("What's been your biggest challenge with losing weight in the past?");
    }

    // Advanced personalization
    if (!profile.cookingSkill) questions.push("How comfortable are you with cooking? (beginner/intermediate/advanced)");
    if (!profile.cookingTime) questions.push("How much time can you realistically spend cooking each day?");
    if (!profile.mealPrepHabits) questions.push("Do you prefer daily cooking, weekly meal prep, or quick solutions?");
    if (!profile.budgetLevel) questions.push("What's your food budget like? (tight/moderate/flexible)");
    if (!profile.strugglingTimes || profile.strugglingTimes.length === 0) {
      questions.push("What time of day do you struggle most with food choices? (morning/afternoon/evening/late-night)");
    }
    if (!profile.foodAllergies && !profile.foodIntolerances) {
      questions.push("Do you have any food allergies, intolerances, or foods you really dislike?");
    }

    return questions.slice(0, 4); // Allow more questions for weight loss
  }

  static generateNutritionQuestions(profile: UserProfile): string[] {
    const questions: string[] = [];

    if (!profile.dietaryType) questions.push("Are you vegetarian, vegan, non-vegetarian, or follow any specific diet?");
    if (!profile.cookingSkill) questions.push("What's your cooking skill level?");
    if (!profile.cookingTime) questions.push("How much time do you have for meal preparation?");
    if (!profile.budgetLevel) questions.push("What's your food budget range?");
    if (!profile.kitchenAccess) questions.push("Do you have access to a full kitchen with cooking equipment?");
    if (!profile.foodAllergies && !profile.foodIntolerances) {
      questions.push("Any food allergies, intolerances, or strong dislikes I should know about?");
    }

    return questions.slice(0, 3);
  }

  static generateFitnessQuestions(profile: UserProfile): string[] {
    const questions: string[] = [];

    if (!profile.activityLevel) questions.push("What's your current activity level?");
    if (!profile.goals || !profile.goals.some(goal => goal.includes('fitness'))) {
      questions.push("What are your fitness goals? (weight loss/muscle gain/endurance/general health)");
    }
    questions.push("How many days per week can you realistically commit to exercise?");
    questions.push("Do you prefer home workouts, gym, outdoor activities, or sports?");
    questions.push("Any physical limitations or injuries I should consider?");

    return questions.slice(0, 3);
  }

  static generateMentalHealthQuestions(_profile: UserProfile): string[] { // eslint-disable-line @typescript-eslint/no-unused-vars
    const questions: string[] = [];

    questions.push("On a scale of 1-10, how would you rate your current stress level?");
    questions.push("How many hours of sleep do you typically get per night?");
    questions.push("What are your main sources of stress or anxiety?");
    questions.push("Do you have any current coping strategies that work for you?");

    return questions.slice(0, 3);
  }

  static shouldAskQuestions(message: string, profile: UserProfile): boolean {
    // Health-related topics that benefit from personal assessment
    const healthTopics = [
      'weight', 'lose', 'diet', 'nutrition', 'exercise', 'fitness', 'workout',
      'calories', 'bmi', 'healthy', 'plan', 'goal', 'stress', 'sleep', 'energy'
    ];

    const messageWords = message.toLowerCase().split(' ');
    const hasHealthTopic = healthTopics.some(topic => 
      messageWords.some(word => word.includes(topic))
    );

    // Ask questions if it's a health topic and we don't have basic profile info
    return hasHealthTopic && (!profile.age || !profile.height || !profile.weight);
  }

  static createPersonalizedResponse(topic: string, profile: UserProfile): string {
    if (profile.weight && profile.height) {
      const bmiData = this.calculateBMI(profile.weight, profile.height);
      const calories = this.calculateCalorieNeeds(profile);
      
      let response = `Hey there! 😊 I'm excited to help you on your health journey! \n\n`;
      
      if (topic.toLowerCase().includes('weight') || topic.toLowerCase().includes('lose')) {
        response += `Based on your current stats:\n`;
        response += `📊 **Your BMI**: ${bmiData.bmi} (${bmiData.category})\n`;
        response += `🔥 **Daily Calories**: ~${calories} calories\n\n`;
        response += `${bmiData.advice}\n\n`;
        response += `To make this journey successful, I'd love to know more about you! `;
        return response;
      }
    }

    return '';
  }
}

// Enhanced health context detection with deeper understanding
export const detectHealthContext = (message: string): {
  type: 'weight_loss' | 'fitness' | 'nutrition' | 'mental_health' | 'general' | 'symptoms' | 'recipe_request' | 'meal_planning';
  urgency: 'low' | 'medium' | 'high';
  needsAssessment: boolean;
  specificIntent?: string;
  keywords: string[];
} => {
  const msg = message.toLowerCase();
  const keywords: string[] = [];
  
  // Emergency symptoms (high priority)
  const emergencySymptoms = [
    'chest pain', 'difficulty breathing', 'severe bleeding', 'stroke', 'heart attack',
    'severe headache', 'sudden numbness', 'severe abdominal pain', 'difficulty speaking',
    'severe allergic reaction', 'suicide', 'self harm'
  ];
  
  for (const symptom of emergencySymptoms) {
    if (msg.includes(symptom)) {
      keywords.push(symptom);
      return { type: 'symptoms', urgency: 'high', needsAssessment: false, specificIntent: 'emergency', keywords };
    }
  }

  // Recipe and meal planning requests (specific intent)
  const recipeKeywords = ['recipe', 'recipes', 'cook', 'cooking', 'meal plan', 'meal prep', 'food ideas', 'what to eat'];
  if (recipeKeywords.some(keyword => msg.includes(keyword))) {
    keywords.push(...recipeKeywords.filter(keyword => msg.includes(keyword)));
    if (msg.includes('weight loss') || msg.includes('lose weight') || msg.includes('healthy')) {
      return { type: 'recipe_request', urgency: 'low', needsAssessment: true, specificIntent: 'weight_loss_recipes', keywords };
    }
    return { type: 'recipe_request', urgency: 'low', needsAssessment: true, specificIntent: 'general_recipes', keywords };
  }

  // Weight loss context (enhanced detection)
  const weightLossKeywords = [
    'weight', 'lose', 'diet', 'calories', 'fat', 'slim', 'obesity', 'overweight',
    'weight loss', 'lose weight', 'get fit', 'body fat', 'belly fat', 'keto', 'paleo'
  ];
  if (weightLossKeywords.some(keyword => msg.includes(keyword))) {
    keywords.push(...weightLossKeywords.filter(keyword => msg.includes(keyword)));
    return { type: 'weight_loss', urgency: 'low', needsAssessment: true, specificIntent: 'weight_management', keywords };
  }

  // Fitness context (enhanced detection)
  const fitnessKeywords = [
    'exercise', 'workout', 'fitness', 'gym', 'muscle', 'strength', 'cardio',
    'running', 'walking', 'yoga', 'pilates', 'training', 'abs', 'biceps'
  ];
  if (fitnessKeywords.some(keyword => msg.includes(keyword))) {
    keywords.push(...fitnessKeywords.filter(keyword => msg.includes(keyword)));
    return { type: 'fitness', urgency: 'low', needsAssessment: true, specificIntent: 'exercise_planning', keywords };
  }

  // Mental health context (enhanced detection)
  const mentalHealthKeywords = [
    'stress', 'anxiety', 'depression', 'sleep', 'insomnia', 'tired', 'exhausted',
    'mental health', 'mood', 'sad', 'overwhelmed', 'panic', 'worry'
  ];
  if (mentalHealthKeywords.some(keyword => msg.includes(keyword))) {
    keywords.push(...mentalHealthKeywords.filter(keyword => msg.includes(keyword)));
    return { type: 'mental_health', urgency: 'medium', needsAssessment: true, specificIntent: 'wellness_support', keywords };
  }

  // Nutrition context (enhanced detection)
  const nutritionKeywords = [
    'food', 'nutrition', 'meal', 'eat', 'hungry', 'snack', 'protein', 'carbs',
    'vitamins', 'minerals', 'healthy eating', 'balanced diet', 'nutrients'
  ];
  if (nutritionKeywords.some(keyword => msg.includes(keyword))) {
    keywords.push(...nutritionKeywords.filter(keyword => msg.includes(keyword)));
    return { type: 'nutrition', urgency: 'low', needsAssessment: true, specificIntent: 'nutritional_guidance', keywords };
  }

  // Pain and symptoms (medium priority)
  const symptomKeywords = [
    'pain', 'headache', 'fever', 'nausea', 'dizzy', 'cough', 'cold', 'flu',
    'stomach ache', 'back pain', 'joint pain', 'muscle pain'
  ];
  if (symptomKeywords.some(keyword => msg.includes(keyword))) {
    keywords.push(...symptomKeywords.filter(keyword => msg.includes(keyword)));
    return { type: 'symptoms', urgency: 'medium', needsAssessment: false, specificIntent: 'symptom_assessment', keywords };
  }

  return { 
    type: 'general', 
    urgency: 'low', 
    needsAssessment: false, 
    specificIntent: 'general_health', 
    keywords: [] 
  };
};
