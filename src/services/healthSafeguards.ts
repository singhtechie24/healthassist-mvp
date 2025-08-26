export interface HealthSafetyResult {
  isHealthRelated: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  requiresMedicalAttention: boolean;
}

export class HealthSafeguards {
  private static readonly HEALTH_KEYWORDS = [
    'pain', 'ache', 'hurt', 'sick', 'illness', 'disease', 'symptom',
    'medication', 'medicine', 'pill', 'drug', 'treatment', 'therapy',
    'diagnosis', 'doctor', 'hospital', 'emergency', 'ambulance',
    'fever', 'headache', 'nausea', 'vomiting', 'diarrhea', 'constipation',
    'cough', 'cold', 'flu', 'infection', 'injury', 'wound', 'bleeding',
    'heart', 'chest', 'breathing', 'blood pressure', 'diabetes',
    'cancer', 'tumor', 'lump', 'swelling', 'rash', 'allergy'
  ];

  private static readonly CRITICAL_SYMPTOMS = [
    'chest pain', 'difficulty breathing', 'severe bleeding',
    'unconscious', 'seizure', 'stroke symptoms', 'heart attack',
    'severe head injury', 'broken bone', 'poisoning'
  ];

  /**
   * Quick health check using keyword matching
   */
  static quickHealthCheck(message: string): HealthSafetyResult {
    const lowerMessage = message.toLowerCase();
    const foundKeywords = this.HEALTH_KEYWORDS.filter(keyword => 
      lowerMessage.includes(keyword)
    );
    
    const criticalSymptoms = this.CRITICAL_SYMPTOMS.filter(symptom =>
      lowerMessage.includes(symptom)
    );

    const isHealthRelated = foundKeywords.length > 0;
    const hasCriticalSymptoms = criticalSymptoms.length > 0;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let requiresMedicalAttention = false;
    let recommendations: string[] = [];

    if (hasCriticalSymptoms) {
      riskLevel = 'high';
      requiresMedicalAttention = true;
      recommendations = [
        '⚠️ CRITICAL: This appears to involve serious medical symptoms.',
        '🚨 Please seek immediate medical attention.',
        '🆘 Call emergency services if symptoms are severe.',
        '📞 Consider calling your doctor or visiting urgent care.'
      ];
    } else if (foundKeywords.length >= 3) {
      riskLevel = 'medium';
      recommendations = [
        '🏥 This appears to be health-related.',
        '💡 Consider consulting with a healthcare professional.',
        '📋 Keep track of your symptoms and their progression.'
      ];
    } else if (isHealthRelated) {
      riskLevel = 'low';
      recommendations = [
        '💡 This appears to be health-related.',
        '📚 Consider researching reliable health information sources.',
        '🤔 If symptoms persist, consult a healthcare professional.'
      ];
    } else {
      recommendations = ['✅ No immediate health concerns detected.'];
    }

    return {
      isHealthRelated,
      riskLevel,
      recommendations,
      requiresMedicalAttention
    };
  }

  /**
   * Analyze health relevance of a message
   */
  static async analyzeHealthRelevance(message: string): Promise<HealthSafetyResult> {
    return this.quickHealthCheck(message);
  }

  /**
   * AI-powered health analysis for more accurate classification
   */
  static async aiHealthAnalysis(message: string): Promise<HealthSafetyResult> {
    try {
      const prompt = `
        Analyze this message for health-related content and safety concerns.
        
        Message: "${message}"
        
        Classify as:
        1. Health-related (true/false)
        2. Risk level (low/medium/high)
        3. Requires immediate medical attention (true/false)
        4. Key health topics mentioned
        5. Safety recommendations
        
        Respond in JSON format:
        {
          "isHealthRelated": boolean,
          "riskLevel": "low" | "medium" | "high",
          "requiresMedicalAttention": boolean,
          "topics": string[],
          "recommendations": string[]
        }
      `;

      const response = await fetch('/api/analyze-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, prompt })
      });

      if (!response.ok) {
        throw new Error('Health analysis API failed');
      }

      const result = await response.json();
      
      return {
        isHealthRelated: result.isHealthRelated,
        riskLevel: result.riskLevel,
        recommendations: result.recommendations,
        requiresMedicalAttention: result.requiresMedicalAttention
      };
    } catch (error) {
      console.error('AI health analysis failed:', error);
      // Fallback to keyword-based analysis
      return this.quickHealthCheck(message);
    }
  }

  /**
   * Validate health advice against safety guidelines
   */
  static validateHealthAdvice(advice: string): {
    isSafe: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    const lowerAdvice = advice.toLowerCase();
    
    // Check for dangerous advice
    const dangerousPatterns = [
      'stop taking medication',
      'self-diagnose',
      'ignore symptoms',
      'wait and see',
      'home remedy only',
      'avoid doctors',
      'natural cure only'
    ];

    const hasDangerousAdvice = dangerousPatterns.some(pattern =>
      lowerAdvice.includes(pattern)
    );

    if (hasDangerousAdvice) {
      warnings.push('⚠️ This advice may be dangerous or misleading.');
      recommendations.push('🚨 Always consult healthcare professionals for medical decisions.');
    }

    // Check for appropriate disclaimers
    const hasDisclaimers = lowerAdvice.includes('consult') || 
                           lowerAdvice.includes('doctor') ||
                           lowerAdvice.includes('professional') ||
                           lowerAdvice.includes('medical advice');

    if (!hasDisclaimers) {
      warnings.push('⚠️ Missing medical disclaimer.');
      recommendations.push('💡 Include appropriate medical disclaimers.');
    }

    const isSafe = warnings.length === 0;

    return {
      isSafe,
      warnings,
      recommendations
    };
  }

  /**
   * Generate safe health response guidelines
   */
  static generateSafetyGuidelines(): string[] {
    const guidelines = [
      '🏥 Always encourage consulting healthcare professionals for medical concerns',
      '📚 Provide information from reliable sources only',
      '⚠️ Never give specific medical diagnoses or treatment plans',
      '💡 Focus on general health education and wellness tips',
      '🚨 Immediately flag any emergency symptoms',
      '🤝 Support users in making informed health decisions'
    ];

    return guidelines;
  }

  /**
   * Generate safeguard response for health-related messages
   */
  static generateSafeguardResponse(healthAnalysis: HealthSafetyResult): string {
    if (healthAnalysis.requiresMedicalAttention) {
      return `🚨 **EMERGENCY ALERT**: ${healthAnalysis.recommendations.join(' ')}`;
    }
    
    if (healthAnalysis.riskLevel === 'high') {
      return `⚠️ **High Risk**: ${healthAnalysis.recommendations.join(' ')}`;
    }
    
    if (healthAnalysis.riskLevel === 'medium') {
      return `🏥 **Health Advisory**: ${healthAnalysis.recommendations.join(' ')}`;
    }
    
    if (healthAnalysis.isHealthRelated) {
      return `💡 **Health Information**: ${healthAnalysis.recommendations.join(' ')}`;
    }
    
    return '✅ No immediate health concerns detected.';
  }

  /**
   * Emergency symptom detection
   */
  static detectEmergencySymptoms(message: string): {
    hasEmergencySymptoms: boolean;
    symptoms: string[];
    immediateActions: string[];
  } {
    const lowerMessage = message.toLowerCase();
    const foundSymptoms = this.CRITICAL_SYMPTOMS.filter(symptom =>
      lowerMessage.includes(symptom)
    );

    const hasEmergencySymptoms = foundSymptoms.length > 0;

    const immediateActions = hasEmergencySymptoms ? [
      '🚨 EMERGENCY: These symptoms require immediate medical attention',
      '🆘 Call emergency services (911) if symptoms are severe',
      '🏥 Go to the nearest emergency room',
      '📞 Contact your doctor immediately',
      '⏰ Do not wait - seek help now'
    ] : [];

    return {
      hasEmergencySymptoms,
      symptoms: foundSymptoms,
      immediateActions
    };
  }

  /**
   * Validate if a response maintains health focus
   */
  static async validateResponseHealthFocus(response: string, userInput: string): Promise<boolean> {
    const lowerResponse = response.toLowerCase();
    const lowerInput = userInput.toLowerCase();
    
    // Check if response contains health-related keywords
    const hasHealthKeywords = this.HEALTH_KEYWORDS.some(keyword => 
      lowerResponse.includes(keyword)
    );
    
    // Check if response addresses the user's health input
    const addressesUserInput = this.HEALTH_KEYWORDS.some(keyword => 
      lowerInput.includes(keyword) && lowerResponse.includes(keyword)
    );
    
    // Check if response contains medical disclaimers
    const hasDisclaimers = lowerResponse.includes('consult') || 
                           lowerResponse.includes('doctor') ||
                           lowerResponse.includes('professional') ||
                           lowerResponse.includes('medical advice') ||
                           lowerResponse.includes('healthcare provider');
    
    // Response is health-focused if it has health keywords, addresses user input, or has proper disclaimers
    return hasHealthKeywords || addressesUserInput || hasDisclaimers;
  }
}
