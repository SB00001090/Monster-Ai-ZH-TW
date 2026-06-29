import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function migrate() {
  try {
    const pool = mysql.createPool(DATABASE_URL);
    const connection = await pool.getConnection();

    // Read migration SQL
    const sqlPath = path.join(process.cwd(), 'drizzle', '0011_grey_switch.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Split by statement breakpoint and execute each statement
    const statements = sql.split('--> statement-breakpoint').filter(s => s.trim());

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        console.log(`Executing: ${trimmed.substring(0, 50)}...`);
        await connection.execute(trimmed);
      }
    }

    console.log('✅ Migration completed successfully');
    await connection.end();
    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
