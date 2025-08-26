// GNews API Service for Dynamic Health Articles
// Provides real-time health news from 60,000+ global sources

const GNEWS_BASE_URL = import.meta.env.VITE_GNEWS_API_BASE_URL || 'https://gnews.io/api/v4';
const GNEWS_API_KEY = import.meta.env.VITE_GNEWS_API_KEY;

export interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

export interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

export interface HealthArticle {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  author: string;
  readTime: string;
  publishDate: string;
  tags: string[];
  category: "nutrition" | "exercise" | "sleep" | "prevention" | "mental-health" | "general"; // Required by Tips component
  imageUrl?: string;
  sourceUrl?: string;
  source?: string;
}

class GNewsApiService {
  // Fetch health articles from GNews
  async fetchHealthArticles(limit: number = 10): Promise<HealthArticle[]> {
    console.log('🚀 GNews fetchHealthArticles called with limit:', limit);
    console.log('🔑 GNEWS_API_KEY available:', !!GNEWS_API_KEY);
    console.log('🔗 GNEWS_BASE_URL:', GNEWS_BASE_URL);
    
    if (!GNEWS_API_KEY) {
      console.error('❌ GNews API key not found - using fallback articles');
      return this.getFallbackArticles().slice(0, limit);
    }

    try {
      const params = new URLSearchParams({
        token: GNEWS_API_KEY,
        q: 'health', // Simplified query that we know works
        lang: 'en',
        country: 'us',
        max: Math.min(limit, 10).toString() // Removed expand for now
      });
      console.log('📝 Query params:', params.toString());

      console.log('🔍 Fetching health articles from GNews...');
      console.log('🔗 GNews URL:', `${GNEWS_BASE_URL}/search?${params}`);
      console.log('🔑 API Key present:', !!GNEWS_API_KEY);
      
      const response = await fetch(`${GNEWS_BASE_URL}/search?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ GNews API Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        if (response.status === 401) {
          console.error('❌ GNews API: Invalid API key - using fallback articles');
          return this.getFallbackArticles().slice(0, limit);
        } else if (response.status === 429) {
          console.error('❌ GNews API: Rate limit exceeded (100/day) - using fallback articles');
          console.log('💡 To get real articles, wait for rate limit reset or upgrade GNews plan');
          return this.getFallbackArticles().slice(0, limit);
        } else if (response.status === 403) {
          console.error('❌ GNews API: Forbidden (403) - check API key permissions - using fallback articles');
          return this.getFallbackArticles().slice(0, limit);
        }
        console.error('❌ GNews API error:', response.status, response.statusText, '- using fallback articles');
        return this.getFallbackArticles().slice(0, limit);
      }

      const data: GNewsResponse = await response.json();
      console.log('🔍 GNews API Raw Response:', data);
      console.log(`✅ Found ${data.totalArticles} health articles from GNews`);
      console.log('📰 Articles array:', data.articles);
      
      // Convert GNews articles to our HealthArticle format
      const healthArticles: HealthArticle[] = data.articles.map((article, index) => {
        const tags = this.extractTags(article.title, article.description);
        const category = this.determineCategory(tags, article.title, article.description);
        
        return {
          id: `gnews-${Date.now()}-${index}`,
          title: article.title,
          content: this.formatArticleContent(article.content, article.description),
          excerpt: article.description || article.content.substring(0, 200) + '...',
          author: article.source.name,
          readTime: this.estimateReadTime(article.content),
          publishDate: new Date(article.publishedAt).toLocaleDateString(),
          tags,
          category, // Auto-assigned based on content analysis
          imageUrl: article.image,
          sourceUrl: article.url,
          source: 'GNews'
        };
      });

      console.log('✅ Successfully processed articles:', healthArticles.length);
      return healthArticles;
    } catch (error) {
      console.error('❌ Error fetching health articles from GNews:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }

  // Fetch latest health news (shorter articles)
  async fetchHealthNews(limit: number = 5): Promise<HealthArticle[]> {
    if (!GNEWS_API_KEY) {
      console.error('❌ GNews API key not found');
      return [];
    }

    try {
      const params = new URLSearchParams({
        token: GNEWS_API_KEY,
        q: 'health news OR medical breakthrough OR wellness tips', // More news-focused keywords
        lang: 'en',
        country: 'us',
        max: Math.min(limit, 10).toString(),
        sortby: 'publishedAt' // Get latest news first
      });

      console.log('📰 Fetching latest health news from GNews...');
      
      const response = await fetch(`${GNEWS_BASE_URL}/search?${params}`);
      
      if (!response.ok) {
        console.error('❌ GNews API error:', response.status, response.statusText);
        return [];
      }

      const data: GNewsResponse = await response.json();
      console.log(`✅ Found ${data.totalArticles} health news articles`);
      
      // Convert to our format
      const healthNews: HealthArticle[] = data.articles.map((article, index) => {
        const tags = [...this.extractTags(article.title, article.description), 'news'];
        const category = this.determineCategory(tags, article.title, article.description);
        
        return {
          id: `gnews-news-${Date.now()}-${index}`,
          title: article.title,
          content: this.formatArticleContent(article.content, article.description),
          excerpt: article.description || article.content.substring(0, 150) + '...',
          author: article.source.name,
          readTime: this.estimateReadTime(article.content),
          publishDate: new Date(article.publishedAt).toLocaleDateString(),
          tags,
          category,
          imageUrl: article.image,
          sourceUrl: article.url,
          source: 'GNews'
        };
      });

      return healthNews;
    } catch (error) {
      console.error('Error fetching health news from GNews:', error);
      return [];
    }
  }

  // Format article content for better display
  private formatArticleContent(content: string, description: string): string {
    if (!content || content.length < 100) {
      // If content is too short, use description as content
      return description || 'Content not available. Click source link to read full article.';
    }

    // Clean up content
    let formattedContent = content;
    
    // Remove common artifacts
    formattedContent = formattedContent.replace(/\[.*?\]/g, ''); // Remove [+123 chars]
    formattedContent = formattedContent.replace(/…$/, ''); // Remove trailing ellipsis
    
    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(formattedContent.trim())) {
      formattedContent += '...';
    }

    return formattedContent;
  }

  // Estimate reading time based on content length
  private estimateReadTime(content: string): string {
    const wordsPerMinute = 200;
    const wordCount = content.split(' ').length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return minutes <= 1 ? '1 min read' : `${minutes} min read`;
  }

  // Extract relevant tags from title and description
  private extractTags(title: string, description: string): string[] {
    const text = `${title} ${description}`.toLowerCase();
    const healthTags: string[] = [];

    // Health-related keywords to look for
    const tagKeywords = {
      'nutrition': ['nutrition', 'diet', 'food', 'vitamin', 'supplement'],
      'fitness': ['fitness', 'exercise', 'workout', 'physical', 'activity'],
      'mental-health': ['mental', 'stress', 'anxiety', 'depression', 'wellness'],
      'heart-health': ['heart', 'cardiac', 'cardiovascular', 'blood pressure'],
      'weight-management': ['weight', 'obesity', 'overweight', 'bmi'],
      'sleep': ['sleep', 'insomnia', 'rest', 'tired', 'fatigue'],
      'prevention': ['prevent', 'prevention', 'avoid', 'reduce risk'],
      'research': ['study', 'research', 'scientists', 'clinical trial']
    };

    Object.entries(tagKeywords).forEach(([tag, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        healthTags.push(tag);
      }
    });

    // Always include 'health' as a base tag
    if (!healthTags.includes('health')) {
      healthTags.unshift('health');
    }

    return healthTags.slice(0, 4); // Limit to 4 tags
  }

  // Determine article category based on content analysis
  private determineCategory(tags: string[], title: string, description: string): "nutrition" | "exercise" | "sleep" | "prevention" | "mental-health" | "general" {
    const text = `${title} ${description}`.toLowerCase();

    // Priority mapping - more specific categories first
    if (tags.includes('nutrition') || text.includes('diet') || text.includes('food')) {
      return 'nutrition';
    }
    if (tags.includes('fitness') || tags.includes('exercise') || text.includes('workout')) {
      return 'exercise';
    }
    if (tags.includes('mental-health') || text.includes('mental') || text.includes('stress')) {
      return 'mental-health';
    }
    if (tags.includes('sleep') || text.includes('sleep')) {
      return 'sleep';
    }
    if (tags.includes('prevention') || text.includes('prevent')) {
      return 'prevention';
    }

    // Default to general health
    return 'general';
  }

  // Fallback articles when API is rate limited
  private getFallbackArticles(): HealthArticle[] {
    console.log('📰 Using enhanced fallback health articles with real URLs');
    return [
      {
        id: 'fallback-1',
        title: 'The Science Behind Hydration: Why Water is Your Best Friend',
        content: 'Water makes up about 60% of the adult human body, and every single cell, tissue, and organ depends on it to function properly. Staying hydrated is crucial for brain function, physical performance, and temperature regulation. The general recommendation of 8 glasses per day is a starting point, but individual needs vary based on activity level, climate, and overall health.',
        excerpt: 'Discover the fascinating ways water impacts every system in your body and learn evidence-based strategies for optimal hydration.',
        author: 'WebMD',
        readTime: '5 min read',
        publishDate: new Date().toLocaleDateString(),
        tags: ['hydration', 'wellness', 'health'],
        category: 'general',
        sourceUrl: 'https://www.webmd.com/diet/features/water-for-weight-loss-diet', // Real WebMD article about hydration
        source: 'WebMD'
      },
      {
        id: 'fallback-2',
        title: 'Building Healthy Sleep Habits: A Complete Guide',
        content: 'Quality sleep is not a luxury—it\'s a biological necessity. During sleep, your body repairs tissues, consolidates memories, and releases important hormones. Creating a sleep sanctuary with optimal temperature (60-67°F), darkness, and quiet environment can significantly improve sleep quality. Establishing consistent bedtime routines and avoiding screens before bed are key strategies.',
        excerpt: 'Transform your sleep quality with science-backed strategies for better rest, recovery, and overall health.',
        author: 'Mayo Clinic',
        readTime: '7 min read',
        publishDate: new Date().toLocaleDateString(),
        tags: ['sleep', 'recovery', 'wellness'],
        category: 'sleep',
        sourceUrl: 'https://www.mayoclinic.org/healthy-lifestyle/adult-health/in-depth/sleep/art-20048379', // Real Mayo Clinic sleep article
        source: 'Mayo Clinic'
      },
      {
        id: 'fallback-3',
        title: 'Mindful Eating: Transform Your Relationship with Food',
        content: 'Mindful eating is about being fully present during meals, paying attention to the sensory experience of eating, and listening to your body\'s hunger and fullness cues. This practice can improve digestion, reduce overeating, and enhance meal satisfaction. Key strategies include eating slowly, removing distractions, and expressing gratitude for your food.',
        excerpt: 'Learn how mindful eating can improve digestion, reduce overeating, and enhance your overall enjoyment of meals.',
        author: 'Harvard Health',
        readTime: '6 min read',
        publishDate: new Date().toLocaleDateString(),
        tags: ['nutrition', 'mindfulness', 'wellness'],
        category: 'nutrition',
        sourceUrl: 'https://www.health.harvard.edu/staying-healthy/mindful-eating', // Real Harvard Health mindful eating article
        source: 'Harvard Health'
      },
      {
        id: 'fallback-4',
        title: 'The Mental Health Benefits of Regular Exercise',
        content: 'Exercise is one of the most effective ways to improve mental health. Regular physical activity can reduce symptoms of depression and anxiety, boost self-esteem, and improve cognitive function. Even moderate exercise like a 30-minute walk can trigger the release of endorphins, often called "feel-good" chemicals. The key is finding activities you enjoy and building them into your routine.',
        excerpt: 'Discover how regular physical activity can boost mood, reduce stress, and improve overall mental wellbeing.',
        author: 'Health Line',
        readTime: '8 min read',
        publishDate: new Date().toLocaleDateString(),
        tags: ['exercise', 'mental-health', 'wellness'],
        category: 'exercise',
        sourceUrl: 'https://www.healthline.com/health/mental-health/exercise-depression', // Real Healthline mental health exercise article
        source: 'Health Line'
      }
    ];
  }

  // Get API usage info
  getApiInfo(): { dailyLimit: number; source: string } {
    return {
      dailyLimit: 100,
      source: 'GNews.io - Global Health News'
    };
  }
}

// Export singleton instance
export const gnewsApi = new GNewsApiService();
