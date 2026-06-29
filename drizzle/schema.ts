import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, boolean } from 'drizzle-orm/mysql-core';

export const bugReports = mysqlTable('bugReports', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  severity: mysqlEnum('severity', ["low","medium","high","critical"]).notNull().default('\'medium\''),
  status: mysqlEnum('status', ["open","in_progress","resolved","closed"]).notNull().default('\'open\''),
  url: text('url'),
  userAgent: text('userAgent'),
  screenshot: text('screenshot'),
  adminNotes: text('adminNotes'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  resolvedAt: timestamp('resolvedAt'),
});

export const characterAnalytics = mysqlTable('characterAnalytics', {
  id: int('id').autoincrement().notNull(),
  characterId: int('characterId').notNull(),
  userId: int('userId').notNull(),
  conversationCount: int('conversationCount').notNull().default(0),
  messageCount: int('messageCount').notNull().default(0),
  totalUsageTime: int('totalUsageTime').notNull().default(0),
  averageRating: int('averageRating').notNull().default(0),
  lastUsedAt: timestamp('lastUsedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const characterRatings = mysqlTable('characterRatings', {
  id: int('id').autoincrement().notNull(),
  characterId: int('characterId').notNull(),
  userId: int('userId').notNull(),
  rating: int('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const characterTemplates = mysqlTable('characterTemplates', {
  id: int('id').autoincrement().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  worldview: text('worldview').notNull(),
  openingLine: text('openingLine').notNull(),
  systemPrompt: text('systemPrompt').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  avatar: varchar('avatar', { length: 500 }),
  usageCount: int('usageCount').notNull().default(0),
  averageRating: int('averageRating').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const characters = mysqlTable('characters', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  worldview: text('worldview').notNull(),
  openingLine: text('openingLine').notNull(),
  systemPrompt: text('systemPrompt'),
  avatarUrl: text('avatarUrl'),
  avatarKey: varchar('avatarKey', { length: 255 }),
  isPublic: int('isPublic').notNull().default(0),
  averageRating: int('averageRating').notNull().default(0),
  usageCount: int('usageCount').notNull().default(0),
  pythonId: varchar('pythonId', { length: 255 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const conversationHistory = mysqlTable('conversationHistory', {
  id: int('id').autoincrement().notNull(),
  conversationId: int('conversationId').notNull(),
  userId: int('userId').notNull(),
  characterId: int('characterId'),
  messageCount: int('messageCount').notNull().default(0),
  summary: text('summary'),
  tags: text('tags'),
  isArchived: boolean('isArchived').notNull().default(false),
  isFavorite: boolean('isFavorite').notNull().default(false),
  lastMessageAt: timestamp('lastMessageAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const conversations = mysqlTable('conversations', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  title: varchar('title', { length: 255 }).notNull().default('\'New Conversation\''),
  mode: mysqlEnum('mode', ["chat","image"]).notNull().default('\'chat\''),
  characterId: int('characterId'),
  pythonSessionId: varchar('pythonSessionId', { length: 255 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const developerVerifications = mysqlTable('developerVerifications', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  verificationToken: varchar('verificationToken', { length: 255 }).notNull(),
  status: mysqlEnum('status', ["pending","verified","rejected"]).notNull().default('\'pending\''),
  verifiedAt: timestamp('verifiedAt'),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const errorFixes = mysqlTable('errorFixes', {
  id: int('id').autoincrement().notNull(),
  errorType: varchar('errorType', { length: 255 }).notNull(),
  errorMessage: text('errorMessage').notNull(),
  fixType: varchar('fixType', { length: 100 }).notNull(),
  fixData: text('fixData'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const errorLogs = mysqlTable('errorLogs', {
  id: int('id').autoincrement().notNull(),
  errorType: varchar('errorType', { length: 255 }).notNull(),
  errorMessage: text('errorMessage').notNull(),
  errorStack: text('errorStack'),
  context: varchar('context', { length: 255 }).notNull().default('\'unknown\''),
  occurrenceCount: int('occurrenceCount').notNull().default(1),
  lastOccurredAt: timestamp('lastOccurredAt').notNull().defaultNow(),
  isFixed: int('isFixed').notNull().default(0),
  fixApplied: varchar('fixApplied', { length: 255 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const feedback = mysqlTable('feedback', {
  id: int('id').autoincrement().notNull(),
  messageId: int('messageId').notNull(),
  userId: int('userId').notNull(),
  rating: int('rating').notNull(),
  comment: text('comment'),
  tags: varchar('tags', { length: 500 }),
  sentiment: mysqlEnum('sentiment', ["positive","neutral","negative"]).notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const forumCategories = mysqlTable('forumCategories', {
  id: int('id').autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  nameEn: varchar('nameEn', { length: 100 }),
  nameJa: varchar('nameJa', { length: 100 }),
  description: text('description'),
  icon: varchar('icon', { length: 10 }),
  sortOrder: int('sortOrder').default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const forumPosts = mysqlTable('forumPosts', {
  id: int('id').autoincrement().notNull(),
  categoryId: int('categoryId').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  language: varchar('language', { length: 10 }).notNull().default('\'zh\''),
  authorName: varchar('authorName', { length: 50 }).notNull().default('\'匿名\''),
  authorHash: varchar('authorHash', { length: 64 }),
  userId: int('userId'),
  likes: int('likes').notNull().default(0),
  replyCount: int('replyCount').notNull().default(0),
  isPinned: boolean('isPinned').notNull().default(false),
  isLocked: boolean('isLocked').notNull().default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const forumReplies = mysqlTable('forumReplies', {
  id: int('id').autoincrement().notNull(),
  postId: int('postId').notNull(),
  content: text('content').notNull(),
  language: varchar('language', { length: 10 }).notNull().default('\'zh\''),
  authorName: varchar('authorName', { length: 50 }).notNull().default('\'匿名\''),
  authorHash: varchar('authorHash', { length: 64 }),
  userId: int('userId'),
  likes: int('likes').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const generatedImages = mysqlTable('generatedImages', {
  id: int('id').autoincrement().notNull(),
  conversationId: int('conversationId').notNull(),
  userId: int('userId').notNull(),
  prompt: text('prompt').notNull(),
  imageUrl: text('imageUrl').notNull(),
  imageKey: varchar('imageKey', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const knowledgeBase = mysqlTable('knowledgeBase', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  category: varchar('category', { length: 100 }),
  tags: text('tags'),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const messages = mysqlTable('messages', {
  id: int('id').autoincrement().notNull(),
  conversationId: int('conversationId').notNull(),
  role: mysqlEnum('role', ["user","assistant"]).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const modelImprovements = mysqlTable('modelImprovements', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  improvementType: mysqlEnum('improvementType', ["prompt_optimization","response_quality","context_awareness","tone_adjustment","accuracy_improvement","self_reflection"]).notNull(),
  description: text('description').notNull(),
  feedbackCount: int('feedbackCount').notNull().default(0),
  averageRating: int('averageRating'),
  appliedAt: timestamp('appliedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const promptOptimizationLog = mysqlTable('promptOptimizationLog', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  originalPrompt: text('originalPrompt').notNull(),
  optimizedPrompt: text('optimizedPrompt').notNull(),
  optimizationStrategy: varchar('optimizationStrategy', { length: 255 }).notNull(),
  feedbackImprovement: int('feedbackImprovement'),
  successRate: int('successRate'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const roles = mysqlTable('roles', {
  id: int('id').autoincrement().notNull(),
  roleName: varchar('roleName', { length: 100 }).notNull(),
  description: text('description'),
  systemPrompt: text('systemPrompt').notNull(),
  personality: varchar('personality', { length: 255 }),
  expertise: varchar('expertise', { length: 255 }),
  isPreset: int('isPreset').notNull().default(1),
  createdBy: int('createdBy'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const sdGenerations = mysqlTable('sdGenerations', {
  id: int('id').autoincrement().notNull(),
  conversationId: int('conversationId').notNull(),
  userId: int('userId').notNull(),
  modelId: int('modelId').notNull(),
  prompt: text('prompt').notNull(),
  negativePrompt: text('negativePrompt'),
  imageUrl: text('imageUrl').notNull(),
  imageKey: varchar('imageKey', { length: 255 }).notNull(),
  steps: int('steps').notNull().default(20),
  cfgScale: int('cfgScale').notNull().default(7),
  sampler: varchar('sampler', { length: 100 }).notNull().default('\'euler\''),
  seed: int('seed'),
  width: int('width').notNull().default(512),
  height: int('height').notNull().default(512),
  generationTime: int('generationTime'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const sdModels = mysqlTable('sdModels', {
  id: int('id').autoincrement().notNull(),
  modelName: varchar('modelName', { length: 255 }).notNull(),
  modelId: varchar('modelId', { length: 255 }).notNull(),
  version: varchar('version', { length: 100 }).notNull(),
  description: text('description'),
  downloadUrl: text('downloadUrl'),
  isActive: int('isActive').notNull().default(1),
  isDownloaded: int('isDownloaded').notNull().default(0),
  fileSize: int('fileSize'),
  downloadedAt: timestamp('downloadedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const sdPresets = mysqlTable('sdPresets', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  presetName: varchar('presetName', { length: 255 }).notNull(),
  description: text('description'),
  steps: int('steps').notNull().default(20),
  cfgScale: int('cfgScale').notNull().default(7),
  sampler: varchar('sampler', { length: 100 }).notNull().default('\'euler\''),
  width: int('width').notNull().default(512),
  height: int('height').notNull().default(512),
  isDefault: int('isDefault').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const ttsSettings = mysqlTable('ttsSettings', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  defaultLanguage: varchar('defaultLanguage', { length: 10 }).notNull().default('\'en\''),
  voiceGender: varchar('voiceGender', { length: 10 }).notNull().default('\'female\''),
  speechRate: int('speechRate').notNull().default(100),
  pitch: int('pitch').notNull().default(100),
  volume: int('volume').notNull().default(100),
  enableTTS: int('enableTTS').notNull().default(1),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const tutorialProgress = mysqlTable('tutorialProgress', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  tutorialId: int('tutorialId').notNull(),
  status: mysqlEnum('status', ["not_started","in_progress","completed"]).notNull().default('\'not_started\''),
  completedAt: timestamp('completedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const tutorials = mysqlTable('tutorials', {
  id: int('id').autoincrement().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  order: int('order').notNull().default(0),
  content: text('content').notNull(),
  videoUrl: varchar('videoUrl', { length: 500 }),
  estimatedTime: int('estimatedTime').notNull().default(5),
  isActive: int('isActive').notNull().default(1),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const userMemories = mysqlTable('userMemories', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  characterId: int('characterId'),
  memoryType: varchar('memoryType', { length: 50 }).notNull(),
  content: text('content').notNull(),
  importance: int('importance').notNull().default(5),
  lastAccessed: timestamp('lastAccessed').notNull().defaultNow(),
  accessCount: int('accessCount').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const userRoles = mysqlTable('userRoles', {
  id: int('id').autoincrement().notNull(),
  userId: int('userId').notNull(),
  roleId: int('roleId').notNull(),
  conversationId: int('conversationId'),
  isActive: int('isActive').notNull().default(1),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  openId: varchar('openId', { length: 64 }).notNull(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: mysqlEnum('role', ["user", "admin", "developer"]).notNull().default("user"),
  llmConfig: text('llmConfig'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastSignedIn: timestamp('lastSignedIn').notNull().defaultNow(),
});

export const temporaryAccounts = mysqlTable('temporaryAccounts', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const f2fVerifications = mysqlTable('f2fVerifications', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  facePhotoUrl: text('facePhotoUrl'),
  livenessCheckUrl: text('livenessCheckUrl'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const f2fVerificationLogs = mysqlTable('f2fVerificationLogs', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  verificationId: int('verificationId').notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type BugReports = typeof bugReports.$inferSelect;
export type InsertBugReports = typeof bugReports.$inferInsert;
export type CharacterAnalytics = typeof characterAnalytics.$inferSelect;
export type InsertCharacterAnalytics = typeof characterAnalytics.$inferInsert;
export type CharacterRatings = typeof characterRatings.$inferSelect;
export type InsertCharacterRatings = typeof characterRatings.$inferInsert;
export type CharacterTemplates = typeof characterTemplates.$inferSelect;
export type InsertCharacterTemplates = typeof characterTemplates.$inferInsert;
export type Characters = typeof characters.$inferSelect;
export type InsertCharacters = typeof characters.$inferInsert;
export type ConversationHistory = typeof conversationHistory.$inferSelect;
export type InsertConversationHistory = typeof conversationHistory.$inferInsert;
export type Conversations = typeof conversations.$inferSelect;
export type InsertConversations = typeof conversations.$inferInsert;
export type DeveloperVerifications = typeof developerVerifications.$inferSelect;
export type InsertDeveloperVerifications = typeof developerVerifications.$inferInsert;
export type ErrorFixes = typeof errorFixes.$inferSelect;
export type InsertErrorFixes = typeof errorFixes.$inferInsert;
export type ErrorLogs = typeof errorLogs.$inferSelect;
export type InsertErrorLogs = typeof errorLogs.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;
export type ForumCategories = typeof forumCategories.$inferSelect;
export type InsertForumCategories = typeof forumCategories.$inferInsert;
export type ForumPosts = typeof forumPosts.$inferSelect;
export type InsertForumPosts = typeof forumPosts.$inferInsert;
export type ForumReplies = typeof forumReplies.$inferSelect;
export type InsertForumReplies = typeof forumReplies.$inferInsert;
export type GeneratedImages = typeof generatedImages.$inferSelect;
export type InsertGeneratedImages = typeof generatedImages.$inferInsert;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = typeof knowledgeBase.$inferInsert;
export type Messages = typeof messages.$inferSelect;
export type InsertMessages = typeof messages.$inferInsert;
export type ModelImprovements = typeof modelImprovements.$inferSelect;
export type InsertModelImprovements = typeof modelImprovements.$inferInsert;
export type PromptOptimizationLog = typeof promptOptimizationLog.$inferSelect;
export type InsertPromptOptimizationLog = typeof promptOptimizationLog.$inferInsert;
export type Roles = typeof roles.$inferSelect;
export type InsertRoles = typeof roles.$inferInsert;
export type SdGenerations = typeof sdGenerations.$inferSelect;
export type InsertSdGenerations = typeof sdGenerations.$inferInsert;
export type SdModels = typeof sdModels.$inferSelect;
export type InsertSdModels = typeof sdModels.$inferInsert;
export type SdPresets = typeof sdPresets.$inferSelect;
export type InsertSdPresets = typeof sdPresets.$inferInsert;
export type TtsSettings = typeof ttsSettings.$inferSelect;
export type InsertTtsSettings = typeof ttsSettings.$inferInsert;
export type TutorialProgress = typeof tutorialProgress.$inferSelect;
export type InsertTutorialProgress = typeof tutorialProgress.$inferInsert;
export type Tutorials = typeof tutorials.$inferSelect;
export type InsertTutorials = typeof tutorials.$inferInsert;
export type UserMemories = typeof userMemories.$inferSelect;
export type InsertUserMemories = typeof userMemories.$inferInsert;
export type UserRoles = typeof userRoles.$inferSelect;
export type InsertUserRoles = typeof userRoles.$inferInsert;
export type Users = typeof users.$inferSelect;
export type InsertUsers = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type InsertCharacter = typeof characters.$inferInsert;
