CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New Conversation',
	`mode` enum('chat','image') NOT NULL DEFAULT 'chat',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);

CREATE TABLE `generatedImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`prompt` text NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generatedImages_id` PRIMARY KEY(`id`)
);

CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);

ALTER TABLE `conversations` ADD CONSTRAINT `conversations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `generatedImages` ADD CONSTRAINT `generatedImages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `generatedImages` ADD CONSTRAINT `generatedImages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE TABLE `feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`tags` varchar(500),
	`sentiment` enum('positive','neutral','negative') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`)
);

CREATE TABLE `modelImprovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`improvementType` enum('prompt_optimization','response_quality','context_awareness','tone_adjustment','accuracy_improvement') NOT NULL,
	`description` text NOT NULL,
	`feedbackCount` int NOT NULL DEFAULT 0,
	`averageRating` int,
	`appliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modelImprovements_id` PRIMARY KEY(`id`)
);

CREATE TABLE `promptOptimizationLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originalPrompt` text NOT NULL,
	`optimizedPrompt` text NOT NULL,
	`optimizationStrategy` varchar(255) NOT NULL,
	`feedbackImprovement` int,
	`successRate` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promptOptimizationLog_id` PRIMARY KEY(`id`)
);

ALTER TABLE `feedback` ADD CONSTRAINT `feedback_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `modelImprovements` ADD CONSTRAINT `modelImprovements_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `promptOptimizationLog` ADD CONSTRAINT `promptOptimizationLog_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
CREATE TABLE `sdGenerations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`modelId` int NOT NULL,
	`prompt` text NOT NULL,
	`negativePrompt` text,
	`imageUrl` text NOT NULL,
	`imageKey` varchar(255) NOT NULL,
	`steps` int NOT NULL DEFAULT 20,
	`cfgScale` int NOT NULL DEFAULT 7,
	`sampler` varchar(100) NOT NULL DEFAULT 'euler',
	`seed` int,
	`width` int NOT NULL DEFAULT 512,
	`height` int NOT NULL DEFAULT 512,
	`generationTime` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sdGenerations_id` PRIMARY KEY(`id`)
);

CREATE TABLE `sdModels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelName` varchar(255) NOT NULL,
	`modelId` varchar(255) NOT NULL,
	`version` varchar(100) NOT NULL,
	`description` text,
	`downloadUrl` text,
	`isActive` int NOT NULL DEFAULT 1,
	`isDownloaded` int NOT NULL DEFAULT 0,
	`fileSize` int,
	`downloadedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sdModels_id` PRIMARY KEY(`id`),
	CONSTRAINT `sdModels_modelName_unique` UNIQUE(`modelName`),
	CONSTRAINT `sdModels_modelId_unique` UNIQUE(`modelId`)
);

CREATE TABLE `sdPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`presetName` varchar(255) NOT NULL,
	`description` text,
	`steps` int NOT NULL DEFAULT 20,
	`cfgScale` int NOT NULL DEFAULT 7,
	`sampler` varchar(100) NOT NULL DEFAULT 'euler',
	`width` int NOT NULL DEFAULT 512,
	`height` int NOT NULL DEFAULT 512,
	`isDefault` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sdPresets_id` PRIMARY KEY(`id`)
);

ALTER TABLE `sdGenerations` ADD CONSTRAINT `sdGenerations_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `sdGenerations` ADD CONSTRAINT `sdGenerations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `sdGenerations` ADD CONSTRAINT `sdGenerations_modelId_sdModels_id_fk` FOREIGN KEY (`modelId`) REFERENCES `sdModels`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `sdPresets` ADD CONSTRAINT `sdPresets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleName` varchar(100) NOT NULL,
	`description` text,
	`systemPrompt` text NOT NULL,
	`personality` varchar(255),
	`expertise` varchar(255),
	`isPreset` int NOT NULL DEFAULT 1,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`)
);

CREATE TABLE `ttsSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`defaultLanguage` varchar(10) NOT NULL DEFAULT 'en',
	`voiceGender` varchar(10) NOT NULL DEFAULT 'female',
	`speechRate` int NOT NULL DEFAULT 100,
	`pitch` int NOT NULL DEFAULT 100,
	`volume` int NOT NULL DEFAULT 100,
	`enableTTS` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ttsSettings_id` PRIMARY KEY(`id`)
);

CREATE TABLE `userRoles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`conversationId` int,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userRoles_id` PRIMARY KEY(`id`)
);

ALTER TABLE `roles` ADD CONSTRAINT `roles_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `ttsSettings` ADD CONSTRAINT `ttsSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `userRoles` ADD CONSTRAINT `userRoles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `userRoles` ADD CONSTRAINT `userRoles_roleId_roles_id_fk` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `userRoles` ADD CONSTRAINT `userRoles_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE no action ON UPDATE no action;