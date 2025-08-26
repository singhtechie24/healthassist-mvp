// Firebase storage for conversations with cost optimization
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Conversation, ConversationMeta } from '../types/conversation';
import { CONTEXT_LIMITS } from '../types/conversation';

export class ConversationStorage {
  private static instance: ConversationStorage;
  
  static getInstance(): ConversationStorage {
    if (!ConversationStorage.instance) {
      ConversationStorage.instance = new ConversationStorage();
    }
    return ConversationStorage.instance;
  }

  // Get user's conversations collection reference
  private getUserConversationsRef(userId: string) {
    return collection(db, 'users', userId, 'conversations');
  }

  // Save conversation to Firebase
  async saveConversation(userId: string, conversation: Conversation): Promise<void> {
    try {
      const conversationRef = doc(this.getUserConversationsRef(userId), conversation.id);
      
      // Convert conversation for Firestore (handle Date objects)
      const firestoreData = {
        ...conversation,
        createdAt: Timestamp.fromDate(conversation.createdAt),
        lastActive: Timestamp.fromDate(conversation.lastActive),
        recentMessages: conversation.recentMessages.map(msg => ({
          ...msg,
          timestamp: Timestamp.fromDate(msg.timestamp)
        }))
      };
      
      await setDoc(conversationRef, firestoreData);
      console.log('💾 Conversation saved to Firebase');
    } catch (error) {
      console.error('❌ Failed to save conversation:', error);
      throw error;
    }
  }

  // Load specific conversation
  async loadConversation(userId: string, conversationId: string): Promise<Conversation | null> {
    try {
      const conversationRef = doc(this.getUserConversationsRef(userId), conversationId);
      const docSnap = await getDoc(conversationRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      
      // Convert Firestore data back to conversation
      return {
        ...data,
        createdAt: data.createdAt.toDate(),
        lastActive: data.lastActive.toDate(),
        recentMessages: data.recentMessages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp.toDate()
        }))
      } as Conversation;
    } catch (error) {
      console.error('❌ Failed to load conversation:', error);
      return null;
    }
  }

  // Load all user conversations (ordered by last active)
  async loadUserConversations(userId: string): Promise<Conversation[]> {
    try {
      const conversationsRef = this.getUserConversationsRef(userId);
      const q = query(
        conversationsRef, 
        orderBy('lastActive', 'desc'),
        limit(CONTEXT_LIMITS.MAX_CONVERSATIONS)
      );
      
      const querySnapshot = await getDocs(q);
      const conversations: Conversation[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        conversations.push({
          ...data,
          createdAt: data.createdAt.toDate(),
          lastActive: data.lastActive.toDate(),
          recentMessages: data.recentMessages.map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp.toDate()
          }))
        } as Conversation);
      });
      
      console.log(`📚 Loaded ${conversations.length} conversations from Firebase`);
      return conversations;
    } catch (error) {
      console.error('❌ Failed to load conversations:', error);
      return [];
    }
  }

  // Delete conversation
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    try {
      const conversationRef = doc(this.getUserConversationsRef(userId), conversationId);
      await deleteDoc(conversationRef);
      console.log('🗑️ Conversation deleted from Firebase');
    } catch (error) {
      console.error('❌ Failed to delete conversation:', error);
      throw error;
    }
  }

  // Cleanup old conversations (cost optimization)
  async cleanupOldConversations(userId: string): Promise<void> {
    try {
      const conversations = await this.loadUserConversations(userId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - CONTEXT_LIMITS.AUTO_DELETE_DAYS);
      
      const toDelete = conversations.filter(conv => conv.lastActive < cutoffDate);
      
      for (const conversation of toDelete) {
        await this.deleteConversation(userId, conversation.id);
      }
      
      if (toDelete.length > 0) {
        console.log(`🧹 Cleaned up ${toDelete.length} old conversations`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup conversations:', error);
    }
  }

  // Save user metadata (usage tracking)
  async saveUserMeta(userId: string, meta: ConversationMeta): Promise<void> {
    try {
      const metaRef = doc(db, 'users', userId, 'meta', 'conversations');
      
      const firestoreData = {
        ...meta,
        lastCleanup: Timestamp.fromDate(meta.lastCleanup)
      };
      
      await setDoc(metaRef, firestoreData);
    } catch (error) {
      console.error('❌ Failed to save user meta:', error);
    }
  }

  // Load user metadata
  async loadUserMeta(userId: string): Promise<ConversationMeta | null> {
    try {
      const metaRef = doc(db, 'users', userId, 'meta', 'conversations');
      const docSnap = await getDoc(metaRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        ...data,
        lastCleanup: data.lastCleanup.toDate()
      } as ConversationMeta;
    } catch (error) {
      console.error('❌ Failed to load user meta:', error);
      return null;
    }
  }
}

export const conversationStorage = ConversationStorage.getInstance();
