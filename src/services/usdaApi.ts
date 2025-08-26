// USDA FoodData Central API Service
// Enhanced with API key for higher rate limits and better performance

const USDA_BASE_URL = import.meta.env.VITE_USDA_API_BASE_URL || 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY;

export interface USDAFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: {
    nutrientId: number;
    nutrientName: string;
    value: number;
    unitName: string;
  }[];
  ingredientDescription?: string;
  brandOwner?: string;
}

export interface USDASearchResult {
  foods: USDAFood[];
  totalHits: number;
  totalPages: number;
}

export interface NutritionTip {
  id: string;
  title: string;
  content: string;
  category: string;
  source: 'USDA' | 'local';
  foodData?: USDAFood;
  nutrients?: string[];
}

class USDAApiService {
  // Search for foods in USDA database
  async searchFoods(query: string, pageSize: number = 10): Promise<USDASearchResult | null> {
    try {
      const searchUrl = `${USDA_BASE_URL}/foods/search`;
      const params = new URLSearchParams({
        query: query,
        pageSize: pageSize.toString(),
        dataType: 'Foundation,SR Legacy', // Focus on reliable data types
        sortBy: 'dataType.keyword',
        sortOrder: 'asc'
      });

      // Add API key if available for enhanced rate limits
      if (USDA_API_KEY) {
        params.set('api_key', USDA_API_KEY);
      }

      const response = await fetch(`${searchUrl}?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ USDA API error:', response.status, response.statusText, errorText);
        return null;
      }

      const data = await response.json();
      console.log(`✅ Found ${data.totalHits} foods for "${query}"`);
      
      return data as USDASearchResult;
    } catch (error) {
      console.error('Error fetching from USDA API:', error);
      return null;
    }
  }

  // Get detailed food information by FDC ID
  async getFoodDetails(fdcId: number): Promise<USDAFood | null> {
    try {
      const detailUrl = `${USDA_BASE_URL}/food/${fdcId}`;
      const params = new URLSearchParams();
      
      // Add API key if available for enhanced rate limits
      if (USDA_API_KEY) {
        params.set('api_key', USDA_API_KEY);
      }
      
      const finalUrl = params.toString() ? `${detailUrl}?${params}` : detailUrl;
      
      console.log(`🔍 Getting USDA food details for ID: ${fdcId}`);
      
      const response = await fetch(finalUrl);
      
      if (!response.ok) {
        console.error('USDA API error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      console.log(`✅ Retrieved food details: ${data.description}`);
      
      return data as USDAFood;
    } catch (error) {
      console.error('Error fetching food details from USDA API:', error);
      return null;
    }
  }

  // Generate nutrition tips based on healthy foods
  async generateNutritionTips(): Promise<NutritionTip[]> {
    const tips: NutritionTip[] = [];
    
    console.log('🥗 generateNutritionTips called');
    console.log('🔑 USDA_API_KEY available:', !!USDA_API_KEY);
    console.log('🔗 USDA_BASE_URL:', USDA_BASE_URL);
    
    // Enhanced healthy foods to generate tips from
    const healthyFoods = [
      // Vegetables
      { search: 'spinach raw', category: 'Vegetables', tipType: 'iron-rich' },
      { search: 'kale raw', category: 'Vegetables', tipType: 'vitamin-k' },
      { search: 'broccoli raw', category: 'Vegetables', tipType: 'vitamin-c' },
      { search: 'sweet potato baked', category: 'Vegetables', tipType: 'beta-carotene' },
      { search: 'bell peppers red', category: 'Vegetables', tipType: 'antioxidants' },
      
      // Proteins
      { search: 'salmon cooked', category: 'Protein', tipType: 'omega-3' },
      { search: 'chicken breast', category: 'Protein', tipType: 'lean-protein' },
      { search: 'eggs whole', category: 'Protein', tipType: 'complete-protein' },
      { search: 'lentils cooked', category: 'Protein', tipType: 'plant-protein' },
      
      // Fruits
      { search: 'blueberries raw', category: 'Fruits', tipType: 'antioxidants' },
      { search: 'oranges raw', category: 'Fruits', tipType: 'vitamin-c' },
      { search: 'bananas raw', category: 'Fruits', tipType: 'potassium' },
      { search: 'strawberries raw', category: 'Fruits', tipType: 'fiber' },
      
      // Whole Grains
      { search: 'quinoa cooked', category: 'Grains', tipType: 'complete-protein' },
      { search: 'oats raw', category: 'Grains', tipType: 'beta-glucan' },
      { search: 'brown rice cooked', category: 'Grains', tipType: 'complex-carbs' },
      
      // Healthy Fats
      { search: 'avocado raw', category: 'Healthy Fats', tipType: 'monounsaturated' },
      { search: 'almonds raw', category: 'Nuts', tipType: 'vitamin-e' },
      { search: 'walnuts raw', category: 'Nuts', tipType: 'omega-3' },
      { search: 'olive oil extra virgin', category: 'Healthy Fats', tipType: 'heart-healthy' },
      
      // Dairy & Alternatives
      { search: 'greek yogurt plain', category: 'Dairy', tipType: 'probiotics' },
      { search: 'milk low fat', category: 'Dairy', tipType: 'calcium' }
    ];

    try {
      console.log(`🔄 Processing ${healthyFoods.length} food searches...`);
      
      for (const food of healthyFoods) {
        console.log(`🔍 Searching for: ${food.search}`);
        const searchResult = await this.searchFoods(food.search, 1);
        
        if (searchResult && searchResult.foods.length > 0) {
          const foodData = searchResult.foods[0];
          console.log(`✅ Found food: ${foodData.description}`);
          const tip = this.createTipFromFood(foodData, food.category, food.tipType);
          
          if (tip) {
            tips.push(tip);
            console.log(`✅ Created tip: ${tip.title}`);
          } else {
            console.log(`⚠️ Failed to create tip for ${foodData.description}`);
          }
        } else {
          console.log(`❌ No food found for search: ${food.search}`);
        }
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('❌ Error generating nutrition tips:', error);
      throw error; // Re-throw to propagate the error
    }

    console.log(`✅ Generated ${tips.length} nutrition tips from USDA data`);
    return tips;
  }

  // Create a nutrition tip from USDA food data
  private createTipFromFood(food: USDAFood, category: string, tipType?: string): NutritionTip | null {
    try {
      // Find key nutrients
      const nutrients = food.foodNutrients || [];
      const keyNutrients = nutrients.filter(n => 
        ['Protein', 'Fiber', 'Vitamin C', 'Iron', 'Calcium', 'Potassium', 'Vitamin A', 'Vitamin E', 'Vitamin K', 'Folate', 'Magnesium', 'Zinc'].some(key => 
          n.nutrientName.includes(key)
        )
      );

      if (keyNutrients.length === 0) {
        return null;
      }

      // Generate enhanced tip content based on tipType and nutrients
      const nutrientNames = keyNutrients.map(n => n.nutrientName.split(',')[0]).slice(0, 3);
      const foodName = food.description.toLowerCase().replace(/,.*/, ''); // Clean up description

      const { title, content } = this.generateTipContent(foodName, nutrientNames, tipType);

      const tip: NutritionTip = {
        id: `usda-${food.fdcId}`,
        title,
        content,
        category,
        source: 'USDA',
        foodData: food,
        nutrients: nutrientNames
      };

      return tip;
    } catch (error) {
      console.error('Error creating tip from food data:', error);
      return null;
    }
  }

  // Generate enhanced tip content based on food type and nutrients
  private generateTipContent(foodName: string, nutrients: string[], tipType?: string): { title: string; content: string } {
    const capitalizedFood = this.capitalize(foodName);
    
    // Enhanced content based on tip type
    const tipTemplates: Record<string, { title: string; content: string }> = {
      'iron-rich': {
        title: `💪 Power Up with Iron-Rich ${capitalizedFood}`,
        content: `${capitalizedFood} is an excellent source of iron and ${nutrients.slice(1).join(', ')}. Iron helps carry oxygen throughout your body, fighting fatigue and boosting energy levels. Perfect for maintaining healthy blood and preventing anemia.`
      },
      'vitamin-c': {
        title: `🍊 Boost Your Immunity with ${capitalizedFood}`,
        content: `${capitalizedFood} is loaded with vitamin C and ${nutrients.slice(1).join(', ')}. Vitamin C strengthens your immune system, helps your body absorb iron, and supports healthy skin. One serving can provide your daily vitamin C needs!`
      },
      'omega-3': {
        title: `🧠 Brain Food: ${capitalizedFood} for Mental Health`,
        content: `${capitalizedFood} contains omega-3 fatty acids plus ${nutrients.join(', ')}. These healthy fats support brain function, reduce inflammation, and promote heart health. Include this superfood 2-3 times per week for optimal benefits.`
      },
      'antioxidants': {
        title: `🌟 Fight Aging with Antioxidant-Rich ${capitalizedFood}`,
        content: `${capitalizedFood} is packed with antioxidants and ${nutrients.join(', ')}. These powerful compounds protect your cells from damage, reduce inflammation, and may help prevent chronic diseases. A colorful addition to any healthy diet!`
      },
      'probiotics': {
        title: `🦠 Support Your Gut Health with ${capitalizedFood}`,
        content: `${capitalizedFood} contains beneficial probiotics and ${nutrients.join(', ')}. These good bacteria support digestive health, boost immunity, and may improve mood. Choose varieties with live active cultures for maximum benefits.`
      },
      'calcium': {
        title: `🦴 Build Strong Bones with ${capitalizedFood}`,
        content: `${capitalizedFood} is rich in calcium and ${nutrients.slice(1).join(', ')}. Calcium is essential for strong bones and teeth, muscle function, and nerve signaling. Pair with vitamin D for better absorption.`
      },
      'fiber': {
        title: `🌾 Improve Digestion with Fiber-Rich ${capitalizedFood}`,
        content: `${capitalizedFood} provides excellent fiber content plus ${nutrients.slice(1).join(', ')}. Fiber promotes healthy digestion, helps control blood sugar, and keeps you feeling full longer. Aim for 25-35g of fiber daily!`
      },
      'potassium': {
        title: `❤️ Heart-Healthy ${capitalizedFood} for Blood Pressure`,
        content: `${capitalizedFood} is high in potassium and ${nutrients.slice(1).join(', ')}. Potassium helps regulate blood pressure, supports proper muscle and nerve function, and may reduce the risk of stroke and kidney stones.`
      }
    };

    // Use specific template if available, otherwise use default
    if (tipType && tipTemplates[tipType]) {
      return tipTemplates[tipType];
    }

    // Default template
    return {
      title: `🥗 Discover the Benefits of ${capitalizedFood}`,
      content: `${capitalizedFood} is a nutritional powerhouse containing ${nutrients.join(', ')}. This wholesome food supports your overall health and wellbeing. Try incorporating it into your meals for a delicious and nutritious boost!`
    };
  }

  // Helper function to capitalize first letter
  private capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Get nutrition tips for specific category
  async getTipsForCategory(category: string): Promise<NutritionTip[]> {
    const categoryFoods: Record<string, Array<{search: string; tipType: string}>> = {
      'Nutrition': [
        { search: 'spinach raw', tipType: 'iron-rich' },
        { search: 'salmon cooked', tipType: 'omega-3' },
        { search: 'quinoa cooked', tipType: 'complete-protein' }
      ],
      'Exercise': [
        { search: 'banana raw', tipType: 'potassium' },
        { search: 'oats raw', tipType: 'beta-glucan' },
        { search: 'chicken breast', tipType: 'lean-protein' }
      ],
      'Weight Management': [
        { search: 'apple raw', tipType: 'fiber' },
        { search: 'cucumber raw', tipType: 'low-calorie' },
        { search: 'greek yogurt plain', tipType: 'probiotics' }
      ],
      'Heart Health': [
        { search: 'walnuts raw', tipType: 'omega-3' },
        { search: 'olive oil extra virgin', tipType: 'heart-healthy' },
        { search: 'avocado raw', tipType: 'monounsaturated' }
      ],
      'Brain Health': [
        { search: 'blueberries raw', tipType: 'antioxidants' },
        { search: 'salmon cooked', tipType: 'omega-3' },
        { search: 'walnuts raw', tipType: 'omega-3' }
      ]
    };

    const foods = categoryFoods[category] || categoryFoods['Nutrition'];
    const tips: NutritionTip[] = [];

    try {
      for (const food of foods) {
        const searchResult = await this.searchFoods(food.search, 1);
        
        if (searchResult && searchResult.foods.length > 0) {
          const tip = this.createTipFromFood(searchResult.foods[0], category, food.tipType);
          if (tip) {
            tips.push(tip);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error getting tips for category ${category}:`, error);
    }

    return tips;
  }
}

// Export singleton instance
export const usdaApi = new USDAApiService();
