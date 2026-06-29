CREATE TABLE `errorFixes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`errorType` varchar(255) NOT NULL,
	`errorMessage` text NOT NULL,
	`fixType` varchar(100) NOT NULL,
	`fixData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `errorFixes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `errorLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`errorType` varchar(255) NOT NULL,
	`errorMessage` text NOT NULL,
	`errorStack` text,
	`context` varchar(255) NOT NULL DEFAULT 'unknown',
	`occurrenceCount` int NOT NULL DEFAULT 1,
	`lastOccurredAt` timestamp NOT NULL DEFAULT (now()),
	`isFixed` int NOT NULL DEFAULT 0,
	`fixApplied` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `errorLogs_id` PRIMARY KEY(`id`)
);
