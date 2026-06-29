-- Fix characters table column names to use camelCase
-- Drop the table and recreate it with proper column names
DROP TABLE IF EXISTS `characters`;
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`worldview` text NOT NULL,
	`openingLine` text NOT NULL,
	`systemPrompt` text,
	`isPublic` int NOT NULL DEFAULT 0,
	`averageRating` int NOT NULL DEFAULT 0,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `characters_id` PRIMARY KEY(`id`),
	CONSTRAINT `characters_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
