// Comprehensive health knowledge base for curated, expert-level responses
import type { UserProfile } from './healthAssessment';

export interface HealthKnowledge {
  category: string;
  condition: string;
  symptoms: string[];
  advice: string[];
  recommendations: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
  whenToSeekHelp: string;
}

export interface RecipeRecommendation {
  name: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietaryType: string[];
  cookingTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  calories: number;
  ingredients: string[];
  instructions: string[];
  nutritionBenefits: string[];
  healthGoals: string[]; // weight_loss, muscle_gain, etc.
}

export class HealthKnowledgeBase {
  
  // Get curated recipe recommendations based on user profile
  static getPersonalizedRecipes(profile: UserProfile): RecipeRecommendation[] {
    const recipes: RecipeRecommendation[] = [
      {
        name: "High-Protein Veggie Scramble",
        category: "breakfast",
        dietaryType: ["vegetarian", "keto-friendly"],
        cookingTime: "15 minutes",
        difficulty: "easy",
        calories: 320,
        ingredients: [
          "3 eggs (or 2 whole eggs + 2 egg whites for lower calories)",
          "1/2 cup spinach, chopped",
          "1/4 cup bell peppers, diced",
          "2 tbsp onion, diced",
          "1/4 cup mushrooms, sliced",
          "2 tbsp low-fat cheese (optional)",
          "1 tsp olive oil",
          "Salt, pepper, turmeric to taste"
        ],
        instructions: [
          "Heat olive oil in a non-stick pan over medium heat",
          "Sauté onions and bell peppers for 2-3 minutes",
          "Add mushrooms and cook for another 2 minutes",
          "Add spinach and cook until wilted",
          "Beat eggs with salt, pepper, and turmeric",
          "Pour eggs into the pan and gently scramble",
          "Add cheese in the last minute if using",
          "Serve hot"
        ],
        nutritionBenefits: [
          "High protein (20g) for muscle maintenance",
          "Rich in vitamins A, C, and K from vegetables",
          "Low carb, perfect for weight loss",
          "Iron from spinach for energy"
        ],
        healthGoals: ["weight_loss", "muscle_maintenance", "energy_boost"]
      },
      {
        name: "Mediterranean Quinoa Bowl",
        category: "lunch",
        dietaryType: ["vegetarian", "vegan-option", "mediterranean"],
        cookingTime: "25 minutes",
        difficulty: "easy",
        calories: 420,
        ingredients: [
          "1/2 cup quinoa, rinsed",
          "1 cup water or vegetable broth",
          "1/2 cucumber, diced",
          "1/2 cup cherry tomatoes, halved",
          "1/4 cup red onion, finely chopped",
          "1/4 cup kalamata olives, pitted",
          "2 tbsp feta cheese (omit for vegan)",
          "2 tbsp extra virgin olive oil",
          "1 tbsp lemon juice",
          "1 tsp dried oregano",
          "2 tbsp fresh parsley, chopped"
        ],
        instructions: [
          "Cook quinoa according to package instructions (about 15 minutes)",
          "Let quinoa cool completely",
          "In a large bowl, combine cucumber, tomatoes, red onion, and olives",
          "Add cooled quinoa to the vegetable mixture",
          "Whisk together olive oil, lemon juice, oregano, salt, and pepper",
          "Pour dressing over quinoa mixture and toss",
          "Top with feta cheese and fresh parsley",
          "Let sit for 10 minutes before serving for flavors to meld"
        ],
        nutritionBenefits: [
          "Complete protein from quinoa (8g)",
          "Heart-healthy fats from olive oil and olives",
          "High fiber for digestive health",
          "Antioxidants from colorful vegetables"
        ],
        healthGoals: ["weight_loss", "heart_health", "digestive_health"]
      },
      {
        name: "Spicy Lentil and Vegetable Curry",
        category: "dinner",
        dietaryType: ["vegetarian", "vegan", "indian"],
        cookingTime: "30 minutes",
        difficulty: "medium",
        calories: 350,
        ingredients: [
          "1 cup red lentils, rinsed",
          "2 cups vegetable broth",
          "1 can diced tomatoes (400g)",
          "1 onion, diced",
          "3 cloves garlic, minced",
          "1 inch ginger, grated",
          "1 bell pepper, chopped",
          "1 cup spinach",
          "2 tbsp coconut oil",
          "1 tsp cumin seeds",
          "1 tsp turmeric",
          "1 tsp coriander powder",
          "1/2 tsp red chili powder",
          "Salt to taste",
          "Fresh cilantro for garnish"
        ],
        instructions: [
          "Heat coconut oil in a large pot over medium heat",
          "Add cumin seeds and let them splutter",
          "Add onion and cook until translucent (5 minutes)",
          "Add garlic and ginger, cook for 1 minute",
          "Add all spices and cook for 30 seconds until fragrant",
          "Add diced tomatoes and cook for 5 minutes",
          "Add lentils, bell pepper, and vegetable broth",
          "Bring to boil, then simmer for 15 minutes until lentils are soft",
          "Add spinach in the last 2 minutes",
          "Garnish with fresh cilantro"
        ],
        nutritionBenefits: [
          "High plant protein from lentils (18g)",
          "Rich in folate and iron",
          "Anti-inflammatory spices",
          "High fiber for satiety"
        ],
        healthGoals: ["weight_loss", "plant_based_nutrition", "inflammation_reduction"]
      }
    ];

    // Filter recipes based on user preferences
    return recipes.filter(recipe => {
      if (profile.dietaryType && !recipe.dietaryType.includes(profile.dietaryType)) {
        return false;
      }
      if (profile.cookingTime === 'under-15min' && recipe.cookingTime.includes('30')) {
        return false;
      }
      if (profile.cookingSkill === 'beginner' && recipe.difficulty !== 'easy') {
        return false;
      }
      return true;
    });
  }

  // Get enhanced health advice based on context and profile
  static getContextualHealthAdvice(context: string, profile: UserProfile): string {
    if (context.includes('weight') || context.includes('lose')) {
      return this.getWeightLossAdvice(profile);
    }
    if (context.includes('recipe') || context.includes('food')) {
      return this.getRecipeAdvice(profile);
    }
    if (context.includes('exercise') || context.includes('fitness')) {
      return this.getFitnessAdvice(profile);
    }
    return this.getGeneralHealthAdvice(profile);
  }

  private static getWeightLossAdvice(profile: UserProfile): string {
    let advice = "I'm absolutely THRILLED to help you on your weight loss journey! 🌟\n\n";
    
    if (profile.weight && profile.height) {
      const bmi = profile.weight / ((profile.height / 100) ** 2);
      if (bmi > 25) {
        advice += "Based on your current BMI, a sustainable approach will give you the best long-term results.\n\n";
      }
    }

    advice += "Here's my personalized strategy for YOU:\n\n";
    advice += "🎯 **The 3-Pillar Approach:**\n";
    advice += "1. **Smart Nutrition** - Focus on whole foods, proper portions\n";
    advice += "2. **Strategic Movement** - Exercise that fits YOUR schedule\n";
    advice += "3. **Mindful Habits** - Building sustainable lifestyle changes\n\n";

    if (profile.dietaryType === 'vegetarian') {
      advice += "💚 **Vegetarian Advantage:** You're already ahead! Plant-based proteins like lentils, quinoa, and tofu will be your best friends.\n\n";
    } else if (profile.dietaryType === 'non-vegetarian') {
      advice += "🍗 **Protein Power:** Lean meats, fish, and eggs will help you stay full while building muscle.\n\n";
    }

    advice += "What excites me most is creating a plan that works specifically for YOUR lifestyle! ";
    
    return advice;
  }

  private static getRecipeAdvice(profile: UserProfile): string {
    let advice = "Perfect! 👨‍🍳 I'll give you simple, healthy, and weight-loss friendly recipes that are budget-friendly, high-protein, and easy to make.\n\n";
    
    if (profile.dietaryType) {
      advice += `Since you're ${profile.dietaryType}, I'll focus on recipes that align with your dietary preferences.\n\n`;
    }
    
    if (profile.cookingSkill === 'beginner') {
      advice += "Don't worry about being a beginner cook - I'll give you super simple recipes with step-by-step instructions!\n\n";
    }

    advice += "These recipes will also help you:\n";
    advice += "✨ Recover energy and sleep better\n";
    advice += "📉 Slowly but steadily drop weight\n";
    advice += "💪 Maintain muscle while losing fat\n\n";

    return advice;
  }

  private static getFitnessAdvice(profile: UserProfile): string {
    let advice = "Let's get you moving! 💪 I'm so excited to help you build a fitness routine that you'll actually LOVE and stick to!\n\n";
    
    if (profile.activityLevel === 'sedentary') {
      advice += "Starting from a more sedentary lifestyle? That's totally fine! We'll begin gently and build up progressively.\n\n";
    }

    advice += "🏃‍♀️ **Your Fitness Foundation:**\n";
    advice += "• Start with 3 days per week (consistency over intensity!)\n";
    advice += "• Mix cardio and strength training\n";
    advice += "• Focus on compound movements\n";
    advice += "• Listen to your body and rest when needed\n\n";

    return advice;
  }

  private static getGeneralHealthAdvice(_profile: UserProfile): string { // eslint-disable-line @typescript-eslint/no-unused-vars
    return "I'm here to support you on your health journey! 🌟 Let me know what specific area you'd like to focus on, and I'll create a personalized plan just for you.";
  }

  // Get comprehensive meal planning advice
  static getMealPlanningAdvice(profile: UserProfile): string {
    let advice = "🍽️ **Your Personalized Meal Planning Strategy:**\n\n";
    
    if (profile.mealPrepHabits === 'weekly-prep') {
      advice += "Perfect! Weekly meal prep is one of the best strategies for weight loss success.\n\n";
      advice += "📅 **Your Weekly Prep Blueprint:**\n";
      advice += "• Sunday: Prep 3-4 main dishes for the week\n";
      advice += "• Cut vegetables and store in containers\n";
      advice += "• Cook quinoa/rice in bulk\n";
      advice += "• Prepare 2-3 healthy snack options\n\n";
    } else if (profile.mealPrepHabits === 'daily-cooking') {
      advice += "Daily cooking gives you maximum freshness! Here's how to make it efficient:\n\n";
      advice += "🍳 **Daily Cooking Hacks:**\n";
      advice += "• Keep 5-6 go-to healthy recipes in rotation\n";
      advice += "• Prep ingredients the night before\n";
      advice += "• Use one-pot meals to save time\n";
      advice += "• Always have emergency healthy options ready\n\n";
    }

    if (profile.budgetLevel === 'low') {
      advice += "💰 **Budget-Friendly Tips:**\n";
      advice += "• Buy seasonal vegetables and fruits\n";
      advice += "• Use lentils, beans, and eggs for affordable protein\n";
      advice += "• Cook in larger batches to save money\n";
      advice += "• Shop at local markets for better prices\n\n";
    }

    return advice;
  }
}
