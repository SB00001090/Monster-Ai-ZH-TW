CREATE TABLE `knowledgeBase` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`category` varchar(100),
	`tags` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledgeBase_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userMemories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`characterId` int,
	`memoryType` varchar(50) NOT NULL,
	`content` text NOT NULL,
	`importance` int NOT NULL DEFAULT 5,
	`lastAccessed` timestamp NOT NULL DEFAULT (now()),
	`accessCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userMemories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `knowledgeBase` ADD CONSTRAINT `knowledgeBase_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userMemories` ADD CONSTRAINT `userMemories_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userMemories` ADD CONSTRAINT `userMemories_characterId_characters_id_fk` FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE no action ON UPDATE no action;