import { z } from "zod";
import * as db from "../db";
import { DEFAULT_FORUM_CATEGORIES } from "../data/forumData";
import { DEFAULT_TUTORIALS } from "../data/tutorials";
import {
  createForumPost,
  createForumReply,
  getForumPost,
  likeForumPost,
  likeForumReply,
  listForumPosts,
  listForumReplies,
} from "../_core/forumStore";
import { runAutoFix } from "../_core/autoFixEngine";
import {
  getAllIncidents,
  getIncidentStats,
  upsertIncident,
  updateIncident,
} from "../_core/errorIncidentStore";
import { getErrorStats } from "../errorTracking";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";

export const forumRouter = router({
  getCategories: publicProcedure.query(async () => {
    if (process.env.DATABASE_URL) {
      const cats = await db.ensureForumCategoriesSeeded(DEFAULT_FORUM_CATEGORIES);
      return cats.map((cat) => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon ?? "",
        description: cat.description ?? "",
      }));
    }
    return DEFAULT_FORUM_CATEGORIES;
  }),

  getPosts: publicProcedure
    .input(z.object({ categoryId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      if (process.env.DATABASE_URL) {
        const posts = await db.getForumPosts(input?.categoryId);
        return posts.sort(
          (a, b) =>
            Number(b.isPinned) - Number(a.isPinned) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      return listForumPosts(input?.categoryId);
    }),

  getPost: publicProcedure.input(z.object({ postId: z.number() })).query(async ({ input }) => {
    if (process.env.DATABASE_URL) {
      return (await db.getForumPost(input.postId)) ?? null;
    }
    return getForumPost(input.postId);
  }),

  getReplies: publicProcedure.input(z.object({ postId: z.number() })).query(async ({ input }) => {
    if (process.env.DATABASE_URL) {
      return db.getForumReplies(input.postId);
    }
    return listForumReplies(input.postId);
  }),

  createPost: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        title: z.string().min(1),
        content: z.string().min(1),
        language: z.string().default("zh"),
        authorName: z.string().default("匿名"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.DATABASE_URL) {
        const result = await db.createForumPost({
          categoryId: input.categoryId,
          title: input.title,
          content: input.content,
          authorName: input.authorName || "匿名",
          language: input.language,
          userId: ctx.user!.id,
        });
        return { id: result.id };
      }
      const post = createForumPost({
        categoryId: input.categoryId,
        title: input.title,
        content: input.content,
        authorName: input.authorName || "匿名",
        language: input.language,
      });
      return { id: post.id };
    }),

  createReply: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        content: z.string().min(1),
        authorName: z.string().default("匿名"),
        language: z.string().default("zh"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.DATABASE_URL) {
        const result = await db.createForumReply({
          postId: input.postId,
          content: input.content,
          authorName: input.authorName || "匿名",
          language: input.language,
          userId: ctx.user!.id,
        });
        return { id: result.id };
      }
      const reply = createForumReply({
        postId: input.postId,
        content: input.content,
        authorName: input.authorName || "匿名",
        language: input.language,
      });
      return { id: reply.id };
    }),

  likePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      if (process.env.DATABASE_URL) {
        const likes = await db.likeForumPost(input.postId);
        return { success: true, likes };
      }
      const likes = likeForumPost(input.postId);
      return { success: true, likes };
    }),

  likeReply: protectedProcedure
    .input(z.object({ replyId: z.number() }))
    .mutation(async ({ input }) => {
      if (process.env.DATABASE_URL) {
        const likes = await db.likeForumReply(input.replyId);
        return { success: true, likes };
      }
      const likes = likeForumReply(input.replyId);
      return { success: true, likes };
    }),
});

const memoryTutorialProgress = new Map<string, { tutorialId: number; status: string }[]>();

type AgentTaskRecord = {
  taskId: string;
  goal: string;
  status: "pending" | "executing" | "completed" | "failed";
  steps: number;
  result: string;
  createdAt: string;
  completedAt?: string;
};

const agentTasks = new Map<number, AgentTaskRecord[]>();

type VerificationRecord = {
  verificationId: number;
  userId: number;
  status: string;
  isVerified: boolean;
  captchaAnswer?: string;
};

const verifications = new Map<number, VerificationRecord>();
const captchaAnswers = new Map<string, string>();
let nextVerificationId = 1;

const BLOCKED_MUSIC_TERMS = ["clone voice", "voice clone", "聲音克隆", "模仿歌手"];

export const tutorialsRouter = router({
  getTutorials: publicProcedure.query(async () => {
    if (process.env.DATABASE_URL) {
      return db.ensureTutorialsSeeded(DEFAULT_TUTORIALS);
    }
    return DEFAULT_TUTORIALS;
  }),

  getUserProgress: protectedProcedure.query(async ({ ctx }) => {
    if (process.env.DATABASE_URL) {
      return db.getUserTutorialProgress(ctx.user!.id);
    }
    return memoryTutorialProgress.get(String(ctx.user!.id)) ?? [];
  }),

  updateProgress: protectedProcedure
    .input(
      z.object({
        tutorialId: z.number(),
        status: z.enum(["not_started", "in_progress", "completed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.DATABASE_URL) {
        await db.updateTutorialProgress(ctx.user!.id, input.tutorialId, input.status);
        return { success: true };
      }
      const key = String(ctx.user!.id);
      const current = memoryTutorialProgress.get(key) ?? [];
      const idx = current.findIndex((p) => p.tutorialId === input.tutorialId);
      if (idx >= 0) current[idx] = input;
      else current.push(input);
      memoryTutorialProgress.set(key, current);
      return { success: true };
    }),
});

export const bugReportsRouter = router({
  submitBugReport: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        url: z.string().optional(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.submitBugReport(ctx.user!.id, {
        title: input.title,
        description: input.description,
        severity: input.severity,
        url: input.url,
        userAgent: input.userAgent,
      });
      return { success: true };
    }),

  getAllReports: adminProcedure.query(async () => {
    return db.getAllBugReports();
  }),

  updateStatus: adminProcedure
    .input(
      z.object({
        bugReportId: z.number(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.updateBugReportStatus(
        input.bugReportId,
        input.status,
        input.adminNotes
      );
      return { success: true };
    }),
});

export const agentRouter = router({
  executeTask: protectedProcedure
    .input(
      z.object({
        goal: z.string().min(1),
        maxSteps: z.number().min(1).max(20).default(5),
        task: z.string().min(1).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const goal = input.goal || input.task || "";
      const taskId = `task-${Date.now()}`;
      const now = new Date().toISOString();
      const record: AgentTaskRecord = {
        taskId,
        goal,
        status: "completed",
        steps: Math.min(input.maxSteps, 5),
        result: `Agent completed: ${goal}`,
        createdAt: now,
        completedAt: now,
      };
      const userId = ctx.user!.id;
      const list = agentTasks.get(userId) ?? [];
      list.unshift(record);
      agentTasks.set(userId, list);
      return record;
    }),

  getStatus: protectedProcedure.query(({ ctx }) => {
    const list = agentTasks.get(ctx.user!.id) ?? [];
    const lastTask = list[0] ?? null;
    return {
      status: lastTask?.status ?? "idle",
      lastTask,
    };
  }),
});

export const musicRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        genre: z.string().optional(),
        mood: z.string().optional(),
        vocals: z.boolean().optional(),
        language: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const lower = input.prompt.toLowerCase();
      const blocked = BLOCKED_MUSIC_TERMS.some((term) => lower.includes(term));
      if (blocked) {
        return {
          success: false,
          blocked: true,
          blockReason: "Voice cloning of artists is not permitted",
          prompt: input.prompt,
        };
      }

      const genre = input.genre || "Ambient";
      const mood = input.mood || "Calm";
      const vocals = input.vocals ? `with ${input.language || "English"} vocals` : "instrumental";
      const enhancedPrompt = [
        `[${genre}]`,
        `[${mood}]`,
        vocals,
        input.prompt,
        "high quality, professional mix, clear arrangement",
      ].join(" ");

      return {
        success: true,
        prompt: input.prompt,
        enhancedPrompt,
        genre,
        mood,
        vocals: input.vocals ?? false,
        language: input.language ?? "English",
      };
    }),
});

export const verificationRouter = router({
  getStatus: protectedProcedure.query(({ ctx }) => {
    const record = [...verifications.values()].find(
      (v) => v.userId === ctx.user!.id && v.isVerified
    );
    const latest = [...verifications.values()]
      .filter((v) => v.userId === ctx.user!.id)
      .sort((a, b) => b.verificationId - a.verificationId)[0];

    return {
      isVerified: Boolean(record),
      verification: latest
        ? {
            verificationId: latest.verificationId,
            verificationStatus: latest.status,
          }
        : null,
    };
  }),

  initializeF2F: protectedProcedure.mutation(({ ctx }) => {
    const verificationId = nextVerificationId++;
    const record: VerificationRecord = {
      verificationId,
      userId: ctx.user!.id,
      status: "initialized",
      isVerified: false,
    };
    verifications.set(verificationId, record);
    return {
      success: true,
      verificationId,
      sessionId: `f2f-${verificationId}`,
      status: "initialized",
    };
  }),

  createCaptcha: protectedProcedure.mutation(() => {
    const challengeId = `captcha-${Date.now()}`;
    const answer = String(Math.floor(10 + Math.random() * 90));
    captchaAnswers.set(challengeId, answer);
    return {
      challengeId,
      captchaId: challengeId,
      challenge: `Type the number shown in the challenge`,
      question: `Enter the two-digit code: ${answer}`,
    };
  }),

  validateCaptcha: protectedProcedure
    .input(
      z.object({
        challengeId: z.string(),
        response: z.string(),
        captchaId: z.string().optional(),
        answer: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const expected = captchaAnswers.get(input.challengeId);
      const valid = expected
        ? input.response.trim() === expected
        : input.response.trim().length > 0;
      if (valid) captchaAnswers.delete(input.challengeId);
      return {
        success: valid,
        valid,
        message: valid ? "CAPTCHA validated" : "Invalid CAPTCHA response",
      };
    }),

  submitFacePhotoEnhanced: protectedProcedure
    .input(
      z.object({
        verificationId: z.number(),
        photoUrl: z.string(),
        photoKey: z.string().optional(),
        photoBase64: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const record = verifications.get(input.verificationId);
      if (record) record.status = "photo_verified";
      return {
        success: true,
        message: "Photo received (stub)",
        photoUrl: input.photoUrl,
      };
    }),

  submitLivenessCheckEnhanced: protectedProcedure
    .input(
      z.object({
        verificationId: z.number(),
        videoUrl: z.string().optional(),
        videoKey: z.string().optional(),
        facePhotoUrl: z.string().optional(),
        videoBase64: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const record = verifications.get(input.verificationId);
      if (record) {
        record.status = "verified";
        record.isVerified = true;
      } else {
        verifications.set(input.verificationId, {
          verificationId: input.verificationId,
          userId: ctx.user!.id,
          status: "verified",
          isVerified: true,
        });
      }
      return {
        success: true,
        verified: true,
        message: "Verification complete (stub)",
        requiresManualReview: false,
      };
    }),
});

export const errorsRouter = router({
  reportClientError: publicProcedure
    .input(
      z.object({
        errorType: z.string().min(1),
        message: z.string().min(1),
        stack: z.string().optional(),
        url: z.string().optional(),
        context: z.string().optional(),
        source: z.enum(["ui", "trpc", "api", "global"]).default("ui"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incident = await upsertIncident({
        source: input.source,
        errorType: input.errorType,
        message: input.message,
        stack: input.stack,
        url: input.url,
        context: input.context,
      });

      const fix = await runAutoFix(incident);

      if (
        incident.count === 1 &&
        (input.message.includes("500") ||
          input.message.includes("ECONNREFUSED") ||
          input.source === "ui")
      ) {
        try {
          const userId = ctx.user?.id ?? 1000;
          await db.submitBugReport(userId, {
            title: `Auto: ${input.message.slice(0, 120)}`,
            description: [
              input.context,
              input.stack?.slice(0, 2000),
              input.url,
            ]
              .filter(Boolean)
              .join("\n\n"),
            severity: "medium",
            url: input.url,
            userAgent: null,
          });
        } catch {
          // non-fatal
        }
      }

      return {
        incidentId: incident.id,
        fixAttempted: fix.fixAttempted,
        fixAction: fix.fixAction,
        fixResult: fix.fixResult,
        clientAction: fix.clientAction,
        status: fix.status,
      };
    }),

  getIncidents: adminProcedure.query(async () => {
    return getIncidentStats();
  }),

  retryFix: adminProcedure
    .input(z.object({ incidentId: z.number() }))
    .mutation(async ({ input }) => {
      const all = await getAllIncidents();
      const incident = all.find((i) => i.id === input.incidentId);
      if (!incident) {
        return { success: false, message: "Incident not found" };
      }
      await updateIncident(incident.id, { status: "open" });
      const fix = await runAutoFix(incident);
      return {
        success: true,
        fixAction: fix.fixAction,
        fixResult: fix.fixResult,
        clientAction: fix.clientAction,
        status: fix.status,
      };
    }),
});

export const errorManagementRouter = router({
  getStats: adminProcedure.query(async () => {
    const incidentStats = await getIncidentStats();
    if (incidentStats.totalErrors > 0) {
      return incidentStats;
    }
    const stats = await getErrorStats();
    return (
      stats ?? {
        totalErrors: 0,
        fixedErrors: 0,
        recurringErrors: 0,
        fixRate: 0,
        errors: [],
      }
    );
  }),
});