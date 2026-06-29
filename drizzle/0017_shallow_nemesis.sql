CREATE TABLE `developerVerifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`verificationToken` varchar(255) NOT NULL,
	`status` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
	`verifiedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `developerVerifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `developerVerifications_verificationToken_unique` UNIQUE(`verificationToken`)
);
--> statement-breakpoint
ALTER TABLE `developerVerifications` ADD CONSTRAINT `developerVerifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;