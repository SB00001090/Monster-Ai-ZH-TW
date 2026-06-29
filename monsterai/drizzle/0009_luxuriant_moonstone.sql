CREATE TABLE `tutorialProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tutorialId` int NOT NULL,
	`status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tutorialProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tutorials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(100) NOT NULL,
	`order` int NOT NULL DEFAULT 0,
	`content` text NOT NULL,
	`videoUrl` varchar(500),
	`estimatedTime` int NOT NULL DEFAULT 5,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tutorials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tutorialProgress` ADD CONSTRAINT `tutorialProgress_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tutorialProgress` ADD CONSTRAINT `tutorialProgress_tutorialId_tutorials_id_fk` FOREIGN KEY (`tutorialId`) REFERENCES `tutorials`(`id`) ON DELETE cascade ON UPDATE no action;