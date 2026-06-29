CREATE TABLE `forumCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameEn` varchar(100),
	`nameJa` varchar(100),
	`description` text,
	`icon` varchar(10),
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forumCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forumPosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`language` varchar(10) NOT NULL DEFAULT 'zh',
	`authorName` varchar(50) NOT NULL DEFAULT '匿名',
	`authorHash` varchar(64),
	`userId` int,
	`likes` int NOT NULL DEFAULT 0,
	`replyCount` int NOT NULL DEFAULT 0,
	`isPinned` boolean NOT NULL DEFAULT false,
	`isLocked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forumPosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forumReplies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`content` text NOT NULL,
	`language` varchar(10) NOT NULL DEFAULT 'zh',
	`authorName` varchar(50) NOT NULL DEFAULT '匿名',
	`authorHash` varchar(64),
	`userId` int,
	`likes` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forumReplies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `forumPosts` ADD CONSTRAINT `forumPosts_categoryId_forumCategories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `forumCategories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `forumPosts` ADD CONSTRAINT `forumPosts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `forumReplies` ADD CONSTRAINT `forumReplies_postId_forumPosts_id_fk` FOREIGN KEY (`postId`) REFERENCES `forumPosts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `forumReplies` ADD CONSTRAINT `forumReplies_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;