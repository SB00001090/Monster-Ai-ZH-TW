import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_FORUM_POSTS,
  DEFAULT_FORUM_REPLIES,
  type ForumPost,
  type ForumReply,
} from "../data/forumData";
import { persistenceEnabled } from "./persistentStore";

const DATA_DIR = process.env.MONSTER_DATA_DIR ?? path.join(process.cwd(), ".monster-data");
const FORUM_FILE = path.join(DATA_DIR, "forum-store.json");

type ForumSnapshot = {
  posts: ForumPost[];
  replies: ForumReply[];
  nextPostId: number;
  nextReplyId: number;
};

let posts: ForumPost[] = DEFAULT_FORUM_POSTS.map((p) => ({ ...p, createdAt: new Date(p.createdAt) }));
let replies: ForumReply[] = DEFAULT_FORUM_REPLIES.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
let nextPostId = Math.max(...posts.map((p) => p.id), 0) + 1;
let nextReplyId = Math.max(...replies.map((r) => r.id), 0) + 1;
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleForumPersist() {
  if (!persistenceEnabled()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persistForumStore(), 400);
}

export async function loadForumStore() {
  if (!persistenceEnabled() || loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(FORUM_FILE, "utf-8");
    const data = JSON.parse(raw) as ForumSnapshot;
    posts = data.posts.map((p) => ({ ...p, createdAt: new Date(p.createdAt) }));
    replies = data.replies.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
    nextPostId = data.nextPostId;
    nextReplyId = data.nextReplyId;
    console.log(`[Forum] Loaded data from ${FORUM_FILE}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[Forum] Failed to load store:", error);
    }
  }
}

async function persistForumStore() {
  if (!persistenceEnabled()) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const payload: ForumSnapshot = { posts, replies, nextPostId, nextReplyId };
    await fs.writeFile(FORUM_FILE, JSON.stringify(payload, null, 2), "utf-8");
  } catch (error) {
    console.warn("[Forum] Failed to persist store:", error);
  }
}

export function listForumPosts(categoryId?: number) {
  const filtered = categoryId ? posts.filter((p) => p.categoryId === categoryId) : posts;
  return [...filtered].sort(
    (a, b) =>
      Number(b.isPinned) - Number(a.isPinned) || b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export function getForumPost(postId: number) {
  return posts.find((p) => p.id === postId) ?? null;
}

export function listForumReplies(postId: number) {
  return replies
    .filter((r) => r.postId === postId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function createForumPost(input: Omit<ForumPost, "id" | "likes" | "replyCount" | "isPinned" | "createdAt">) {
  const post: ForumPost = {
    ...input,
    id: nextPostId++,
    likes: 0,
    replyCount: 0,
    isPinned: false,
    createdAt: new Date(),
  };
  posts.unshift(post);
  scheduleForumPersist();
  return post;
}

export function createForumReply(input: Omit<ForumReply, "id" | "likes" | "createdAt">) {
  const post = posts.find((p) => p.id === input.postId);
  if (!post) throw new Error("Post not found");
  const reply: ForumReply = {
    ...input,
    id: nextReplyId++,
    likes: 0,
    createdAt: new Date(),
  };
  replies.push(reply);
  post.replyCount += 1;
  scheduleForumPersist();
  return reply;
}

export function likeForumPost(postId: number) {
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error("Post not found");
  post.likes += 1;
  scheduleForumPersist();
  return post.likes;
}

export function likeForumReply(replyId: number) {
  const reply = replies.find((r) => r.id === replyId);
  if (!reply) throw new Error("Reply not found");
  reply.likes += 1;
  scheduleForumPersist();
  return reply.likes;
}