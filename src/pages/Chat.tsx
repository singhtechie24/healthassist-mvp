import { useState, useEffect, useRef } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import RealtimeVoiceChat from '../components/RealtimeVoiceChat';
import ConversationSidebar from '../components/ConversationSidebar';
import MessageReactions from '../components/MessageReactions';
import ProgressChatWidget from '../components/ProgressChatWidget';
import MemoryIndicator from '../components/MemoryIndicator';
import { shouldTriggerProgress } from '../utils/progressHelpers';
import { conversationManager } from '../services/conversationManager';
import { conversationStorage } from '../services/conversationStorage';
import { SmartPrompts } from '../services/smartPrompts';
import { DynamicHealthAI } from '../services/dynamicHealthAI';
import { AdaptiveLearning } from '../services/adaptiveLearning';
import { HealthSafeguards } from '../services/healthSafeguards';
import { ContextualMemory, type MemoryContext } from '../services/contextualMemory';
import type { ReactionType } from '../services/messageReactions';
import type { Conversation, Message } from '../types/conversation';
import type { UserProfile } from '../services/healthAssessment';

export default function Chat() {
  // Conversation management
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default open
  
  // User profile for personalization
  const [userProfile] = useState<UserProfile>({});
  
  // Legacy states for backward compatibility
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatCount, setChatCount] = useState(() => {
    return parseInt(localStorage.getItem('healthassist_chat_count') || '0');
  });
  const [user, setUser] = useState<User | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<'text' | 'realtime'>('text');
  
  // Refs for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Progress visualization state
  const [showProgress, setShowProgress] = useState(false);
  
  // Contextual memory state
  const [memoryContext, setMemoryContext] = useState<MemoryContext | null>(null);
  const [showMemoryIndicator, setShowMemoryIndicator] = useState(false);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadUserConversations(currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load user conversations from Firebase
  const loadUserConversations = async (userId: string) => {
    try {
      const userConversations = await conversationStorage.loadUserConversations(userId);
      setConversations(userConversations);
      
      // If no current conversation, create a new one or load the most recent
      if (!currentConversation && userConversations.length > 0) {
        const mostRecent = userConversations[0];
        setCurrentConversation(mostRecent);
        setMessages(mostRecent.recentMessages);
      } else if (!currentConversation) {
        // Create new conversation for new users
        createNewConversation(userId);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

     // Create a new conversation
   const createNewConversation = async (userId: string, firstMessage?: string) => {
     const newConversation = conversationManager.createNewConversation(userId, firstMessage);
    
    // Add welcome message
    const welcomeMessage: Message = {
      id: '1',
      text: "Hello! I'm your AI health assistant. I can help you understand symptoms and provide guidance on when to seek care. How can I help you today?",
      sender: 'ai',
      timestamp: new Date()
    };
    
    newConversation.recentMessages = [welcomeMessage];
    newConversation.totalMessages = 1;
    
    setCurrentConversation(newConversation);
    setMessages([welcomeMessage]);
    setConversations(prev => [newConversation, ...prev]);
    
    // Save to Firebase
    try {
      await conversationStorage.saveConversation(userId, newConversation);
    } catch (error) {
      console.error('Failed to save new conversation:', error);
    }
  };

  // Switch to a different conversation
  const switchConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    setMessages(conversation.recentMessages);
    setSidebarOpen(false); // Close sidebar on mobile
  };

  // Emergency symptom detection
  const detectEmergencySymptoms = (text: string): boolean => {
    const emergencyKeywords = [
      'chest pain', 'can\'t breathe', 'difficulty breathing', 'shortness of breath',
      'severe headache', 'stroke', 'heart attack', 'unconscious', 'severe bleeding',
      'broken bone', 'severe burn', 'poisoning', 'allergic reaction', 'anaphylaxis'
    ];
    
    return emergencyKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  // Simple greeting detection
  const isSimpleGreeting = (text: string): boolean => {
    const greetings = [
      'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
      'howdy', 'sup', 'what\'s up', 'how are you', 'how\'s it going',
      'good day', 'greetings', 'salutations', 'yo', 'hiya'
    ];
    
    const cleanText = text.toLowerCase().trim().replace(/[^\w\s]/g, '');
    return greetings.some(greeting => 
      cleanText === greeting || 
      cleanText.startsWith(greeting + ' ') ||
      cleanText.endsWith(' ' + greeting)
    );
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    
    // PHASE 0: Simple Greeting Check - Skip complex analysis for basic greetings
    if (isSimpleGreeting(inputText)) {
      const greetingResponses = [
        "Hello! I'm your AI health assistant. How can I help you today? 😊",
        "Hi there! I'm here to help with your health and wellness questions. What's on your mind?",
        "Hey! Great to see you! I'm ready to assist with any health-related questions you have.",
        "Hello! I'm your personal health coach. How can I support your wellness journey today?",
        "Hi! I'm here to help you with health advice, nutrition tips, fitness guidance, and more. What would you like to know?"
      ];
      
      const randomResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
      
      const userMessage: Message = {
        id: Date.now().toString(),
        text: inputText,
        sender: 'user',
        timestamp: new Date()
      };
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: randomResponse,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage, aiMessage]);
      setInputText('');
      
      // Save to conversation if user is logged in
      if (user && currentConversation) {
        try {
          let updatedConversation = conversationManager.addMessage(currentConversation, userMessage);
          updatedConversation = conversationManager.addMessage(updatedConversation, aiMessage);
          await conversationStorage.saveConversation(user.uid, updatedConversation);
          
          // Update current conversation state
          setCurrentConversation(updatedConversation);
        } catch (error) {
          console.error('Error saving greeting messages:', error);
        }
      }
      
      return;
    }
    
    // PHASE 1: Progress Check - See if user is requesting progress data
    const isProgressRequest = shouldTriggerProgress(inputText);
    if (isProgressRequest && user) {
      setShowProgress(true);
      
      // Create a special progress message
      const progressMessage: Message = {
        id: Date.now().toString(),
        text: "Here's your health progress dashboard! I've analyzed your recent mood logs and medicine adherence to show your trends and insights.",
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, progressMessage]);
      setInputText('');
      return;
    }

    // PHASE 2: Health Safeguards - Check if query is health-related
    const conversationHistory = (currentConversation?.recentMessages || []).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
    
    const healthAnalysis = await HealthSafeguards.analyzeHealthRelevance(inputText);
    
    const safeguardResponse = HealthSafeguards.generateSafeguardResponse(healthAnalysis);
    
    // Check if this is an emergency that needs immediate attention
    if (healthAnalysis.requiresMedicalAttention) {
      const emergencyMessage: Message = {
        id: Date.now().toString(),
        text: safeguardResponse,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, emergencyMessage]);
      setInputText('');
      return;
    }
    
    // PHASE 3: Emergency Detection (after health relevance check)
    const isEmergency = detectEmergencySymptoms(inputText);
    
    if (isEmergency) {
      const emergencyMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "⚠️ URGENT: These symptoms may require immediate medical attention. Please call emergency services (911) or go to the nearest emergency room right away. Do not delay seeking professional medical care.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, emergencyMessage]);
    }

    setInputText('');
    setIsLoading(true);
    
    // PHASE 4: Contextual Memory Processing
    let currentMemoryContext: MemoryContext | null = null;
    if (user && currentConversation) {
      try {
        // Get relevant memories for current context
        currentMemoryContext = await ContextualMemory.getRelevantMemories(
          user.uid,
          inputText,
          conversationHistory
        );
        
        // Show memory indicator if relevant memories found
        if (currentMemoryContext.relevantMemories.length > 0 || currentMemoryContext.criticalMemories.length > 0) {
          setMemoryContext(currentMemoryContext);
          setShowMemoryIndicator(true);
        }
      } catch (error) {
        console.error('Memory processing failed:', error);
      }
    }

    // Simple OpenAI API call
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please check your .env file.');
    }
    
    try {
      // Use conversation context for better responses
      if (!currentConversation || !user) {
        throw new Error('No active conversation or user session');
      }

             // Add user message to conversation
       const userMessage: Message = {
         id: Date.now().toString(),
         text: inputText,
         sender: 'user',
         timestamp: new Date()
       };

       // Update conversation with new message
       const updatedConversation = conversationManager.addMessage(currentConversation, userMessage);
       
       // Auto-generate title if this is the first user message
       if (updatedConversation.totalMessages === 2 && updatedConversation.title === 'New Conversation') {
         updatedConversation.title = conversationManager.generateTitle(inputText);
       }

      // Phase 3: Adaptive Learning - Learn from conversation patterns
      const adaptedProfile = AdaptiveLearning.adaptUserProfile(
        userProfile,
        updatedConversation.recentMessages,
        user.uid
      );
      
      // Phase 1: Use Dynamic Health AI for intelligent analysis
      console.log('🔍 Starting Dynamic Health AI analysis...');
      const healthContext = await DynamicHealthAI.analyzeHealthContext(
        inputText, 
        updatedConversation.recentMessages, 
        adaptedProfile // Use adapted profile instead of original
      );
      console.log('✅ Health context analyzed:', healthContext);
      
      console.log('🧠 Generating intelligent response...');
      const intelligentResponse = await DynamicHealthAI.generateIntelligentResponse(
        inputText,
        healthContext,
        adaptedProfile, // Use adapted profile
        updatedConversation.recentMessages
      );
      console.log('✅ Intelligent response generated:', intelligentResponse);
      
      // If AI recommends intervention, show intelligent response immediately
      if (intelligentResponse.shouldIntervene && intelligentResponse.response) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: intelligentResponse.response,
          sender: 'ai',
          timestamp: new Date()
        };
        
        // Add the intelligent response to conversation
        const conversationWithAI = conversationManager.addMessage(updatedConversation, aiMessage);
        
        // Update state immediately
        setCurrentConversation(conversationWithAI);
        setMessages(conversationWithAI.recentMessages);
        setConversations(prev => 
          prev.map(conv => conv.id === conversationWithAI.id ? conversationWithAI : conv)
        );
        
        // Phase 3: Track interaction for learning
        AdaptiveLearning.trackInteraction(
          user.uid,
          inputText,
          intelligentResponse.response,
          healthContext.domain
        );

        // Save to Firebase
        try {
          await conversationStorage.saveConversation(user.uid, conversationWithAI);
          console.log('🧠 Dynamic AI Response:', intelligentResponse.reasoning);
        } catch (saveError) {
          console.error('Failed to save AI response:', saveError);
        }
        
        setIsLoading(false);
        return; // Don't call OpenAI API, we provided the intelligent response
      }
      
      // Create API context with enhanced system prompt
      const apiContext = conversationManager.createAPIContext(updatedConversation);
      
      // Replace system prompt with enhanced prompt from Dynamic AI
      if (apiContext.length > 0 && apiContext[0].role === 'system') {
        if (intelligentResponse.systemPromptEnhancement) {
          apiContext[0].content = intelligentResponse.systemPromptEnhancement;
        } else {
          // Fallback to smart prompts for contexts not handled by Dynamic AI
          const smartEnhancement = SmartPrompts.createSystemPrompt(adaptedProfile);
          // Add communication style adaptation
          const communicationStyle = AdaptiveLearning.generatePersonalizedCommunicationStyle(
            user.uid,
            updatedConversation.recentMessages
          );
          apiContext[0].content = smartEnhancement + '\n\nCOMMUNICATION STYLE: ' + communicationStyle;
        }
        
        // PHASE 4: Add Health Context from Safeguards
        if (healthAnalysis.isHealthRelated) {
          apiContext[0].content += '\n\nHEALTH FOCUS CONTEXT: This is a health-related query about ' + healthAnalysis.recommendations.join(', ');
        }
        
        // Add health safety context if needed
        if (healthAnalysis.riskLevel === 'medium' || healthAnalysis.riskLevel === 'high') {
          apiContext[0].content += '\n\nHEALTH SAFETY: ' + safeguardResponse;
        }
        
        // PHASE 5: Add Contextual Memory
        if (currentMemoryContext) {
          const memoryPrompt = ContextualMemory.generateContextualPrompt(currentMemoryContext);
          if (memoryPrompt) {
            apiContext[0].content += memoryPrompt;
          }
        }
      }
      
      // Add current user message to context
      apiContext.push({
        role: 'user',
        content: inputText
      });

      // Calculate token usage
      const { tokens, estimatedCost } = conversationManager.calculateContextCost(apiContext);
      console.log(`📊 API Context: ${tokens} tokens, ~$${estimatedCost.toFixed(6)} cost`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: apiContext,
          max_tokens: 300,
          temperature: 0.7
        })
      });

      const data = await response.json();
      
      // Log response for debugging
      console.log('OpenAI Response:', data);
      console.log('Choices:', data.choices);
      console.log('First choice:', data.choices?.[0]);
      console.log('Message content:', data.choices?.[0]?.message?.content);
      
      if (!response.ok) {
        console.error('OpenAI API Error:', data);
        throw new Error(data.error?.message || 'API request failed');
      }
      
      // Extract content with multiple fallbacks
      let messageContent = data.choices?.[0]?.message?.content || 
                            data.choices?.[0]?.text || 
                            data.message?.content ||
                            "I'm sorry, I couldn't process your request right now. Please try again.";
      
      // PHASE 5: Validate AI response stays health-focused
      const isHealthFocused = await HealthSafeguards.validateResponseHealthFocus(messageContent, inputText);
      
      if (!isHealthFocused) {
        // If response drifted off-topic, provide a gentle redirect
        messageContent = `I'd love to help with that! However, as your health and wellness coach, I'm here to focus specifically on supporting your health journey. 

Let's get back to what I do best - helping you with nutrition, fitness, mental wellness, or any health-related questions you might have! 

What aspect of your health or wellness can I assist you with today? 🌟`;
      }
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: messageContent,
        sender: 'ai',
        timestamp: new Date()
      };

      // Add AI response to conversation
      const finalConversation = conversationManager.addMessage(updatedConversation, aiMessage);
      finalConversation.tokensUsed += tokens;

      // PHASE 6: Extract and save memories from user message
      if (user && finalConversation) {
        try {
          const memoryExtraction = await ContextualMemory.extractMemoriesFromMessage(
            inputText,
            user.uid,
            finalConversation.id,
            userMessage.id,
            conversationHistory
          );
          
          if (memoryExtraction.memories.length > 0) {
            await ContextualMemory.saveMemories(memoryExtraction.memories);
            console.log(`Extracted and saved ${memoryExtraction.memories.length} memories`);
          }
          
          // Update memory references if memories were used
          if (currentMemoryContext) {
            const memoriesToUpdate = [
              ...currentMemoryContext.relevantMemories,
              ...currentMemoryContext.criticalMemories
            ];
            
            memoriesToUpdate.forEach(memory => {
              ContextualMemory.updateMemoryReference(memory.id, user.uid);
            });
          }
        } catch (error) {
          console.error('Memory extraction failed:', error);
        }
      }

      // Update state
      setCurrentConversation(finalConversation);
      setMessages(finalConversation.recentMessages);
      
      // Update conversations list
      setConversations(prev => 
        prev.map(conv => conv.id === finalConversation.id ? finalConversation : conv)
      );

      // Save to Firebase
      try {
        await conversationStorage.saveConversation(user.uid, finalConversation);
        console.log('💾 Conversation saved with context');
      } catch (saveError) {
        console.error('Failed to save conversation:', saveError);
      }
      
      // Count chats for non-logged users only
      if (!user) {
        const newCount = chatCount + 1;
        setChatCount(newCount);
        localStorage.setItem('healthassist_chat_count', newCount.toString());
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('OpenAI API error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting right now. Please check your internet connection and try again.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  // Handle key press in textarea
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle adding reactions to messages
  const handleReactionAdd = async (messageId: string, reactionType: ReactionType, feedback?: string) => {
    if (!currentConversation || !user) return;

    try {
      // Add reaction to conversation
      const updatedConversation = conversationManager.addReaction(
        currentConversation, 
        messageId, 
        reactionType, 
        user.uid, 
        feedback
      );

      // Update local state
      setCurrentConversation(updatedConversation);
      setMessages(updatedConversation.recentMessages);

      // Save to Firebase
      await conversationStorage.saveConversation(user.uid, updatedConversation);
      
      console.log('Reaction added:', reactionType.emoji, feedback ? 'with feedback' : 'quick reaction');
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  // Handle removing reactions from messages
  const handleReactionRemove = async (messageId: string, reactionId: string) => {
    if (!currentConversation || !user) return;

    try {
      // Remove reaction from conversation
      const updatedConversation = conversationManager.removeReaction(
        currentConversation, 
        messageId, 
        reactionId
      );

      // Update local state
      setCurrentConversation(updatedConversation);
      setMessages(updatedConversation.recentMessages);

      // Save to Firebase
      await conversationStorage.saveConversation(user.uid, updatedConversation);
      
      console.log('Reaction removed:', reactionId);
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  // Handle memory invalidation
  const handleMemoryInvalidate = async (memoryId: string, reason: string) => {
    if (!user) return;
    
    try {
      await ContextualMemory.invalidateMemory(memoryId, user.uid, reason);
      
      // Refresh memory context
      if (memoryContext) {
        const updatedMemoryContext = await ContextualMemory.getRelevantMemories(
          user.uid,
          inputText,
          (currentConversation?.recentMessages || []).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        );
        setMemoryContext(updatedMemoryContext);
      }
      
      console.log('Memory invalidated:', memoryId, reason);
    } catch (error) {
      console.error('Failed to invalidate memory:', error);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-950 font-['Manrope',_sans-serif] overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-teal-200/20 dark:bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-100/10 dark:bg-emerald-600/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 flex h-full bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl max-w-7xl mx-auto shadow-2xl shadow-emerald-500/10 border border-white/20 dark:border-gray-700/50">
      {/* Sidebar */}
      <ConversationSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={conversations}
        currentConversation={currentConversation}
        onSelectConversation={switchConversation}
        onNewConversation={() => user && createNewConversation(user.uid)}
        onDeleteConversation={async (conversationId) => {
          if (user) {
            try {
              await conversationStorage.deleteConversation(user.uid, conversationId);
              setConversations(prev => prev.filter(conv => conv.id !== conversationId));
              
              // If deleting current conversation, switch to another or create new
              if (currentConversation?.id === conversationId) {
                const remainingConversations = conversations.filter(conv => conv.id !== conversationId);
                if (remainingConversations.length > 0) {
                  switchConversation(remainingConversations[0]);
                } else {
                  createNewConversation(user.uid);
                }
              }
            } catch (error) {
              console.error('Failed to delete conversation:', error);
            }
          }
        }}
      />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-l border-white/30 dark:border-gray-700/30 h-full overflow-hidden rounded-r-3xl">
          {/* Top Header Bar - Enhanced */}
          <div className="border-b border-emerald-200/50 dark:border-gray-700/50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl px-6 py-4 rounded-tr-3xl">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center">
              {/* Sidebar Toggle - Enhanced */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-4 p-3 rounded-2xl bg-emerald-50 dark:bg-gray-700/50 hover:bg-emerald-100 dark:hover:bg-gray-600/50 transition-all duration-200 border border-emerald-200/50 dark:border-gray-600/50"
                title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              >
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {sidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              
              {/* Logo & Title - Enhanced */}
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">HealthAssist</h1>
                  {currentConversation && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      {currentConversation.title}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Chat Mode Switcher - Enhanced */}
            <div className="flex bg-emerald-50/80 dark:bg-gray-700/50 rounded-2xl p-1 border border-emerald-200/50 dark:border-gray-600/50">
              <button
                onClick={() => setChatMode('text')}
                className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  chatMode === 'text'
                    ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/20 border border-emerald-200/50 dark:border-gray-500/50'
                    : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white/50 dark:hover:bg-gray-600/50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span>💬</span>
                  <span>Text</span>
                </div>
              </button>
              <button
                onClick={() => setChatMode('realtime')}
                className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  chatMode === 'realtime'
                    ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/20 border border-emerald-200/50 dark:border-gray-500/50'
                    : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white/50 dark:hover:bg-gray-600/50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span>🎤</span>
                  <span>Voice</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area or Realtime Chat */}
        {chatMode === 'realtime' ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md">
              <RealtimeVoiceChat 
                disabled={!user && chatCount >= 20}
                onError={(error) => setVoiceError(error)}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
                         {/* Messages List - ChatGPT Style */}
             <div ref={messagesContainerRef} className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
               <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
                {messages.map((message, index) => (
                  <div key={message.id} className="group">
                    {message.sender === 'user' ? (
                      // User Message - Enhanced
                      <div className="flex justify-end">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-3xl px-6 py-4 max-w-2xl shadow-lg shadow-emerald-500/25 border border-emerald-400/20">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{message.text}</p>
                        </div>
                      </div>
                    ) : (
                      // AI Message - Enhanced Professional Style
                      <div className="flex">
                        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mr-4 shadow-lg shadow-emerald-500/25">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">HealthAssist</span>
                            <div className="flex items-center space-x-1">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">AI Health Coach</span>
                            </div>
                          </div>
                          <div className="bg-white/80 dark:bg-gray-700/50 backdrop-blur-sm rounded-3xl px-6 py-4 shadow-lg shadow-gray-500/10 border border-gray-200/50 dark:border-gray-600/30">
                            <p className="text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap font-medium">{message.text}</p>
                          </div>
                           {/* Message Reactions */}
                           {user && (
                             <MessageReactions
                               message={message}
                               onReactionAdd={handleReactionAdd}
                               onReactionRemove={handleReactionRemove}
                               currentUserId={user.uid}
                             />
                           )}
                           
                           {/* Progress Visualization - Show after AI message that mentions progress */}
                           {showProgress && index === messages.length - 1 && user && (
                             <div className="mt-4">
                               <ProgressChatWidget
                                 userId={user.uid}
                                 onProgressUpdate={(metrics) => {
                                   console.log('Progress metrics updated:', metrics);
                                 }}
                               />
                             </div>
                           )}
                         </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Memory Indicator */}
                {showMemoryIndicator && memoryContext && user && (
                  <MemoryIndicator
                    memoryContext={memoryContext}
                    onMemoryInvalidate={handleMemoryInvalidate}
                  />
                )}
                
                {/* Loading indicator */}
                {isLoading && (
                  <div className="group">
                    <div className="flex">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                                             <div className="flex-1 space-y-1">
                         <div className="text-sm text-gray-500 dark:text-gray-400">HealthAssist</div>
                         <div className="flex items-center space-x-2">
                           <div className="flex space-x-1">
                             <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse"></div>
                             <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                             <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                           </div>
                           <span className="text-sm text-gray-500 dark:text-gray-400">Thinking...</span>
                         </div>
                       </div>
                    </div>
                  </div>
                )}
                
                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area - Enhanced Professional Style */}
            <div className="flex-shrink-0 border-t border-emerald-200/50 dark:border-gray-700/50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl px-6 py-6 rounded-br-3xl">
              <div className="max-w-4xl mx-auto">
                <div className="relative">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me about your health, nutrition, fitness, or wellness..."
                    className="w-full resize-none border border-emerald-200/50 dark:border-gray-600/50 rounded-3xl px-6 py-4 pr-16 min-h-[60px] max-h-32 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-300 dark:focus:border-emerald-500 shadow-lg shadow-gray-500/10 transition-all duration-200 font-medium"
                    disabled={isLoading || (!user && chatCount >= 20)}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputText.trim() || (!user && chatCount >= 20)}
                    className="absolute right-3 bottom-3 p-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 disabled:scale-100 disabled:shadow-none"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
                
                {/* Footer Info - Enhanced */}
                <div className="flex items-center justify-between mt-4 px-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">For educational purposes only • Not medical advice</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {user ? (
                      <>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Unlimited Chats</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{chatCount}/20 Free Chats</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Free Chat Limit Reached Message - Enhanced */}
                {!user && chatCount >= 20 && (
                  <div className="mt-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-800/50 rounded-3xl backdrop-blur-sm">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">🎯</span>
                      </div>
                      <div>
                        <p className="text-emerald-800 dark:text-emerald-200 text-sm font-bold">
                          All 20 free chats used!
                        </p>
                        <p className="text-emerald-700 dark:text-emerald-300 text-xs">
                          Unlock unlimited conversations + premium features
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <a 
                        href="/login"
                        className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-3 rounded-2xl text-xs font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-emerald-500/25 text-center"
                      >
                        <span className="relative z-10">Create Account</span>
                      </a>
                      <button 
                        onClick={() => {
                          setChatCount(0);
                          localStorage.setItem('healthassist_chat_count', '0');
                        }}
                        className="bg-white/80 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-2xl text-xs font-semibold hover:bg-white dark:hover:bg-gray-600/50 transition-all duration-200 border border-gray-200/50 dark:border-gray-600/50 backdrop-blur-sm"
                      >
                        Reset (Demo)
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Voice Error Display - Enhanced */}
                {voiceError && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200/50 dark:border-red-800/50 rounded-3xl backdrop-blur-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">⚠️</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-red-800 dark:text-red-200 text-sm font-semibold mb-1">
                          Voice Feature Error
                        </p>
                        <p className="text-red-700 dark:text-red-300 text-xs">
                          {voiceError}
                        </p>
                      </div>
                      <button 
                        onClick={() => setVoiceError(null)}
                        className="bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-700/50 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors duration-200"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
