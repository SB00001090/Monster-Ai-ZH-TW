export type MemoryFeedbackEntry = {
  id: number;
  messageId: number;
  userId: number;
  rating: number;
  comment?: string | null;
  tags?: string | null;
  sentiment: "positive" | "neutral" | "negative";
  createdAt: Date;
};

const entries: MemoryFeedbackEntry[] = [];
let nextId = 1;

export function saveMemoryFeedback(
  data: Omit<MemoryFeedbackEntry, "id" | "createdAt">
): MemoryFeedbackEntry {
  const entry: MemoryFeedbackEntry = {
    id: nextId++,
    createdAt: new Date(),
    ...data,
  };
  entries.unshift(entry);
  return entry;
}

export function getMemoryUserFeedback(userId: number): MemoryFeedbackEntry[] {
  return entries.filter((e) => e.userId === userId);
}

export function getMemoryAverageRating(userId: number): number | null {
  const userEntries = entries.filter((e) => e.userId === userId);
  if (userEntries.length === 0) return null;
  const avg = userEntries.reduce((sum, f) => sum + f.rating, 0) / userEntries.length;
  return Math.round(avg * 10) / 10;
}