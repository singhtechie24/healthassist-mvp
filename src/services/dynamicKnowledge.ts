// Dynamic Knowledge Integration - Real-time Health Information Access
import type { UserProfile } from './healthAssessment';

export interface KnowledgeQuery {
  topic: string;
  userContext: UserProfile;
  specificNeeds: string[];
  constraints: string[];
}

export interface KnowledgeResponse {
  content: string;
  sources: string[];
  confidence: number;
  lastUpdated: Date;
}

export class DynamicKnowledge {
  
  /**
   * Phase 2: Dynamic Recipe Generation
   * Instead of hardcoded recipes, generate them based on user's specific needs
   */
  static async generatePersonalizedRecipes(
    userProfile: UserProfile,
    specificRequest: string = 'healthy recipes'
  ): Promise<KnowledgeResponse> {
    
    const recipePrompt = this.createRecipeGenerationPrompt(userProfile, specificRequest);
    
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: recipePrompt }],
          max_tokens: 500,
          temperature: 0.8 // More creative for recipe generation
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Recipe generation failed');
      }

      return {
        content: data.choices[0].message.content,
        sources: ['OpenAI Knowledge Base', 'Nutritional Science Database'],
        confidence: 0.9,
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('Dynamic recipe generation failed:', error);
      return this.getFallbackRecipeResponse(userProfile);
    }
  }

  /**
   * Generate dynamic nutritional advice based on current research
   */
  static async generateNutritionAdvice(
    userProfile: UserProfile,
    healthGoal: string
  ): Promise<KnowledgeResponse> {
    
    const nutritionPrompt = this.createNutritionAdvicePrompt(userProfile, healthGoal);
    
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: nutritionPrompt }],
          max_tokens: 350,
          temperature: 0.6
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Nutrition advice generation failed');
      }

      return {
        content: data.choices[0].message.content,
        sources: ['Latest Nutrition Research', 'Dietary Guidelines 2025'],
        confidence: 0.85,
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('Dynamic nutrition advice failed:', error);
      return this.getFallbackNutritionResponse(userProfile, healthGoal);
    }
  }

  /**
   * Create smart recipe generation prompt
   */
  private static createRecipeGenerationPrompt(
    userProfile: UserProfile,
    request: string
  ): string {
    return `As a professional nutritionist and chef, create personalized recipes for this user:

USER REQUEST: "${request}"

USER PROFILE:
${this.formatUserProfile(userProfile)}

INSTRUCTIONS:
1. Create 2-3 specific recipes that match their dietary preferences and constraints
2. Include ingredient lists, cooking instructions, and nutritional benefits
3. Consider their cooking skill level and time constraints
4. Provide calorie counts and macro breakdowns
5. Explain WHY each recipe is perfect for their goals
6. Include cooking tips and variations

REQUIREMENTS:
- Recipes must be practical and achievable for their skill level
- Ingredients should be accessible and budget-appropriate
- Instructions should be clear and step-by-step
- Highlight health benefits specific to their goals
- Include prep time and cooking time

FORMAT: Use clear headers, bullet points, and engaging descriptions.

Generate recipes that are truly personalized to this user's situation:`;
  }

  /**
   * Create nutrition advice prompt
   */
  private static createNutritionAdvicePrompt(
    userProfile: UserProfile,
    healthGoal: string
  ): string {
    return `As a registered dietitian with expertise in evidence-based nutrition, provide personalized advice:

HEALTH GOAL: "${healthGoal}"

USER PROFILE:
${this.formatUserProfile(userProfile)}

PROVIDE:
1. Specific nutritional recommendations for their goal
2. Macro and micronutrient targets
3. Meal timing and frequency advice
4. Foods to emphasize and foods to limit
5. Practical implementation strategies
6. Common challenges and how to overcome them

FOCUS ON:
- Evidence-based recommendations
- Practical, sustainable approaches
- Personalization to their lifestyle and preferences
- Clear, actionable advice they can implement today

Make it specific to their profile, not generic advice:`;
  }

  /**
   * Format user profile for prompts
   */
  private static formatUserProfile(profile: UserProfile): string {
    const parts = [];
    
    if (profile.age) parts.push(`Age: ${profile.age}`);
    if (profile.gender) parts.push(`Gender: ${profile.gender}`);
    if (profile.weight && profile.height) {
      const bmi = profile.weight / ((profile.height / 100) ** 2);
      parts.push(`BMI: ${bmi.toFixed(1)}`);
    }
    if (profile.activityLevel) parts.push(`Activity Level: ${profile.activityLevel}`);
    if (profile.dietaryType) parts.push(`Dietary Preference: ${profile.dietaryType}`);
    if (profile.cookingSkill) parts.push(`Cooking Skill: ${profile.cookingSkill}`);
    if (profile.cookingTime) parts.push(`Available Cooking Time: ${profile.cookingTime}`);
    if (profile.budgetLevel) parts.push(`Budget Level: ${profile.budgetLevel}`);
    if (profile.foodAllergies && profile.foodAllergies.length > 0) {
      parts.push(`Food Allergies: ${profile.foodAllergies.join(', ')}`);
    }
    if (profile.biggestChallenges && profile.biggestChallenges.length > 0) {
      parts.push(`Main Challenges: ${profile.biggestChallenges.join(', ')}`);
    }
    if (profile.goals && profile.goals.length > 0) {
      parts.push(`Health Goals: ${profile.goals.join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join('\n- ') : 'Limited profile information available';
  }

  /**
   * Fallback responses for when API fails
   */
  private static getFallbackRecipeResponse(profile: UserProfile): KnowledgeResponse {
    const dietaryInfo = profile.dietaryType || 'balanced';
    const skillLevel = profile.cookingSkill || 'beginner';
    
    return {
      content: `Here are some ${dietaryInfo} recipes perfect for ${skillLevel} cooks:

🍳 **Simple Protein Bowl**
- Quick to make (15 minutes)
- High protein for sustained energy
- Customizable to your taste preferences

🥗 **Nutrient-Dense Salad**
- Fresh vegetables for vitamins and minerals
- Healthy fats for satiety
- Easy meal prep option

I'd love to give you more personalized recipes! Could you tell me more about your dietary preferences, cooking time availability, and any foods you particularly enjoy or want to avoid?`,
      sources: ['Built-in Knowledge'],
      confidence: 0.6,
      lastUpdated: new Date()
    };
  }

  private static getFallbackNutritionResponse(
    profile: UserProfile, 
    goal: string
  ): KnowledgeResponse {
    return {
      content: `For your goal of ${goal}, here are some key nutritional principles:

🎯 **Focus Areas:**
- Balanced macronutrients (protein, carbs, healthy fats)
- Adequate hydration (8-10 glasses of water daily)
- Regular meal timing for stable energy

💪 **Implementation Strategy:**
- Start with small, sustainable changes
- Track your progress and adjust as needed
- Listen to your body's hunger and fullness cues

I'd love to provide more specific guidance! Could you share more about your current eating patterns, any dietary restrictions, and your lifestyle factors?`,
      sources: ['General Nutrition Guidelines'],
      confidence: 0.5,
      lastUpdated: new Date()
    };
  }

  /**
   * Smart knowledge retrieval based on context
   */
  static async getContextualKnowledge(
    query: KnowledgeQuery
  ): Promise<KnowledgeResponse> {
    
    if (query.topic.toLowerCase().includes('recipe') || query.topic.toLowerCase().includes('meal')) {
      return this.generatePersonalizedRecipes(query.userContext, query.topic);
    }
    
    if (query.topic.toLowerCase().includes('nutrition') || query.topic.toLowerCase().includes('diet')) {
      return this.generateNutritionAdvice(query.userContext, query.topic);
    }
    
    // For other health topics, use general knowledge generation
    return this.generateGeneralHealthAdvice(query.userContext, query.topic);
  }

  /**
   * Generate general health advice for topics not covered by specific handlers
   */
  private static async generateGeneralHealthAdvice(
    userProfile: UserProfile,
    topic: string
  ): Promise<KnowledgeResponse> {
    
    const generalPrompt = `As a health expert, provide personalized advice on: "${topic}"

USER PROFILE:
${this.formatUserProfile(userProfile)}

Provide specific, actionable advice that considers their personal situation and constraints. Focus on evidence-based recommendations they can implement immediately.`;

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: generalPrompt }],
          max_tokens: 300,
          temperature: 0.7
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'General health advice generation failed');
      }

      return {
        content: data.choices[0].message.content,
        sources: ['Health Knowledge Base'],
        confidence: 0.8,
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('General health advice generation failed:', error);
      return {
        content: `I'd be happy to help you with ${topic}! To provide the most helpful advice, could you tell me more about your specific situation and what you're hoping to achieve?`,
        sources: ['General Guidelines'],
        confidence: 0.4,
        lastUpdated: new Date()
      };
    }
  }
}


