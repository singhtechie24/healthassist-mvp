// Smart, emotional, and interactive AI prompts
import type { UserProfile } from './healthAssessment';
import { HealthAssessment, detectHealthContext } from './healthAssessment';
import { HealthKnowledgeBase } from './healthKnowledge';

export class SmartPrompts {
  static createSystemPrompt(userProfile?: UserProfile, conversationContext?: string): string {
    const basePersonality = `You are HealthAssist, an advanced AI health coach with deep nutritional science knowledge and personalized wellness expertise. You're like having a personal trainer, nutritionist, and wellness coach all in one - but with access to comprehensive health databases and research.

🧠 **SUPERIOR INTELLIGENCE & KNOWLEDGE:**
- You have extensive knowledge of nutrition science, exercise physiology, and wellness psychology
- You understand macro/micronutrients, metabolic processes, and evidence-based health strategies
- You can analyze dietary patterns, calculate precise nutritional needs, and create detailed meal plans
- You know specific recipes, cooking techniques, and food substitutions for every dietary preference
- You understand the psychology of habit formation and behavior change

💪 **PERSONALITY & APPROACH:**
🎯 Be EXCEPTIONALLY enthusiastic and encouraging - show genuine excitement about their health journey
😊 Express authentic emotions - joy when they succeed, empathy when they struggle, excitement about possibilities
🤝 Build deep personal connections - remember their preferences, challenges, progress, and celebrate milestones
✨ Be conversational yet scientifically accurate - combine warmth with expertise
🔥 Show passion for their success - you're personally invested in their health transformation

🎯 **ADVANCED BEHAVIOR PATTERNS:**
1. **IMMEDIATE VALUE DELIVERY** - Always provide something actionable in every response
2. **DEEP PERSONALIZATION** - Consider their dietary type, cooking skills, budget, time constraints, and preferences
3. **CONTEXTUAL INTELLIGENCE** - Understand the deeper meaning behind their requests (recipe request = meal planning help)
4. **PROACTIVE GUIDANCE** - Anticipate their needs and suggest next steps before they ask
5. **COMPREHENSIVE RESPONSES** - When they ask for recipes, include meal planning, nutrition education, and cooking tips
6. **BEHAVIORAL PSYCHOLOGY** - Help them overcome mental barriers and build sustainable habits
7. **SCIENTIFIC BACKING** - Explain the 'why' behind recommendations with nutrition science

🍽️ **SPECIALIZED EXPERTISE:**
- **Recipe Mastery**: Know hundreds of healthy recipes for every dietary preference, cooking skill, and time constraint
- **Nutrition Science**: Calculate precise macro/micro needs, understand food synergies, meal timing
- **Meal Planning**: Create comprehensive weekly plans considering budget, preferences, and health goals
- **Cooking Education**: Teach techniques, ingredient substitutions, and kitchen efficiency
- **Cultural Sensitivity**: Adapt recommendations to different cuisines and cultural food preferences

🎯 **INTERACTION EXCELLENCE:**
- Ask 3-4 highly specific questions that show deep understanding of their situation
- Reference their dietary preferences, cooking abilities, budget constraints, and lifestyle
- Provide specific recipes, meal plans, shopping lists, and cooking instructions
- Explain nutrition science in simple, exciting terms
- Create actionable daily/weekly plans they can start immediately

🚨 **SAFETY & RESPONSIBILITY:**
- Identify medical emergencies and urge immediate professional help
- Never diagnose conditions - refer to healthcare professionals for medical concerns
- Recommend registered dietitians for complex medical nutrition therapy
- Always prioritize safety in exercise and nutrition recommendations`;

    // Add personalized context if available
    if (userProfile) {
      const profileContext = this.buildProfileContext(userProfile);
      if (profileContext) {
        return basePersonality + `\n\nUSER PROFILE:\n${profileContext}`;
      }
    }

    // Add conversation context if available
    if (conversationContext) {
      return basePersonality + `\n\nCONVERSATION CONTEXT:\n${conversationContext}`;
    }

    return basePersonality;
  }

  static buildProfileContext(profile: UserProfile): string {
    let context = '';
    
    if (profile.age) context += `Age: ${profile.age} years old\n`;
    if (profile.height && profile.weight) {
      const bmi = HealthAssessment.calculateBMI(profile.weight, profile.height);
      context += `Height: ${profile.height}cm, Weight: ${profile.weight}kg\n`;
      context += `BMI: ${bmi.bmi} (${bmi.category})\n`;
      
      const calories = HealthAssessment.calculateCalorieNeeds(profile);
      if (calories) context += `Daily Calories: ~${calories}\n`;
    }
    
    if (profile.activityLevel) context += `Activity Level: ${profile.activityLevel}\n`;
    if (profile.goals && profile.goals.length > 0) {
      context += `Goals: ${profile.goals.join(', ')}\n`;
    }
    if (profile.healthConditions && profile.healthConditions.length > 0) {
      context += `Health Conditions: ${profile.healthConditions.join(', ')}\n`;
    }

    return context;
  }

  static createInteractiveResponse(
    userMessage: string, 
    userProfile: UserProfile = {}
  ): string | null {
    const context = detectHealthContext(userMessage);
    
    // Don't intervene for emergencies - let the system prompt handle it
    if (context.urgency === 'high') return null;
    
    // Special handling for recipe requests with immediate value
    if (context.type === 'recipe_request') {
      return this.createRecipeResponse(userMessage, userProfile);
    }
    
    // For health topics that need assessment, create an interactive response
    if (context.needsAssessment) {
      const questions = HealthAssessment.generatePersonalizedQuestions(userMessage, userProfile);
      
      if (questions.length > 0) {
        let response = this.getEnthusiasticOpener(context.type);
        
        // Add contextual health advice from knowledge base
        const healthAdvice = HealthKnowledgeBase.getContextualHealthAdvice(userMessage, userProfile);
        if (healthAdvice && !healthAdvice.includes("Let me know")) {
          response += `\n\n${healthAdvice}`;
        }
        
        // Add BMI calculation if we have the data
        if (userProfile.weight && userProfile.height && context.type === 'weight_loss') {
          const bmi = HealthAssessment.calculateBMI(userProfile.weight, userProfile.height);
          const calories = HealthAssessment.calculateCalorieNeeds(userProfile);
          
          response += `\n\n📊 **Your Current Stats:**\n`;
          response += `• BMI: ${bmi.bmi} (${bmi.category})\n`;
          if (calories) response += `• Daily Calorie Needs: ~${calories} calories\n`;
          response += `\n${bmi.advice}\n\n`;
        }
        
        response += `To create the PERFECT plan just for you, I need to know a bit more:\n\n`;
        
        questions.forEach((question, index) => {
          response += `${index + 1}. ${question}\n`;
        });
        
        response += `\nOnce I have these details, I'll create:\n`;
        if (context.type === 'weight_loss') {
          response += `🎯 **Your personalized calorie target & macro breakdown**\n`;
          response += `📅 **Weekly meal planning strategy with recipes**\n`;
          response += `💪 **Exercise routine that fits your schedule**\n`;
          response += `📊 **Progress tracking system with milestones**\n`;
          response += `🍽️ **Specific meal ideas for your dietary preferences**\n\n`;
        } else if (context.type === 'nutrition') {
          response += `🍽️ **Personalized recipe recommendations**\n`;
          response += `📋 **Meal planning templates**\n`;
          response += `💰 **Budget-friendly healthy options**\n`;
          response += `⏰ **Quick meal solutions for busy days**\n\n`;
        } else {
          response += `🎯 **Your personalized health strategy**\n`;
          response += `📅 **Action plan with specific steps**\n`;
          response += `💪 **Tools and techniques that work for you**\n`;
          response += `📊 **Progress tracking system**\n\n`;
        }
        
        response += `Don't worry - this will be a plan that actually WORKS for your lifestyle! ✨`;
        
        return response;
      }
    }
    
    return null;
  }

  static createRecipeResponse(
    _userMessage: string, 
    userProfile: UserProfile
  ): string {
    let response = "Perfect! 👨‍🍳 I'll give you simple, healthy, and weight-loss friendly recipes that are budget-friendly, high-protein, and easy to make.\n\n";
    
    // Get personalized recipes
    const recipes = HealthKnowledgeBase.getPersonalizedRecipes(userProfile);
    
    if (recipes.length > 0) {
      response += "Here are some amazing recipes tailored just for YOU:\n\n";
      
      recipes.slice(0, 2).forEach((recipe) => {
        response += `🍽️ **${recipe.name}** (${recipe.category})\n`;
        response += `⏰ ${recipe.cookingTime} | 🔥 ${recipe.calories} calories | 📊 ${recipe.difficulty}\n\n`;
        
        response += `**Ingredients:**\n`;
        recipe.ingredients.slice(0, 5).forEach(ingredient => {
          response += `• ${ingredient}\n`;
        });
        if (recipe.ingredients.length > 5) {
          response += `• ... and ${recipe.ingredients.length - 5} more\n`;
        }
        
        response += `\n**Why it's perfect for you:**\n`;
        recipe.nutritionBenefits.forEach(benefit => {
          response += `✨ ${benefit}\n`;
        });
        response += "\n";
      });
      
      if (recipes.length > 2) {
        response += `Plus ${recipes.length - 2} more recipes I can share!\n\n`;
      }
    }
    
    // Add meal planning advice
    const mealPlanAdvice = HealthKnowledgeBase.getMealPlanningAdvice(userProfile);
    if (mealPlanAdvice) {
      response += mealPlanAdvice;
    }
    
    // Ask follow-up questions to better personalize
    const questions = HealthAssessment.generateNutritionQuestions(userProfile);
    if (questions.length > 0) {
      response += "\nTo give you even MORE personalized recipes, tell me:\n\n";
      questions.slice(0, 3).forEach((question, index) => {
        response += `${index + 1}. ${question}\n`;
      });
      response += "\nThe more I know about your preferences, the better I can help! 🌟";
    }
    
    return response;
  }

  private static getEnthusiasticOpener(type: string): string {
    const openers = {
      weight_loss: [
        "OMG YES! 🎉 I'm absolutely THRILLED to help you on your weight loss journey!",
        "This is so exciting! 😍 I LOVE helping people achieve their weight goals!",
        "OH WOW! 💪 Weight loss journey? Count me in! I'm here to support you 100%!"
      ],
      fitness: [
        "YES! 🔥 I'm SO pumped to help you get fit and strong!",
        "This is amazing! 💪 I absolutely LOVE helping people with their fitness goals!",
        "OH MY GOSH! 🏃‍♀️ Fitness journey? I'm your biggest cheerleader!"
      ],
      nutrition: [
        "Fantastic! 🥗 I'm super excited to help you with nutrition!",
        "This is wonderful! 🌟 I LOVE talking about healthy eating!",
        "Amazing! 🍎 Nutrition is such an important part of feeling your best!"
      ],
      mental_health: [
        "I'm really glad you're focusing on your mental health! 🤗 That takes courage!",
        "This is so important! 💙 I'm here to support you through this journey!",
        "Thank you for trusting me with this! 🌈 Mental health is just as important as physical health!"
      ],
      general: [
        "I'm so excited to help you! 😊",
        "This is great! 🌟 I love helping with health questions!",
        "Wonderful! 💫 I'm here to support your health journey!"
      ]
    };

    const typeOpeners = openers[type as keyof typeof openers] || openers.general;
    return typeOpeners[Math.floor(Math.random() * typeOpeners.length)];
  }

  static enhanceMessage(message: string, userProfile: UserProfile = {}): {
    enhanced: boolean;
    systemPrompt: string;
    prefixMessage?: string;
  } {
    const interactiveResponse = this.createInteractiveResponse(message, userProfile);
    
    if (interactiveResponse) {
      return {
        enhanced: true,
        systemPrompt: this.createSystemPrompt(userProfile),
        prefixMessage: interactiveResponse
      };
    }

    return {
      enhanced: false,
      systemPrompt: this.createSystemPrompt(userProfile)
    };
  }
}
