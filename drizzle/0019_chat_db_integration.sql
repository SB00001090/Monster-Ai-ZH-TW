ALTER TABLE `characters` ADD `pythonId` varchar(255);
--> statement-breakpoint
ALTER TABLE `conversations` ADD `characterId` int;
--> statement-breakpoint
ALTER TABLE `conversations` ADD `pythonSessionId` varchar(255);