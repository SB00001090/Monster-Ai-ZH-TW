import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./routers/auth";
import { charactersRouter } from "./routers/characters";
import { chatRouter } from "./routers/chat";
import { imageRouter } from "./routers/image";
import { feedbackRouter } from "./routers/feedback";
import { llmRouter } from "./routers/llm";
import {
  agentRouter,
  bugReportsRouter,
  errorManagementRouter,
  errorsRouter,
  forumRouter,
  musicRouter,
  tutorialsRouter,
  verificationRouter,
} from "./routers/stubs";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  chat: chatRouter,
  characters: charactersRouter,
  image: imageRouter,
  feedback: feedbackRouter,
  llm: llmRouter,
  forum: forumRouter,
  tutorials: tutorialsRouter,
  bugReports: bugReportsRouter,
  errors: errorsRouter,
  agent: agentRouter,
  music: musicRouter,
  verification: verificationRouter,
  errorManagement: errorManagementRouter,
});

export type AppRouter = typeof appRouter;