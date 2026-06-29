import { relations } from "drizzle-orm/relations";
import { users, bugReports, characters, characterAnalytics, characterRatings, conversations, messages, feedback, generatedImages, modelImprovements, promptOptimizationLog, roles, sdGenerations, sdModels, sdPresets, ttsSettings, tutorialProgress, tutorials, userRoles } from "./schema";

export const bugReportsRelations = relations(bugReports, ({one}) => ({
	user: one(users, {
		fields: [bugReports.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	bugReports: many(bugReports),
	characterAnalytics: many(characterAnalytics),
	characterRatings: many(characterRatings),
	characters: many(characters),
	conversations: many(conversations),
	feedbacks: many(feedback),
	generatedImages: many(generatedImages),
	modelImprovements: many(modelImprovements),
	promptOptimizationLogs: many(promptOptimizationLog),
	roles: many(roles),
	sdGenerations: many(sdGenerations),
	sdPresets: many(sdPresets),
	ttsSettings: many(ttsSettings),
	tutorialProgresses: many(tutorialProgress),
	userRoles: many(userRoles),
}));

export const characterAnalyticsRelations = relations(characterAnalytics, ({one}) => ({
	character: one(characters, {
		fields: [characterAnalytics.characterId],
		references: [characters.id]
	}),
	user: one(users, {
		fields: [characterAnalytics.userId],
		references: [users.id]
	}),
}));

export const charactersRelations = relations(characters, ({one, many}) => ({
	characterAnalytics: many(characterAnalytics),
	characterRatings: many(characterRatings),
	conversations: many(conversations),
	user: one(users, {
		fields: [characters.userId],
		references: [users.id]
	}),
}));

export const characterRatingsRelations = relations(characterRatings, ({one}) => ({
	character: one(characters, {
		fields: [characterRatings.characterId],
		references: [characters.id]
	}),
	user: one(users, {
		fields: [characterRatings.userId],
		references: [users.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	user: one(users, {
		fields: [conversations.userId],
		references: [users.id]
	}),
	character: one(characters, {
		fields: [conversations.characterId],
		references: [characters.id]
	}),
	generatedImages: many(generatedImages),
	messages: many(messages),
	sdGenerations: many(sdGenerations),
	userRoles: many(userRoles),
}));

export const feedbackRelations = relations(feedback, ({one}) => ({
	message: one(messages, {
		fields: [feedback.messageId],
		references: [messages.id]
	}),
	user: one(users, {
		fields: [feedback.userId],
		references: [users.id]
	}),
}));

export const messagesRelations = relations(messages, ({one, many}) => ({
	feedbacks: many(feedback),
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
}));

export const generatedImagesRelations = relations(generatedImages, ({one}) => ({
	conversation: one(conversations, {
		fields: [generatedImages.conversationId],
		references: [conversations.id]
	}),
	user: one(users, {
		fields: [generatedImages.userId],
		references: [users.id]
	}),
}));

export const modelImprovementsRelations = relations(modelImprovements, ({one}) => ({
	user: one(users, {
		fields: [modelImprovements.userId],
		references: [users.id]
	}),
}));

export const promptOptimizationLogRelations = relations(promptOptimizationLog, ({one}) => ({
	user: one(users, {
		fields: [promptOptimizationLog.userId],
		references: [users.id]
	}),
}));

export const rolesRelations = relations(roles, ({one, many}) => ({
	user: one(users, {
		fields: [roles.createdBy],
		references: [users.id]
	}),
	userRoles: many(userRoles),
}));

export const sdGenerationsRelations = relations(sdGenerations, ({one}) => ({
	conversation: one(conversations, {
		fields: [sdGenerations.conversationId],
		references: [conversations.id]
	}),
	user: one(users, {
		fields: [sdGenerations.userId],
		references: [users.id]
	}),
	sdModel: one(sdModels, {
		fields: [sdGenerations.modelId],
		references: [sdModels.id]
	}),
}));

export const sdModelsRelations = relations(sdModels, ({many}) => ({
	sdGenerations: many(sdGenerations),
}));

export const sdPresetsRelations = relations(sdPresets, ({one}) => ({
	user: one(users, {
		fields: [sdPresets.userId],
		references: [users.id]
	}),
}));

export const ttsSettingsRelations = relations(ttsSettings, ({one}) => ({
	user: one(users, {
		fields: [ttsSettings.userId],
		references: [users.id]
	}),
}));

export const tutorialProgressRelations = relations(tutorialProgress, ({one}) => ({
	user: one(users, {
		fields: [tutorialProgress.userId],
		references: [users.id]
	}),
	tutorial: one(tutorials, {
		fields: [tutorialProgress.tutorialId],
		references: [tutorials.id]
	}),
}));

export const tutorialsRelations = relations(tutorials, ({many}) => ({
	tutorialProgresses: many(tutorialProgress),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id]
	}),
	conversation: one(conversations, {
		fields: [userRoles.conversationId],
		references: [conversations.id]
	}),
}));