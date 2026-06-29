import fs from "fs";

const snap = JSON.parse(
  fs.readFileSync("drizzle/meta/0019_snapshot.json", "utf8")
);

function mysqlType(col) {
  const t = col.type;
  if (t.startsWith("enum(")) return "mysqlEnum";
  if (t === "boolean") return "boolean";
  if (t.startsWith("varchar")) return "varchar";
  if (t === "text") return "text";
  if (t === "int" || t.startsWith("int(")) return "int";
  if (t === "timestamp") return "timestamp";
  return "text";
}

function parseLen(t) {
  const m = t.match(/varchar\((\d+)\)/);
  return m ? Number(m[1]) : 255;
}

function parseEnum(t) {
  return t
    .slice(5, -1)
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""));
}

function formatDefault(col) {
  if (col.default === undefined || col.default === null) return "";
  if (col.default === "(now())") return ".defaultNow()";
  if (typeof col.default === "string") {
    return `.default('${col.default.replace(/'/g, "\\'")}')`;
  }
  return `.default(${col.default})`;
}

let out =
  "import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, boolean } from 'drizzle-orm/mysql-core';\n\n";

for (const [name, table] of Object.entries(snap.tables)) {
  out += `export const ${name} = mysqlTable('${name}', {\n`;
  for (const [colName, col] of Object.entries(table.columns)) {
    const type = mysqlType(col);
    let line = `  ${colName}: `;
    if (type === "mysqlEnum") {
      line += `mysqlEnum('${colName}', ${JSON.stringify(parseEnum(col.type))})`;
    } else if (type === "varchar") {
      line += `varchar('${colName}', { length: ${parseLen(col.type)} })`;
    } else {
      line += `${type}('${colName}')`;
    }
    if (col.primaryKey) line += ".primaryKey()";
    if (col.autoincrement) line += ".autoincrement()";
    if (col.notNull && !col.primaryKey) line += ".notNull()";
    line += formatDefault(col);
    out += `${line},\n`;
  }
  out += "});\n\n";
}

out += `export const temporaryAccounts = mysqlTable('temporaryAccounts', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const f2fVerifications = mysqlTable('f2fVerifications', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  facePhotoUrl: text('facePhotoUrl'),
  livenessCheckUrl: text('livenessCheckUrl'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const f2fVerificationLogs = mysqlTable('f2fVerificationLogs', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  verificationId: int('verificationId').notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

`;

for (const name of Object.keys(snap.tables)) {
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  out += `export type ${pascal} = typeof ${name}.$inferSelect;\n`;
  out += `export type Insert${pascal} = typeof ${name}.$inferInsert;\n`;
}
out += "export type User = typeof users.$inferSelect;\n";
out += "export type InsertUser = typeof users.$inferInsert;\n";
out += "export type Character = typeof characters.$inferSelect;\n";
out += "export type InsertCharacter = typeof characters.$inferInsert;\n";

fs.writeFileSync("drizzle/schema.ts", out);
console.log("Wrote drizzle/schema.ts");