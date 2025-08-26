import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';

export interface HealthMemory {
  id: string;
  userId: string;
  type: MemoryType;
  category: HealthCategory;
  content: string;
  context: string;
  keywords: string[];
  importance: ImportanceLevel;
  confidence: number; // 0-1
  sourceConversationId?: string;
  sourceMessageId?: string;
  createdAt: Date;
  lastReferencedAt?: Date;
  referenceCount: number;
  relatedMemories: string[]; // IDs of related memories
  isValid: boolean; // Can be invalidated if user corrects information
  updatedAt: Date;
}

export type MemoryType = 
  | 'health_condition' 
  | 'medication' 
  | 'allergy' 
  | 'goal' 
  | 'preference' 
  | 'habit'
  | 'symptom'
  | 'measurement'
  | 'appointment'
  | 'lifestyle';

export type HealthCategory = 
  | 'medical'
  | 'nutrition' 
  | 'fitness'
  | 'mental_health'
  | 'medication'
  | 'measurements'
  | 'goals'
  | 'preferences'
  | 'lifestyle'
  | 'emergency';

export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

export interface MemoryContext {
  relevantMemories: HealthMemory[];
  recentMemories: HealthMemory[];
  criticalMemories: HealthMemory[];
  memoryConnections: MemoryConnection[];
  contextSummary: string;
}

export interface MemoryConnection {
  fromMemoryId: string;
  toMemoryId: string;
  connectionType: 'related' | 'contradicts' | 'updates' | 'supports';
  strength: number; // 0-1
}

export interface MemoryExtraction {
  memories: Partial<HealthMemory>[];
  confidence: number;
  reasoning: string;
}

export class ContextualMemory {
  /**
   * Extracts health memories from a conversation message
   */
  static async extractMemoriesFromMessage(
    message: string, 
    userId: string, 
    conversationId: string, 
    messageId: string,
    conversationHistory: Array<{role: string; content: string}> = []
  ): Promise<MemoryExtraction> {
    try {
      // Use AI to extract structured health information
      const extraction = await this.aiExtractMemories(message, conversationHistory);
      
      // Process and structure the extracted memories
      const processedMemories = extraction.memories.map(memory => ({
        ...memory,
        id: this.generateMemoryId(),
        userId,
        sourceConversationId: conversationId,
        sourceMessageId: messageId,
        createdAt: new Date(),
        updatedAt: new Date(),
        referenceCount: 0,
        relatedMemories: [],
        isValid: true,
        keywords: this.extractKeywords(memory.content || ''),
        confidence: extraction.confidence
      }));

      return {
        memories: processedMemories,
        confidence: extraction.confidence,
        reasoning: extraction.reasoning
      };
    } catch (error) {
      console.error('Error extracting memories:', error);
      return {
        memories: [],
        confidence: 0,
        reasoning: 'Failed to extract memories due to error'
      };
    }
  }

  /**
   * Saves memories to Firebase
   */
  static async saveMemories(memories: Partial<HealthMemory>[]): Promise<void> {
    try {
      const savePromises = memories.map(async (memory) => {
        if (!memory.id || !memory.userId) return;
        
        const memoryRef = doc(db, `users/${memory.userId}/memories`, memory.id);
        await setDoc(memoryRef, {
          ...memory,
          createdAt: Timestamp.fromDate(memory.createdAt || new Date()),
          updatedAt: Timestamp.fromDate(memory.updatedAt || new Date()),
          lastReferencedAt: memory.lastReferencedAt ? Timestamp.fromDate(memory.lastReferencedAt) : null
        });
      });

      await Promise.all(savePromises);
    } catch (error) {
      console.error('Error saving memories:', error);
      throw error;
    }
  }

  /**
   * Enhanced memory retrieval with smart filtering and relevance scoring
   */
  static async getRelevantMemories(
    userId: string, 
    currentMessage: string, 
    conversationHistory: Array<{role: string; content: string}> = [],
    limit: number = 10
  ): Promise<MemoryContext> {
    try {
      // Early exit for simple non-health messages to save processing
      if (this.isSimpleNonHealthMessage(currentMessage)) {
        console.log('🚀 Skipping memory retrieval for simple non-health message');
        return {
          relevantMemories: [],
          recentMemories: [],
          criticalMemories: [],
          memoryConnections: [],
          contextSummary: ''
        };
      }

      // Get all user memories with smart filtering
      const allMemories = await this.getUserMemories(userId);
      
      if (allMemories.length === 0) {
        console.log('📝 No memories found for user');
        return {
          relevantMemories: [],
          recentMemories: [],
          criticalMemories: [],
          memoryConnections: [],
          contextSummary: ''
        };
      }

      // Enhanced relevance finding with scoring
      const relevantMemories = await this.findRelevantMemoriesWithScoring(
        allMemories, 
        currentMessage, 
        conversationHistory
      );

      // Smart recent memories (consider importance and recency)
      const recentMemories = allMemories
        .filter(memory => {
          const daysDiff = (new Date().getTime() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          // Include recent OR important memories
          return daysDiff <= 7 || memory.importance === 'critical';
        })
        .sort((a, b) => {
          // Prioritize by importance, then recency
          const importanceScore = (mem: HealthMemory) => {
            switch(mem.importance) {
              case 'critical': return 3;
              case 'high': return 2;
              case 'medium': return 1;
              default: return 0;
            }
          };
          return importanceScore(b) - importanceScore(a) || 
                 b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(0, 3); // Reduced to most important 3

      // Critical memories only
      const criticalMemories = allMemories
        .filter(memory => memory.importance === 'critical')
        .slice(0, 3); // Focus on top critical memories

      // Enhanced memory connections
      const memoryConnections = this.findEnhancedMemoryConnections(
        [...relevantMemories, ...recentMemories, ...criticalMemories]
      );

      // Generate contextual summary only for relevant memories
      let contextSummary = '';
      if (relevantMemories.length > 0) {
        contextSummary = await this.generateContextSummary(
          relevantMemories.slice(0, Math.min(limit, 5)), // Limit for cost
          currentMessage
        );
      }

      return {
        relevantMemories: relevantMemories.slice(0, limit),
        recentMemories,
        criticalMemories,
        memoryConnections,
        contextSummary
      };
    } catch (error) {
      console.error('Error getting relevant memories:', error);
      return {
        relevantMemories: [],
        recentMemories: [],
        criticalMemories: [],
        memoryConnections: [],
        contextSummary: ''
      };
    }
  }

  /**
   * Check if message is simple non-health related (skip heavy processing)
   */
  private static isSimpleNonHealthMessage(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    
    // Greetings and simple responses
    const simplePatterns = [
      /^(hi|hello|hey|thanks?|thank you|ok|okay|yes|no|sure|alright)$/,
      /^(good morning|good afternoon|good evening)$/,
      /^(how are you|what's up|how's it going)$/,
      /^(bye|goodbye|see you|talk to you later)$/
    ];
    
    return simplePatterns.some(pattern => pattern.test(lowerMessage)) ||
           lowerMessage.length < 10; // Very short messages likely non-complex
  }

  /**
   * Enhanced memory relevance finding with scoring algorithm
   */
  private static async findRelevantMemoriesWithScoring(
    memories: HealthMemory[],
    currentMessage: string,
    conversationHistory: Array<{role: string; content: string}>
  ): Promise<HealthMemory[]> {
    const messageKeywords = this.extractKeywords(currentMessage);
    const conversationKeywords = conversationHistory
      .map(msg => this.extractKeywords(msg.content))
      .flat();
    
    const scoredMemories = memories.map(memory => {
      let score = 0;
      
      // Keyword relevance (30% of score)
      const keywordMatches = memory.keywords?.filter(keyword => 
        messageKeywords.includes(keyword) || conversationKeywords.includes(keyword)
      ).length || 0;
      score += (keywordMatches / Math.max(memory.keywords?.length || 1, 1)) * 30;
      
      // Content similarity (40% of score)
      const contentSimilarity = this.calculateContentSimilarity(
        currentMessage, 
        memory.content || ''
      );
      score += contentSimilarity * 40;
      
      // Importance weight (20% of score)
      const importanceWeight = memory.importance === 'critical' ? 20 : 
                               memory.importance === 'high' ? 15 : 
                               memory.importance === 'medium' ? 10 : 5;
      score += importanceWeight;
      
      // Recency bonus (10% of score)
      const daysSinceCreated = (new Date().getTime() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 10 - (daysSinceCreated / 7)); // Decay over weeks
      score += recencyScore;
      
      return { memory, score };
    });
    
    return scoredMemories
      .filter(item => item.score > 10) // Minimum relevance threshold
      .sort((a, b) => b.score - a.score)
      .map(item => item.memory);
  }

  /**
   * Calculate content similarity between two texts
   */
  private static calculateContentSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
  }

  /**
   * Enhanced memory connections with better relationship detection
   */
  private static findEnhancedMemoryConnections(
    memories: HealthMemory[]
  ): MemoryConnection[] {
    const connections: MemoryConnection[] = [];
    
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const mem1 = memories[i];
        const mem2 = memories[j];
        
        // Check for keyword overlap
        const keywordOverlap = mem1.keywords?.filter(keyword => 
          mem2.keywords?.includes(keyword)
        ).length || 0;
        
        if (keywordOverlap > 0) {
          const strength = (keywordOverlap / Math.max(mem1.keywords?.length || 1, mem2.keywords?.length || 1)) * 100;
          connections.push({
            fromMemoryId: mem1.id || '',
            toMemoryId: mem2.id || '',
            connectionType: 'related',
            strength: Math.round(strength)
          });
        }
        
        // Check for category connections
        if (mem1.category === mem2.category && mem1.category) {
          connections.push({
            fromMemoryId: mem1.id || '',
            toMemoryId: mem2.id || '',
            connectionType: 'related',
            strength: 60
          });
        }
      }
    }
    
    return connections
      .filter(conn => conn.strength > 30) // Minimum connection strength
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5); // Top 5 connections
  }

  /**
   * Updates memory reference count and last referenced time
   */
  static async updateMemoryReference(memoryId: string, userId: string): Promise<void> {
    try {
      const memoryRef = doc(db, `users/${userId}/memories`, memoryId);
      const memoryDoc = await getDoc(memoryRef);
      
      if (memoryDoc.exists()) {
        const currentData = memoryDoc.data();
        await setDoc(memoryRef, {
          ...currentData,
          referenceCount: (currentData.referenceCount || 0) + 1,
          lastReferencedAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error updating memory reference:', error);
    }
  }

  /**
   * Generates contextual prompt enhancement for AI
   */
  static generateContextualPrompt(memoryContext: MemoryContext): string {
    if (memoryContext.relevantMemories.length === 0) {
      return '';
    }

    let prompt = '\n\nCONTEXTUAL MEMORY:\n';
    
    // Add critical memories first
    if (memoryContext.criticalMemories.length > 0) {
      prompt += 'CRITICAL HEALTH INFO:\n';
      memoryContext.criticalMemories.forEach(memory => {
        prompt += `- ${memory.type}: ${memory.content}\n`;
      });
    }

    // Add relevant memories
    if (memoryContext.relevantMemories.length > 0) {
      prompt += '\nRELEVANT CONTEXT:\n';
      memoryContext.relevantMemories.forEach(memory => {
        prompt += `- ${memory.content} (${memory.category})\n`;
      });
    }

    // Add context summary
    if (memoryContext.contextSummary) {
      prompt += `\nCONTEXT SUMMARY: ${memoryContext.contextSummary}\n`;
    }

    prompt += '\nUse this contextual information to provide personalized, consistent responses. Reference relevant past information naturally.';
    
    return prompt;
  }

  /**
   * Invalidates a memory (marks as no longer valid)
   */
  static async invalidateMemory(memoryId: string, userId: string, reason: string): Promise<void> {
    try {
      const memoryRef = doc(db, `users/${userId}/memories`, memoryId);
      await setDoc(memoryRef, {
        isValid: false,
        invalidationReason: reason,
        invalidatedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      }, { merge: true });
    } catch (error) {
      console.error('Error invalidating memory:', error);
    }
  }

  /**
   * Private helper methods
   */
  private static async aiExtractMemories(
    message: string, 
    conversationHistory: Array<{role: string; content: string}>
  ): Promise<MemoryExtraction> {
    try {
      const contextHistory = conversationHistory
        .slice(-3)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const extractionPrompt = `You are a health information extraction AI. Extract structured health memories from user messages.

MEMORY TYPES:
- health_condition: Medical conditions, diagnoses
- medication: Medications, dosages, schedules
- allergy: Food allergies, drug allergies, sensitivities
- goal: Health goals, targets, objectives  
- preference: Food preferences, exercise preferences
- habit: Daily routines, habits, behaviors
- symptom: Symptoms, complaints, issues
- measurement: Weight, blood pressure, measurements
- appointment: Doctor visits, medical appointments
- lifestyle: Sleep, work, stress, lifestyle factors

IMPORTANCE LEVELS:
- critical: Life-threatening allergies, serious conditions
- high: Medications, important conditions, goals
- medium: Preferences, habits, measurements
- low: Minor preferences, casual mentions

Context from conversation:
${contextHistory}

Current message: "${message}"

Extract structured health information. Respond in JSON format:
{
  "memories": [
    {
      "type": "memory_type",
      "category": "health_category", 
      "content": "clear, specific description",
      "context": "conversational context",
      "importance": "importance_level"
    }
  ],
  "confidence": 0.8,
  "reasoning": "why these memories were extracted"
}

Only extract clear, specific health information. Don't extract vague or uncertain information.`;

      const response = await this.callOpenAI(extractionPrompt);
      
      // Clean and extract JSON from the response
      const cleanedResponse = this.extractJSON(response);
      return JSON.parse(cleanedResponse);
      
    } catch (error) {
      console.error('AI memory extraction failed:', error);
      return {
        memories: [],
        confidence: 0,
        reasoning: 'AI extraction failed'
      };
    }
  }

  private static async getUserMemories(userId: string): Promise<HealthMemory[]> {
    try {
      const memoriesRef = collection(db, `users/${userId}/memories`);
      const q = query(
        memoriesRef, 
        where('isValid', '==', true),
        orderBy('updatedAt', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const memories: HealthMemory[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        memories.push({
          id: doc.id,
          userId: data.userId,
          type: data.type,
          category: data.category,
          content: data.content,
          context: data.context,
          keywords: data.keywords || [],
          importance: data.importance,
          confidence: data.confidence,
          sourceConversationId: data.sourceConversationId,
          sourceMessageId: data.sourceMessageId,
          createdAt: data.createdAt.toDate(),
          lastReferencedAt: data.lastReferencedAt?.toDate(),
          referenceCount: data.referenceCount || 0,
          relatedMemories: data.relatedMemories || [],
          isValid: data.isValid,
          updatedAt: data.updatedAt.toDate()
        });
      });
      
      return memories;
    } catch (error) {
      console.error('Error getting user memories:', error);
      return [];
    }
  }

  private static async findRelevantMemories(
    memories: HealthMemory[], 
    currentMessage: string, 
    conversationHistory: Array<{role: string; content: string}>
  ): Promise<HealthMemory[]> {
    // Simple keyword matching for now - could be enhanced with semantic similarity
    const messageWords = currentMessage.toLowerCase().split(' ');
    const conversationWords = conversationHistory
      .map(msg => msg.content.toLowerCase())
      .join(' ')
      .split(' ');
    
    const allWords = [...messageWords, ...conversationWords];
    
    const scoredMemories = memories.map(memory => {
      let score = 0;
      
      // Keyword matching
      memory.keywords.forEach(keyword => {
        if (allWords.includes(keyword.toLowerCase())) {
          score += 1;
        }
      });
      
      // Content similarity (basic)
      const memoryWords = memory.content.toLowerCase().split(' ');
      memoryWords.forEach(word => {
        if (allWords.includes(word) && word.length > 3) {
          score += 0.5;
        }
      });
      
      // Boost recent memories
      const daysSinceCreated = (new Date().getTime() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated <= 7) score += 0.5;
      
      // Boost frequently referenced memories
      score += memory.referenceCount * 0.1;
      
      // Boost important memories
      const importanceBoost = {
        'critical': 2,
        'high': 1.5,
        'medium': 1,
        'low': 0.5
      };
      score *= importanceBoost[memory.importance];
      
      return { memory, score };
    });
    
    return scoredMemories
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.memory);
  }

  private static findMemoryConnections(memories: HealthMemory[]): MemoryConnection[] {
    const connections: MemoryConnection[] = [];
    
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const memoryA = memories[i];
        const memoryB = memories[j];
        
        // Find keyword overlaps
        const commonKeywords = memoryA.keywords.filter(keyword => 
          memoryB.keywords.includes(keyword)
        );
        
        if (commonKeywords.length > 0) {
          connections.push({
            fromMemoryId: memoryA.id,
            toMemoryId: memoryB.id,
            connectionType: 'related',
            strength: Math.min(commonKeywords.length / 3, 1)
          });
        }
        
        // Check for updates/contradictions based on content similarity
        if (memoryA.type === memoryB.type && memoryA.category === memoryB.category) {
          const similarity = this.calculateContentSimilarity(memoryA.content, memoryB.content);
          if (similarity > 0.7) {
            connections.push({
              fromMemoryId: memoryA.id,
              toMemoryId: memoryB.id,
              connectionType: memoryA.createdAt > memoryB.createdAt ? 'updates' : 'supports',
              strength: similarity
            });
          }
        }
      }
    }
    
    return connections;
  }

  private static async generateContextSummary(
    relevantMemories: HealthMemory[], 
    currentMessage: string
  ): Promise<string> {
    if (relevantMemories.length === 0) return '';
    
    try {
      const memoryDescriptions = relevantMemories
        .slice(0, 5)
        .map(memory => `${memory.type}: ${memory.content}`)
        .join('; ');
      
      const summaryPrompt = `Summarize the relevant health context for this conversation in 1-2 sentences:

Current message: "${currentMessage}"
Relevant health context: ${memoryDescriptions}

Provide a brief, natural summary of the relevant health background:`;

      return await this.callOpenAI(summaryPrompt);
    } catch (error) {
      console.error('Error generating context summary:', error);
      return '';
    }
  }



  private static extractKeywords(content: string): string[] {
    // Extract meaningful keywords (3+ characters, not common words)
    const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'end', 'few', 'got', 'let', 'put', 'say', 'she', 'too', 'use'];
    
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(' ')
      .filter(word => word.length >= 3 && !commonWords.includes(word))
      .slice(0, 10); // Limit to 10 keywords
  }

  private static generateMemoryId(): string {
    return `memory_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private static extractJSON(text: string): string {
    try {
      // Remove markdown code blocks and common prefixes
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      cleanText = cleanText.replace(/^\*\*\*.*?\*\*\*\n?/gm, ''); // Remove *** markers
      cleanText = cleanText.trim();
      
      // Find JSON object boundaries
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        return cleanText.substring(jsonStart, jsonEnd);
      }
      
      // If no brackets found, return original (might be already clean JSON)
      return cleanText;
    } catch (error) {
      console.warn('JSON extraction failed, returning original text:', error);
      return text;
    }
  }

  private static async callOpenAI(prompt: string): Promise<string> {
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
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}
