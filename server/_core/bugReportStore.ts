type BugReportEntry = {
  id: number;
  userId: number;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  url?: string | null;
  userAgent?: string | null;
  adminNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
};

const reports: BugReportEntry[] = [];
let nextId = 1;

export function saveMemoryBugReport(
  userId: number,
  data: {
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    url?: string | null;
    userAgent?: string | null;
  }
): BugReportEntry {
  const now = new Date();
  const entry: BugReportEntry = {
    id: nextId++,
    userId,
    status: "open",
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  reports.unshift(entry);
  return entry;
}

export function getAllMemoryBugReports(): BugReportEntry[] {
  return [...reports].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export function updateMemoryBugReportStatus(
  bugReportId: number,
  status: BugReportEntry["status"],
  adminNotes?: string
): BugReportEntry | undefined {
  const entry = reports.find((r) => r.id === bugReportId);
  if (!entry) return undefined;
  entry.status = status;
  entry.updatedAt = new Date();
  if (adminNotes) entry.adminNotes = adminNotes;
  if (status === "resolved") entry.resolvedAt = new Date();
  return entry;
}