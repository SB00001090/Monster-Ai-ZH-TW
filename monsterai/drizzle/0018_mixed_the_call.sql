CREATE TABLE `conversationHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`characterId` int,
	`messageCount` int NOT NULL DEFAULT 0,
	`summary` text,
	`tags` text,
	`isArchived` boolean NOT NULL DEFAULT false,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversationHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `conversationHistory` ADD CONSTRAINT `conversationHistory_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversationHistory` ADD CONSTRAINT `conversationHistory_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversationHistory` ADD CONSTRAINT `conversationHistory_characterId_characters_id_fk` FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE set null ON UPDATE no action;