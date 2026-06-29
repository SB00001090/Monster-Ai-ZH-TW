CREATE TABLE `characterAnalytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`characterId` int NOT NULL,
	`userId` int NOT NULL,
	`conversationCount` int NOT NULL DEFAULT 0,
	`messageCount` int NOT NULL DEFAULT 0,
	`totalUsageTime` int NOT NULL DEFAULT 0,
	`averageRating` int NOT NULL DEFAULT 0,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `characterAnalytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `characterRatings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`characterId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `characterRatings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `characterTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`worldview` text NOT NULL,
	`openingLine` text NOT NULL,
	`systemPrompt` text NOT NULL,
	`category` varchar(100) NOT NULL,
	`avatar` varchar(500),
	`usageCount` int NOT NULL DEFAULT 0,
	`averageRating` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `characterTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `characterAnalytics` ADD CONSTRAINT `characterAnalytics_characterId_characters_id_fk` FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `characterAnalytics` ADD CONSTRAINT `characterAnalytics_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `characterRatings` ADD CONSTRAINT `characterRatings_characterId_characters_id_fk` FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `characterRatings` ADD CONSTRAINT `characterRatings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;