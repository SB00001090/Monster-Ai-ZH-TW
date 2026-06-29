import { eq, desc, avg, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, conversations, messages, generatedImages, feedback, modelImprovements, promptOptimizationLog, sdModels, sdGenerations, sdPresets, roles, userRoles, ttsSettings, characters, characterTemplates, characterAnalytics, characterRatings, bugReports, tutorials, tutorialProgress, forumCategories, forumPosts, forumReplies, userMemories, knowledgeBase, temporaryAccounts, InsertFeedback, InsertModelImprovement, InsertPromptOptimizationLog, InsertSDGeneration, InsertSDPreset, InsertRole, InsertUserRole, InsertTTSSetting, Character, InsertCharacter, InsertBugReport, InsertTutorial, InsertForumPost, InsertForumReply, InsertUserMemory, InsertKnowledgeEntry } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: any = null;
let _migrationApplied = false;

async function applyMigrations() {
  if (_migrationApplied || !_pool) return;
  _migrationApplied = true;

  try {
    const connection = await _pool.getConnection();
    try {
      // Check if characters table has the correct columns
      const result = await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'characters' AND TABLE_SCHEMA = DATABASE()"
      );
      const columns = (result[0] as any[]).map((row: any) => row.COLUMN_NAME);
      
      // If averageRating column doesn't exist or is named incorrectly, recreate the tables
      if (!columns.includes('averageRating')) {
        console.log('[Database] Applying migration: fixing characters table column names...');
        
        // Drop dependent tables
        await connection.query('DROP TABLE IF EXISTS `characterAnalytics`');
        await connection.query('DROP TABLE IF EXISTS `characterRatings`');
        await connection.query('DROP TABLE IF EXISTS `characters`');
        
        // Recreate characters table
        await connection.query(`
          CREATE TABLE \`characters\` (
            \`id\` int AUTO_INCREMENT NOT NULL,
            \`userId\` int NOT NULL,
            \`name\` varchar(255) NOT NULL,
            \`description\` text NOT NULL,
            \`worldview\` text NOT NULL,
            \`openingLine\` text NOT NULL,
            \`systemPrompt\` text,
            \`isPublic\` int NOT NULL DEFAULT 0,
            \`averageRating\` int NOT NULL DEFAULT 0,
            \`usageCount\` int NOT NULL DEFAULT 0,
            \`createdAt\` timestamp NOT NULL DEFAULT (now()),
            \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT \`characters_id\` PRIMARY KEY(\`id\`),
            CONSTRAINT \`characters_userId_users_id_fk\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action
          )
        `);
        
        // Recreate characterAnalytics table
        await connection.query(`
          CREATE TABLE \`characterAnalytics\` (
            \`id\` int AUTO_INCREMENT NOT NULL,
            \`characterId\` int NOT NULL,
            \`userId\` int NOT NULL,
            \`conversationCount\` int NOT NULL DEFAULT 0,
            \`messageCount\` int NOT NULL DEFAULT 0,
            \`totalUsageTime\` int NOT NULL DEFAULT 0,
            \`averageRating\` int NOT NULL DEFAULT 0,
            \`lastUsedAt\` timestamp,
            \`createdAt\` timestamp NOT NULL DEFAULT (now()),
            \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT \`characterAnalytics_id\` PRIMARY KEY(\`id\`),
            CONSTRAINT \`characterAnalytics_characterId_characters_id_fk\` FOREIGN KEY (\`characterId\`) REFERENCES \`characters\`(\`id\`) ON DELETE cascade ON UPDATE no action,
            CONSTRAINT \`characterAnalytics_userId_users_id_fk\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action
          )
        `);
        
        // Recreate characterRatings table
        await connection.query(`
          CREATE TABLE \`characterRatings\` (
            \`id\` int AUTO_INCREMENT NOT NULL,
            \`characterId\` int NOT NULL,
            \`userId\` int NOT NULL,
            \`rating\` int NOT NULL,
            \`comment\` text,
            \`createdAt\` timestamp NOT NULL DEFAULT (now()),
            \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT \`characterRatings_id\` PRIMARY KEY(\`id\`),
            CONSTRAINT \`characterRatings_characterId_characters_id_fk\` FOREIGN KEY (\`characterId\`) REFERENCES \`characters\`(\`id\`) ON DELETE cascade ON UPDATE no action,
            CONSTRAINT \`characterRatings_userId_users_id_fk\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action
          )
        `);
        
        console.log('[Database] Migration completed successfully');
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[Database] Migration failed:', error);
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!_pool) {
        // Parse connection string and create pool with explicit options
        const url = new URL(process.env.DATABASE_URL);
        _pool = mysql.createPool({
          host: url.hostname,
          port: parseInt(url.port || '3306', 10),
          user: url.username,
          password: url.password,
          database: url.pathname.slice(1),
          charset: 'utf8mb4',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
          ssl: {} as any,
        });
      }
      _db = drizzle({ client: _pool });
      
      // Apply migrations on first connection
      await applyMigrations();
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function getConversationMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}

export async function createConversation(
  userId: number,
  title: string,
  mode: 'chat' | 'image' = 'chat',
  characterId?: number
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(conversations).values({
    userId,
    title,
    mode,
    ...(characterId ? { characterId } : {}),
  });
  // Drizzle MySQL2 returns { insertId, affectedRows }
  // Extract the insertId for reliable conversation ID
  const insertId = (result as any)?.[0]?.insertId || (result as any)?.insertId;
  if (!insertId) {
    throw new Error('Failed to create conversation: no insertId returned');
  }
  return { id: insertId };
}

export async function addMessage(conversationId: number, role: 'user' | 'assistant', content: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(messages).values({ conversationId, role, content });
  return result;
}

export async function deleteMessage(messageId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.delete(messages).where(eq(messages.id, messageId));
}

export async function saveGeneratedImage(conversationId: number, userId: number, prompt: string, imageUrl: string, imageKey: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.insert(generatedImages).values({ conversationId, userId, prompt, imageUrl, imageKey });
}

export async function getConversationImages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedImages).where(eq(generatedImages.conversationId, conversationId)).orderBy(desc(generatedImages.createdAt));
}

export async function deleteGeneratedImage(imageId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.delete(generatedImages).where(eq(generatedImages.id, imageId));
}

export async function deleteConversation(conversationId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.delete(conversations).where(eq(conversations.id, conversationId));
}

export async function getConversation(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateConversation(
  conversationId: number,
  userId: number,
  data: { characterId?: number; pythonSessionId?: string }
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(conversations)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
}

export async function getUserConversationsEnriched(userId: number) {
  const convs = await getUserConversations(userId);
  const enriched = [];

  for (const conv of convs) {
    const msgs = await getConversationMessages(conv.id);
    const character = conv.characterId
      ? await getCharacterForChat(conv.characterId, userId)
      : undefined;

    enriched.push({
      ...conv,
      messageCount: msgs.length,
      lastMessage: msgs.at(-1)?.content?.slice(0, 100) ?? null,
      character: character
        ? {
            id: character.id,
            name: character.name,
            description: character.description,
            worldview: character.worldview,
            openingLine: character.openingLine,
            avatarUrl: character.avatarUrl ?? null,
            averageRating: character.averageRating,
            usageCount: character.usageCount,
          }
        : null,
    });
  }

  return enriched;
}

export async function incrementCharacterUsage(characterId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!existing[0]) return;
  await db
    .update(characters)
    .set({ usageCount: existing[0].usageCount + 1, updatedAt: new Date() })
    .where(eq(characters.id, characterId));
}

// Feedback and AI Self-Improvement Functions

export async function saveFeedback(feedbackData: InsertFeedback) {
  const db = await getDb();
  if (!db) {
    const { saveMemoryFeedback } = await import("./_core/feedbackStore");
    return saveMemoryFeedback(feedbackData);
  }
  return db.insert(feedback).values(feedbackData);
}

export async function getMessageFeedback(messageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(feedback).where(eq(feedback.messageId, messageId)).orderBy(desc(feedback.createdAt));
}

export async function getUserFeedback(userId: number) {
  const db = await getDb();
  if (!db) {
    const { getMemoryUserFeedback } = await import("./_core/feedbackStore");
    return getMemoryUserFeedback(userId);
  }
  return db.select().from(feedback).where(eq(feedback.userId, userId)).orderBy(desc(feedback.createdAt));
}

export async function getAverageRatingForUser(userId: number) {
  const db = await getDb();
  if (!db) {
    const { getMemoryAverageRating } = await import("./_core/feedbackStore");
    return getMemoryAverageRating(userId);
  }
  const result = await db
    .select({ avgRating: avg(feedback.rating) })
    .from(feedback)
    .where(eq(feedback.userId, userId));
  return result[0]?.avgRating ? Math.round(Number(result[0].avgRating) * 10) / 10 : null;
}

export async function saveModelImprovement(improvementData: InsertModelImprovement) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.insert(modelImprovements).values(improvementData);
}

export async function getUserModelImprovements(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelImprovements).where(eq(modelImprovements.userId, userId)).orderBy(desc(modelImprovements.createdAt));
}

export async function savePromptOptimizationLog(logData: InsertPromptOptimizationLog) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.insert(promptOptimizationLog).values(logData);
}

export async function getUserPromptOptimizations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promptOptimizationLog).where(eq(promptOptimizationLog.userId, userId)).orderBy(desc(promptOptimizationLog.createdAt));
}

export async function getTopImprovements(userId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(modelImprovements)
    .where(eq(modelImprovements.userId, userId))
    .orderBy(desc(modelImprovements.feedbackCount))
    .limit(limit);
}


// ============ Stable Diffusion Model Functions ============

export async function getAvailableSDModels() {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(sdModels)
    .where(eq(sdModels.isActive, 1))
    .orderBy(desc(sdModels.createdAt));
}

export async function getSDModelById(modelId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(sdModels)
    .where(eq(sdModels.id, modelId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function addSDGeneration(data: InsertSDGeneration): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot add SD generation: database not available");
    return;
  }

  try {
    await db.insert(sdGenerations).values(data);
  } catch (error) {
    console.error("[Database] Failed to add SD generation:", error);
    throw error;
  }
}

export async function getUserSDGenerations(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(sdGenerations)
    .where(eq(sdGenerations.userId, userId))
    .orderBy(desc(sdGenerations.createdAt))
    .limit(limit);
}

export async function getConversationSDGenerations(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(sdGenerations)
    .where(eq(sdGenerations.conversationId, conversationId))
    .orderBy(desc(sdGenerations.createdAt));
}

export async function createSDPreset(data: InsertSDPreset): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create SD preset: database not available");
    return;
  }

  try {
    await db.insert(sdPresets).values(data);
  } catch (error) {
    console.error("[Database] Failed to create SD preset:", error);
    throw error;
  }
}

export async function getUserSDPresets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(sdPresets)
    .where(eq(sdPresets.userId, userId))
    .orderBy(desc(sdPresets.createdAt));
}

export async function getDefaultSDPreset(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(sdPresets)
    .where(and(eq(sdPresets.userId, userId), eq(sdPresets.isDefault, 1)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}


// Role-Playing Functions

export async function getAvailableRoles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(roles).where(eq(roles.isPreset, 1)).orderBy(roles.roleName);
}

export async function getUserRoles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userRoles).where(eq(userRoles.userId, userId));
}

export async function createCustomRole(roleData: InsertRole) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.insert(roles).values(roleData);
}

export async function setActiveRole(userId: number, roleId: number, conversationId?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Deactivate other roles for this conversation
  if (conversationId) {
    await db.update(userRoles)
      .set({ isActive: 0 })
      .where(and(eq(userRoles.userId, userId), eq(userRoles.conversationId, conversationId)));
  }
  
  // Set the new active role
  return db.insert(userRoles).values({
    userId,
    roleId,
    conversationId,
    isActive: 1,
  });
}

export async function getRoleById(roleId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// TTS Settings Functions

export async function getUserTTSSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ttsSettings).where(eq(ttsSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createOrUpdateTTSSettings(userId: number, settings: Partial<InsertTTSSetting>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const existing = await getUserTTSSettings(userId);
  if (existing) {
    return db.update(ttsSettings)
      .set(settings)
      .where(eq(ttsSettings.userId, userId));
  } else {
    return db.insert(ttsSettings).values({
      userId,
      ...settings,
    });
  }
}

export async function updateTTSLanguage(userId: number, language: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.update(ttsSettings)
    .set({ defaultLanguage: language })
    .where(eq(ttsSettings.userId, userId));
}

export async function updateTTSSpeechRate(userId: number, rate: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.update(ttsSettings)
    .set({ speechRate: rate })
    .where(eq(ttsSettings.userId, userId));
}


// ============ Character Management Functions ============

export async function createCharacter(data: InsertCharacter): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(characters).values(data);
  return { id: (result as any).insertId || 0 };
}

export async function getUserCharacters(userId: number): Promise<Character[]> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  try {
    const result = await db.select()
      .from(characters)
      .where(eq(characters.userId, userId));
    return result;
  } catch (error: any) {
    console.error('[Database] getUserCharacters error:', {
      userId,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorErrno: error?.errno,
      errorSqlMessage: error?.sqlMessage,
      errorSql: error?.sql,
      fullError: error
    });
    throw error;
  }
}

export async function getCharacterById(id: number, userId: number): Promise<Character | undefined> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)));
  
  return result[0];
}

export async function getCharacterByIdAny(id: number): Promise<Character | undefined> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db.select().from(characters).where(eq(characters.id, id)).limit(1);
  return result[0];
}

export async function getCharacterForChat(
  id: number,
  userId: number
): Promise<Character | undefined> {
  const character = await getCharacterByIdAny(id);
  if (!character) return undefined;
  if (character.userId === userId || character.isPublic === 1) return character;
  return undefined;
}

export async function getCharacterByPythonId(
  pythonId: string,
  userId: number
): Promise<Character | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(characters)
    .where(and(eq(characters.pythonId, pythonId), eq(characters.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getCharacterByPythonIdGlobal(
  pythonId: string
): Promise<Character | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(characters)
    .where(eq(characters.pythonId, pythonId))
    .limit(1);
  return result[0];
}

export async function updateCharacterAverageRating(
  characterId: number,
  averageRating: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(characters)
    .set({ averageRating, updatedAt: new Date() })
    .where(eq(characters.id, characterId));
}

export async function getMyAnalyticsForUser(userId: number) {
  const chars = await getUserCharacters(userId);
  const analyticsRows = await getUserCharacterAnalytics(userId);
  const analyticsByChar = new Map(analyticsRows.map((a) => [a.characterId, a]));
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = [];
  for (const character of chars) {
    const convRows = await db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.userId, userId), eq(conversations.characterId, character.id))
      );
    const analytics = analyticsByChar.get(character.id);
    results.push({
      characterId: character.id,
      characterName: character.name,
      conversationCount: analytics?.conversationCount ?? convRows.length,
      messageCount: analytics?.messageCount ?? character.usageCount,
      averageRating: analytics?.averageRating ?? character.averageRating,
      usageCount: character.usageCount,
    });
  }
  return results;
}

export async function updateCharacter(id: number, userId: number, data: Partial<InsertCharacter>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(characters)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(characters.id, id), eq(characters.userId, userId)));
}

export async function deleteCharacter(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.delete(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)));
}

export async function getPublicCharacters(): Promise<Character[]> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Get all public characters with their stats
  // The averageRating and usageCount are now stored directly in the characters table
  return db.select()
    .from(characters)
    .where(eq(characters.isPublic, 1))
    .orderBy(desc(characters.usageCount)); // Sort by most used
}

export async function getLatestCharacters(limit: number = 8): Promise<Character[]> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Get latest public characters sorted by creation date
  return db.select()
    .from(characters)
    .where(eq(characters.isPublic, 1))
    .orderBy(desc(characters.createdAt))
    .limit(limit);
}


// ============================================================================
// CHARACTER TEMPLATES & ANALYTICS
// ============================================================================

/**
 * Get character templates
 */
export const getCharacterTemplates = async () => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  return db.select().from(characterTemplates);
};

/**
 * Get character template by ID
 */
export const getCharacterTemplateById = async (id: number) => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  return db.select().from(characterTemplates).where(eq(characterTemplates.id, id)).limit(1);
};

/**
 * Create character from template (clone for user)
 */
export const createCharacterFromTemplate = async (
  userId: number,
  templateId: number,
  customName?: string
) => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const template = await getCharacterTemplateById(templateId);
  if (!template.length) throw new Error("Template not found");

  const result = await db.insert(characters).values({
    userId,
    name: customName || template[0].name,
    description: template[0].description,
    worldview: template[0].worldview,
    openingLine: template[0].openingLine,
    systemPrompt: template[0].systemPrompt,
    isPublic: 0,
  });

  return result;
};

/**
 * Get character analytics
 */
export const getCharacterAnalytics = async (characterId: number, userId: number) => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  return db
    .select()
    .from(characterAnalytics)
    .where(and(eq(characterAnalytics.characterId, characterId), eq(characterAnalytics.userId, userId)))
    .limit(1);
};

/**
 * Update character analytics
 */
export const updateCharacterAnalytics = async (
  characterId: number,
  userId: number,
  updates: {
    conversationCount?: number;
    messageCount?: number;
    totalUsageTime?: number;
    averageRating?: number;
    lastUsedAt?: Date;
  }
) => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const existing = await getCharacterAnalytics(characterId, userId);

  if (existing.length === 0) {
    // Create new analytics record
    return db.insert(characterAnalytics).values({
      characterId,
      userId,
      conversationCount: updates.conversationCount || 0,
      messageCount: updates.messageCount || 0,
      totalUsageTime: updates.totalUsageTime || 0,
      averageRating: updates.averageRating || 0,
      lastUsedAt: updates.lastUsedAt,
    });
  }

  // Update existing record
  return db
    .update(characterAnalytics)
    .set({
      conversationCount: updates.conversationCount ?? existing[0].conversationCount,
      messageCount: updates.messageCount ?? existing[0].messageCount,
      totalUsageTime: updates.totalUsageTime ?? existing[0].totalUsageTime,
      averageRating: updates.averageRating ?? existing[0].averageRating,
      lastUsedAt: updates.lastUsedAt ?? existing[0].lastUsedAt,
    })
    .where(
      and(
        eq(characterAnalytics.characterId, characterId),
        eq(characterAnalytics.userId, userId)
      )
    );
};

/**
 * Add character rating
 */
export const addCharacterRating = async (
  characterId: number,
  userId: number,
  rating: number,
  comment?: string
) => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  return db.insert(characterRatings).values({
    characterId,
    userId,
    rating,
    comment,
  });
};

/**
 * Get character ratings
 */
export const getCharacterRatings = async (characterId: number) => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  return db.select().from(characterRatings).where(eq(characterRatings.characterId, characterId));
};

/**
 * Get public characters with pagination (for community discovery)
 */
export const getPublicCharactersWithPagination = async (limit: number = 20, offset: number = 0): Promise<Character[]> => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  return db
    .select()
    .from(characters)
    .where(eq(characters.isPublic, 1))
    .limit(limit)
    .offset(offset);
};

/**
 * Seed character templates (run once during setup)
 */
export const seedCharacterTemplates = async () => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const templates = [
    {
      name: "Detective",
      category: "detective",
      description: "A sharp-minded detective with keen observation skills",
      worldview: "The world is a puzzle to be solved through logic and evidence",
      openingLine: "I've seen a lot in my years on the force. What brings you to me?",
      systemPrompt:
        "You are a seasoned detective with years of experience solving mysteries. You ask probing questions, notice details others miss, and think logically about problems. You're skeptical but fair, and you always look for evidence before drawing conclusions.",
    },
    {
      name: "Mentor",
      category: "mentor",
      description: "A wise mentor who guides and inspires growth",
      worldview: "Everyone has potential; they just need the right guidance",
      openingLine: "Welcome. I'm here to help you discover your true potential.",
      systemPrompt:
        "You are a wise and patient mentor. You listen carefully, ask thoughtful questions, and provide guidance based on experience. You encourage growth, celebrate progress, and help people overcome their limitations. You're supportive but also honest about challenges.",
    },
    {
      name: "Comedian",
      category: "comedian",
      description: "A witty comedian who finds humor in everything",
      worldview: "Life is too short not to laugh; humor makes everything better",
      openingLine: "Hey there! Ready to have some laughs?",
      systemPrompt:
        "You are a professional comedian with a sharp wit and great timing. You find humor in everyday situations, make clever observations, and use wordplay and puns. You're entertaining but also thoughtful, and you know when to be serious.",
    },
    {
      name: "Philosopher",
      category: "philosopher",
      description: "A thoughtful philosopher exploring life's big questions",
      worldview: "Understanding the nature of existence and meaning is the highest pursuit",
      openingLine: "Let's explore the deeper questions together.",
      systemPrompt:
        "You are a philosopher who loves exploring ideas and big questions. You reference great thinkers, ask probing questions, and help people think more deeply about their beliefs and values. You're open-minded and enjoy debate, but you're also humble about what can be known.",
    },
    {
      name: "Scientist",
      category: "scientist",
      description: "A curious scientist who explains the world through evidence",
      worldview: "The universe operates by discoverable laws; science reveals truth",
      openingLine: "Fascinating! Let's examine this scientifically.",
      systemPrompt:
        "You are a brilliant scientist with expertise across multiple fields. You explain complex concepts clearly, cite evidence, and encourage critical thinking. You're curious about how things work, you admit uncertainty, and you're excited about discovery.",
    },
    {
      name: "Artist",
      category: "artist",
      description: "A creative artist who sees beauty and meaning in everything",
      worldview: "Art and creativity are how we express our deepest truths",
      openingLine: "Let's create something beautiful together.",
      systemPrompt:
        "You are a talented artist with a unique creative vision. You see the world through an aesthetic lens, find inspiration everywhere, and help others tap into their creativity. You're expressive, imaginative, and passionate about your craft.",
    },
    {
      name: "Coach",
      category: "coach",
      description: "A motivational coach who pushes you to achieve your best",
      worldview: "Everyone can achieve greatness with the right mindset and effort",
      openingLine: "Alright, let's get to work and make you unstoppable!",
      systemPrompt:
        "You are an energetic and motivational coach. You believe in people's potential, push them to be their best, and celebrate their victories. You're direct, positive, and focused on results. You help people set goals and overcome obstacles.",
    },
    {
      name: "Therapist",
      category: "therapist",
      description: "An empathetic therapist who listens and helps you understand yourself",
      worldview: "Understanding ourselves is the key to happiness and growth",
      openingLine: "I'm here to listen. Tell me what's on your mind.",
      systemPrompt:
        "You are a compassionate and empathetic therapist. You listen without judgment, ask insightful questions, and help people understand their feelings and behaviors. You're warm, professional, and focused on helping people find their own answers.",
    },
    {
      name: "Adventurer",
      category: "adventurer",
      description: "A bold adventurer who seeks thrills and new experiences",
      worldview: "Life is meant to be lived fully; adventure awaits around every corner",
      openingLine: "Ready for an adventure? Let's explore!",
      systemPrompt:
        "You are a daring adventurer with a spirit of exploration. You're enthusiastic, brave, and always looking for the next challenge. You inspire others to step outside their comfort zones and embrace new experiences. You tell exciting stories and have a contagious energy.",
    },
    {
      name: "Scholar",
      category: "scholar",
      description: "A knowledgeable scholar who loves learning and sharing knowledge",
      worldview: "Knowledge is power; continuous learning is the path to wisdom",
      openingLine: "Ah, an excellent question. Let me share what I know.",
      systemPrompt:
        "You are an erudite scholar with deep knowledge across many subjects. You're articulate, well-read, and love discussing ideas. You cite sources, acknowledge different perspectives, and help others learn. You're patient with questions and passionate about your areas of expertise.",
    },
  ];

  for (const template of templates) {
    const existing = await db
      .select()
      .from(characterTemplates)
      .where(eq(characterTemplates.name, template.name));

    if (existing.length === 0) {
      await db.insert(characterTemplates).values({
        ...template,
        usageCount: 0,
        averageRating: 0,
      });
    }
  }
};

/**
 * Get character analytics for user
 */
export const getUserCharacterAnalytics = async (userId: number) => {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  return db
    .select()
    .from(characterAnalytics)
    .where(eq(characterAnalytics.userId, userId));
};

export async function submitBugReport(userId: number, data: Omit<InsertBugReport, 'userId'>): Promise<void> {
  const db = await getDb();
  if (!db) {
    const { saveMemoryBugReport } = await import("./_core/bugReportStore");
    saveMemoryBugReport(userId, data);
    return;
  }

  await db.insert(bugReports).values({
    ...data,
    userId,
  });
}

export async function getBugReports(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(bugReports).where(eq(bugReports.userId, userId));
}

export async function getAllBugReports() {
  const db = await getDb();
  if (!db) {
    const { getAllMemoryBugReports } = await import("./_core/bugReportStore");
    return getAllMemoryBugReports();
  }

  return await db.select().from(bugReports).orderBy(desc(bugReports.createdAt));
}

export async function updateBugReportStatus(bugReportId: number, status: string, adminNotes?: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    const { updateMemoryBugReportStatus } = await import("./_core/bugReportStore");
    const updated = updateMemoryBugReportStatus(
      bugReportId,
      status as "open" | "in_progress" | "resolved" | "closed",
      adminNotes
    );
    if (!updated) throw new Error("Bug report not found");
    return;
  }

  const updateData: any = { status, updatedAt: new Date() };
  if (adminNotes) updateData.adminNotes = adminNotes;
  if (status === 'resolved') updateData.resolvedAt = new Date();

  await db.update(bugReports).set(updateData).where(eq(bugReports.id, bugReportId));
}

// Tutorial helpers
export async function getTutorials() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tutorials).where(eq(tutorials.isActive, 1)).orderBy(tutorials.order);
}

export async function getTutorialById(id: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tutorials).where(eq(tutorials.id, id)).limit(1);
}

export async function getUserTutorialProgress(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tutorialProgress).where(eq(tutorialProgress.userId, userId));
}

export async function getTutorialProgress(userId: number, tutorialId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tutorialProgress)
    .where(and(eq(tutorialProgress.userId, userId), eq(tutorialProgress.tutorialId, tutorialId)))
    .limit(1);
}

export async function updateTutorialProgress(userId: number, tutorialId: number, status: "not_started" | "in_progress" | "completed") {
  const db = await getDb();
  if (!db) return;
  const existing = await getTutorialProgress(userId, tutorialId);
  
  if (existing.length > 0) {
    return await db.update(tutorialProgress)
      .set({
        status,
        completedAt: status === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(tutorialProgress.userId, userId), eq(tutorialProgress.tutorialId, tutorialId)));
  } else {
    return await db.insert(tutorialProgress).values({
      userId,
      tutorialId,
      status,
      completedAt: status === "completed" ? new Date() : null,
    });
  }
}

export async function createTutorial(data: InsertTutorial) {
  const db = await getDb();
  if (!db) return;
  return await db.insert(tutorials).values(data);
}

export async function ensureTutorialsSeeded(
  defaults: ReadonlyArray<{
    title: string;
    description: string;
    category: string;
    order: number;
    content: string;
    videoUrl: string | null;
    estimatedTime: number;
    isActive: number;
  }>
) {
  const db = await getDb();
  if (!db) return [];
  const existing = await db.select().from(tutorials).where(eq(tutorials.isActive, 1)).orderBy(tutorials.order);
  if (existing.length > 0) return existing;

  for (const tutorial of defaults) {
    await db.insert(tutorials).values({
      title: tutorial.title,
      description: tutorial.description,
      category: tutorial.category,
      order: tutorial.order,
      content: tutorial.content,
      videoUrl: tutorial.videoUrl,
      estimatedTime: tutorial.estimatedTime,
      isActive: tutorial.isActive,
    });
  }
  return db.select().from(tutorials).where(eq(tutorials.isActive, 1)).orderBy(tutorials.order);
}

export async function getTutorialsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tutorials)
    .where(and(eq(tutorials.category, category), eq(tutorials.isActive, 1)))
    .orderBy(tutorials.order);
}


/**
 * Clone a character from another user
 */
export async function cloneCharacter(sourceCharacterId: number, targetUserId: number): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Get the source character
  const sourceCharacter = await db.select()
    .from(characters)
    .where(eq(characters.id, sourceCharacterId));
  
  if (!sourceCharacter || sourceCharacter.length === 0) {
    throw new Error('Character not found');
  }
  
  const source = sourceCharacter[0];
  
  // Create a new character with the same properties but different user
  const clonedName = `${source.name} (Clone)`;
  const result = await db.insert(characters).values({
    userId: targetUserId,
    name: clonedName,
    description: source.description,
    worldview: source.worldview,
    openingLine: source.openingLine,
    systemPrompt: source.systemPrompt,
    avatarUrl: source.avatarUrl,
    avatarKey: source.avatarKey,
    isPublic: 0, // Cloned characters are private by default
    averageRating: 0,
    usageCount: 0,
  });
  
  return { id: (result as any).insertId || 0 };
}


/**
 * Get user's LLM configuration
 */
export async function getUserLLMConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = result[0];
  
  if (!user?.llmConfig) return null;
  
  try {
    return JSON.parse(user.llmConfig);
  } catch {
    return null;
  }
}

/**
 * Update user's LLM configuration
 */
export async function updateUserLLMConfig(userId: number, config: any) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(users)
    .set({
      llmConfig: JSON.stringify(config),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  
  return config;
}

/**
 * Delete user's LLM configuration
 */
export async function deleteUserLLMConfig(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(users)
    .set({
      llmConfig: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}


// ==================== Forum Functions ====================

export async function ensureForumCategoriesSeeded(
  defaults: Array<{ id: number; name: string; icon: string; description: string }>
) {
  const db = await getDb();
  if (!db) return [];
  const existing = await db.select().from(forumCategories).orderBy(forumCategories.sortOrder);
  if (existing.length > 0) return existing;

  for (const cat of defaults) {
    await db.insert(forumCategories).values({
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      sortOrder: cat.id,
    });
  }
  return db.select().from(forumCategories).orderBy(forumCategories.sortOrder);
}

export async function getForumCategories() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(forumCategories).orderBy(forumCategories.sortOrder);
}

export async function getForumPosts(categoryId?: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  
  if (categoryId) {
    return await db.select().from(forumPosts)
      .where(eq(forumPosts.categoryId, categoryId))
      .orderBy(desc(forumPosts.createdAt))
      .limit(limit)
      .offset(offset);
  }
  
  return await db.select().from(forumPosts)
    .orderBy(desc(forumPosts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getForumPost(postId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(forumPosts).where(eq(forumPosts.id, postId)).limit(1);
  return result[0] || null;
}

export async function createForumPost(data: InsertForumPost) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(forumPosts).values(data);
  return { id: result[0].insertId };
}

export async function getForumReplies(postId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(forumReplies)
    .where(eq(forumReplies.postId, postId))
    .orderBy(forumReplies.createdAt);
}

export async function createForumReply(data: InsertForumReply) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(forumReplies).values(data);
  
  // Increment reply count
  const post = await getForumPost(data.postId);
  if (post) {
    await db.update(forumPosts)
      .set({ replyCount: post.replyCount + 1 })
      .where(eq(forumPosts.id, data.postId));
  }
  
  return { id: result[0].insertId };
}

export async function likeForumPost(postId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const post = await getForumPost(postId);
  if (!post) throw new Error('Post not found');
  const likes = post.likes + 1;
  await db.update(forumPosts)
    .set({ likes })
    .where(eq(forumPosts.id, postId));
  return likes;
}

export async function likeForumReply(replyId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.select().from(forumReplies).where(eq(forumReplies.id, replyId)).limit(1);
  const reply = result[0];
  if (!reply) throw new Error('Reply not found');
  const likes = reply.likes + 1;
  await db.update(forumReplies)
    .set({ likes })
    .where(eq(forumReplies.id, replyId));
  return likes;
}


// ==================== Memory System ====================

/**
 * Add a new memory for a user
 */
export async function addMemory(data: { userId: number; characterId?: number; memoryType: string; content: string; importance?: number }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(userMemories).values({
    userId: data.userId,
    characterId: data.characterId || null,
    memoryType: data.memoryType,
    content: data.content,
    importance: data.importance || 5,
  });
  return result[0].insertId;
}

/**
 * Get memories for a user, optionally filtered by character and type
 */
export async function getMemories(userId: number, options?: { characterId?: number; memoryType?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let conditions = [eq(userMemories.userId, userId)];
  if (options?.characterId) conditions.push(eq(userMemories.characterId, options.characterId));
  if (options?.memoryType) conditions.push(eq(userMemories.memoryType, options.memoryType));
  
  const results = await db.select().from(userMemories)
    .where(and(...conditions))
    .orderBy(desc(userMemories.importance), desc(userMemories.lastAccessed))
    .limit(options?.limit || 50);
  
  return results;
}

/**
 * Update memory access count and timestamp
 */
export async function touchMemory(memoryId: number) {
  const db = await getDb();
  if (!db) return;
  
  const memory = await db.select().from(userMemories).where(eq(userMemories.id, memoryId)).limit(1);
  if (memory[0]) {
    await db.update(userMemories)
      .set({ 
        lastAccessed: new Date(),
        accessCount: memory[0].accessCount + 1,
      })
      .where(eq(userMemories.id, memoryId));
  }
}

/**
 * Delete a memory
 */
export async function deleteMemory(memoryId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.delete(userMemories)
    .where(and(eq(userMemories.id, memoryId), eq(userMemories.userId, userId)));
}

/**
 * Add knowledge base entry
 */
export async function addKnowledge(data: { userId: number; title: string; content: string; category?: string; tags?: string[] }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(knowledgeBase).values({
    userId: data.userId,
    title: data.title,
    content: data.content,
    category: data.category || null,
    tags: data.tags ? JSON.stringify(data.tags) : null,
  });
  return result[0].insertId;
}

/**
 * Get knowledge base entries for a user
 */
export async function getKnowledge(userId: number, options?: { category?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let conditions = [eq(knowledgeBase.userId, userId), eq(knowledgeBase.isActive, true)];
  if (options?.category) conditions.push(eq(knowledgeBase.category, options.category));
  
  const results = await db.select().from(knowledgeBase)
    .where(and(...conditions))
    .orderBy(desc(knowledgeBase.updatedAt))
    .limit(options?.limit || 50);
  
  return results;
}

/**
 * Delete knowledge base entry
 */
export async function deleteKnowledge(entryId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.delete(knowledgeBase)
    .where(and(eq(knowledgeBase.id, entryId), eq(knowledgeBase.userId, userId)));
}
