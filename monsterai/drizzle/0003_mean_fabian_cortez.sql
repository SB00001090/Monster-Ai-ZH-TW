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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE `sdGenerations` ADD CONSTRAINT `sdGenerations_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sdGenerations` ADD CONSTRAINT `sdGenerations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sdGenerations` ADD CONSTRAINT `sdGenerations_modelId_sdModels_id_fk` FOREIGN KEY (`modelId`) REFERENCES `sdModels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sdPresets` ADD CONSTRAINT `sdPresets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;