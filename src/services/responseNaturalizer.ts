// Response Naturalizer - Converts robotic AI responses to human-like conversation
import type { EmotionalContext, EmotionalResponse } from './emotionalIntelligence';

export interface NaturalizationResult {
  naturalizedText: string;
  conversionType: 'emotional_warmth' | 'structural_simplification' | 'personality_injection' | 'conversational_flow';
  confidence: number;
}

export class ResponseNaturalizer {
  
  /**
   * Main function to naturalize AI responses dynamically
   */
  static async naturalizeResponse(
    originalResponse: string,
    emotionalContext: EmotionalContext,
    emotionalResponse: EmotionalResponse,
    userMessage: string
  ): Promise<string> {
    
    const naturalizationPrompt = this.createNaturalizationPrompt(
      originalResponse,
      emotionalContext,
      emotionalResponse,
      userMessage
    );
    
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
          messages: [{ role: 'user', content: naturalizationPrompt }],
          max_tokens: 400,
          temperature: 0.8 // Higher creativity for natural conversation
        })
      });

      const data = await response.json();
      const naturalizedText = data.choices[0].message.content;
      
      // Log the transformation for learning
      console.log('🎭 Response Naturalized:', {
        original: originalResponse.substring(0, 100) + '...',
        naturalized: naturalizedText.substring(0, 100) + '...',
        emotionalContext: emotionalContext.userMood,
        tone: emotionalResponse.tone
      });
      
      return naturalizedText;
      
    } catch (error) {
      console.error('Response naturalization failed:', error);
      return this.fallbackNaturalization(originalResponse, emotionalContext, emotionalResponse);
    }
  }

  /**
   * Create comprehensive naturalization prompt
   */
  private static createNaturalizationPrompt(
    originalResponse: string,
    emotionalContext: EmotionalContext,
    emotionalResponse: EmotionalResponse,
    userMessage: string
  ): string {
    return `Transform this robotic AI response into a natural, human-like conversation from a caring health coach:

ORIGINAL AI RESPONSE:
"${originalResponse}"

USER'S ORIGINAL MESSAGE: "${userMessage}"

EMOTIONAL CONTEXT:
- User Mood: ${emotionalContext.userMood}
- Emotional Need: ${emotionalContext.emotionalNeed}
- Situation: ${emotionalContext.situationType}
- Communication Style: ${emotionalContext.communicationStyle}

DESIRED EMOTIONAL TONE:
- Tone: ${emotionalResponse.tone}
- Expression Style: ${emotionalResponse.emotionalExpression}
- Empathy Level: ${emotionalResponse.empathyLevel}
- Encouragement Type: ${emotionalResponse.encouragementType}
- Personal Touch: ${emotionalResponse.personalTouch}

TRANSFORMATION RULES:
1. REMOVE ROBOTIC ELEMENTS:
   - Eliminate most ** bold formatting ** (use sparingly if at all)
   - Remove ## headers and formal structures
   - Convert numbered lists to natural conversation
   - Remove clinical/technical language

2. ADD HUMAN WARMTH:
   - Use conversational bridges ("You know what?", "I have to say", "Here's what I'm thinking")
   - Add appropriate emotional expressions naturally
   - Include empathy and validation
   - Use inclusive language ("we", "together", "you and me")

3. NATURAL CONVERSATION FLOW:
   - Start with emotional connection
   - Weave questions into natural explanations
   - Use casual, friendly language
   - Add personality and genuine care

4. SITUATIONAL ADAPTATION:
   - Match the user's emotional state
   - Respond to their specific situation type
   - Adapt communication style to their preferences
   - Show understanding of their unique context

EXAMPLE TRANSFORMATION:
ROBOTIC: "**What is your current weight and height?** This will help us understand your BMI."
NATURAL: "I'd love to help you create a plan that really works for you! Can you share your current weight and height? This helps me figure out your BMI so we can set realistic goals together 😊"

Transform the original response following these rules. Make it feel like talking to a genuinely caring health coach who understands the user's emotional state and situation.

RESPOND WITH ONLY THE NATURALIZED TEXT:`;
  }

  /**
   * Fallback naturalization when API fails
   */
  private static fallbackNaturalization(
    originalResponse: string,
    emotionalContext: EmotionalContext,
    emotionalResponse: EmotionalResponse
  ): string {
    
    let naturalized = originalResponse;
    
    // Remove heavy markdown formatting
    naturalized = this.removeRoboticFormatting(naturalized);
    
    // Add emotional opener based on context
    const opener = this.getEmotionalOpener(emotionalContext, emotionalResponse);
    if (opener && !naturalized.toLowerCase().includes(opener.toLowerCase().substring(0, 10))) {
      naturalized = opener + ' ' + naturalized;
    }
    
    // Convert lists to natural conversation
    naturalized = this.convertListsToConversation(naturalized);
    
    // Add conversational elements
    naturalized = this.addConversationalElements(naturalized, emotionalContext);
    
    return naturalized;
  }

  /**
   * Remove robotic markdown formatting
   */
  private static removeRoboticFormatting(text: string): string {
    return text
      // Remove most bold formatting (keep sparingly)
      .replace(/\*\*([^*]+)\*\*/g, (match, content) => {
        // Only keep bold for very important things, convert others to natural emphasis
        if (content.length < 15 && (content.includes('important') || content.includes('note'))) {
          return `**${content}**`;
        }
        return content;
      })
      // Remove headers
      .replace(/#{1,6}\s+/g, '')
      // Clean up extra whitespace
      .replace(/\n\n+/g, '\n\n')
      .trim();
  }

  /**
   * Get appropriate emotional opener
   */
  private static getEmotionalOpener(
    context: EmotionalContext,
    response: EmotionalResponse
  ): string {
    
    const openers = {
      excited: [
        "I absolutely love your enthusiasm!",
        "Your energy is contagious!",
        "I'm so excited to help you with this!"
      ],
      worried: [
        "I totally understand your concerns.",
        "It's completely normal to feel this way.",
        "Let me help ease your mind about this."
      ],
      frustrated: [
        "I hear the frustration in your message.",
        "I can imagine how challenging this has been.",
        "You're not alone in feeling this way."
      ],
      hopeful: [
        "I love your positive attitude!",
        "That hope you're feeling? Hold onto it!",
        "You're already on the right track with that mindset."
      ],
      overwhelmed: [
        "Take a deep breath - we've got this!",
        "Let's break this down into manageable steps.",
        "I know it feels like a lot, but we'll figure it out together."
      ],
      neutral: [
        "I'm genuinely excited to help you!",
        "You've come to the right place!",
        "Let's create something amazing together!"
      ]
    };

    const moodOpeners = openers[context.userMood] || openers.neutral;
    return moodOpeners[Math.floor(Math.random() * moodOpeners.length)];
  }

  /**
   * Convert numbered lists to natural conversation
   */
  private static convertListsToConversation(text: string): string {
    // Convert numbered lists to conversational flow
    return text.replace(/(\d+)\.\s*\*\*([^*]+)\*\*([^0-9]*?)(?=\d+\.|$)/g, (match, num, title, content) => {
      const conversationalPhrases = [
        "Also, I'm curious about",
        "Another thing I'd love to know is",
        "And here's something important -",
        "Oh, and one more thing -"
      ];
      
      const phrase = num === '1' ? "First, I'd love to know about" : 
                   conversationalPhrases[Math.floor(Math.random() * conversationalPhrases.length)];
      
      return `${phrase} ${title.toLowerCase()}${content.trim()}`;
    });
  }

  /**
   * Add conversational elements
   */
  private static addConversationalElements(text: string, context: EmotionalContext): string {
    // Add conversational bridges
    const bridges = [
      "You know what?",
      "Here's the thing -",
      "I have to say,",
      "Between you and me,",
      "The way I see it,"
    ];
    
    // Randomly add bridges to make it more conversational
    if (Math.random() > 0.7 && !text.includes('You know what')) {
      const bridge = bridges[Math.floor(Math.random() * bridges.length)];
      text = bridge + ' ' + text.charAt(0).toLowerCase() + text.slice(1);
    }
    
    // Add encouraging endings based on communication style
    if (context.communicationStyle !== 'brief' && !text.includes('!')) {
      const endings = [
        "I'm here to support you every step of the way! 😊",
        "We're going to figure this out together!",
        "You've got this, and I've got you!",
        "I'm genuinely excited to see what we can accomplish!"
      ];
      
      const ending = endings[Math.floor(Math.random() * endings.length)];
      text += '\n\n' + ending;
    }
    
    return text;
  }

  /**
   * Quick check if response needs naturalization
   */
  static needsNaturalization(response: string): boolean {
    const roboticIndicators = [
      /\*\*[^*]+\*\*/g,  // Bold formatting
      /#{1,6}\s+/g,      // Headers
      /^\d+\.\s+\*\*/m,  // Numbered lists with bold
      /To provide you with/i,
      /Here are.*questions/i,
      /This will help us/i
    ];
    
    return roboticIndicators.some(pattern => pattern.test(response));
  }

  /**
   * Extract key information for learning
   */
  static extractNaturalizationInsights(
    original: string,
    naturalized: string,
    emotionalContext: EmotionalContext
  ): NaturalizationResult {
    
    let conversionType: NaturalizationResult['conversionType'] = 'conversational_flow';
    
    if (original.includes('**') && !naturalized.includes('**')) {
      conversionType = 'structural_simplification';
    } else if (emotionalContext.emotionalNeed === 'empathy' || emotionalContext.emotionalNeed === 'validation') {
      conversionType = 'emotional_warmth';
    } else if (naturalized.includes('😊') || naturalized.includes('!')) {
      conversionType = 'personality_injection';
    }
    
    const confidence = this.calculateNaturalizationConfidence(original, naturalized);
    
    return {
      naturalizedText: naturalized,
      conversionType,
      confidence
    };
  }

  /**
   * Calculate confidence score for naturalization
   */
  private static calculateNaturalizationConfidence(original: string, naturalized: string): number {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence if we removed robotic elements
    if (original.includes('**') && !naturalized.includes('**')) confidence += 0.2;
    if (original.includes('##') && !naturalized.includes('##')) confidence += 0.1;
    if (original.includes('1.') && !naturalized.includes('1.')) confidence += 0.1;
    
    // Higher confidence if we added human elements
    if (naturalized.includes('I') && !original.includes('I')) confidence += 0.1;
    if (naturalized.includes('😊') || naturalized.includes('!')) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
}


