import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbPath = path.resolve(process.cwd(), "data", "labs.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS labs_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tool TEXT,
    tool_name TEXT,
    container_id TEXT NOT NULL,
    container_name TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_labs_history_user_status
  ON labs_history (user_id, status);

  CREATE INDEX IF NOT EXISTS idx_labs_history_expires_at
  ON labs_history (expires_at);
`);

const tableColumns = db.prepare("PRAGMA table_info(labs_history)").all();
if (!tableColumns.some((column) => column.name === "tool")) {
  db.exec("ALTER TABLE labs_history ADD COLUMN tool TEXT");
}
if (!tableColumns.some((column) => column.name === "port")) {
  db.exec("ALTER TABLE labs_history ADD COLUMN port TEXT");
}
if (!tableColumns.some((column) => column.name === "port_map")) {
  db.exec("ALTER TABLE labs_history ADD COLUMN port_map TEXT");
}

const statements = {
  insertLab: db.prepare(`
    INSERT INTO labs_history (
      id, user_id, tool, tool_name, container_id, container_name, status, created_at, expires_at, port, port_map
    ) VALUES (
      @id, @user_id, @tool, @tool_name, @container_id, @container_name, @status, @created_at, @expires_at, @port, @port_map
    )
  `),
  getLabById: db.prepare(`
    SELECT id, user_id, tool, tool_name, container_id, container_name, status, created_at, expires_at, port, port_map
    FROM labs_history
    WHERE id = ?
  `),
  getRunningLabsByUser: db.prepare(`
    SELECT id, user_id, tool, tool_name, container_id, container_name, status, created_at, expires_at, port, port_map
    FROM labs_history
    WHERE user_id = ? AND status = 'running'
    ORDER BY created_at DESC
  `),
  getExpiredRunningLabs: db.prepare(`
    SELECT id, user_id, tool, tool_name, container_id, container_name, status, created_at, expires_at, port, port_map
    FROM labs_history
    WHERE status = 'running' AND expires_at <= ?
    ORDER BY expires_at ASC
  `),
  getAllRunningLabs: db.prepare(`
    SELECT id, user_id, tool, tool_name, container_id, container_name, status, created_at, expires_at, port, port_map
    FROM labs_history
    WHERE status = 'running'
    ORDER BY created_at DESC
  `),
  updateLabStatus: db.prepare(`
    UPDATE labs_history
    SET status = @status
    WHERE id = @id
  `),
};

export function createLabRecord(record) {
  statements.insertLab.run(record);
  return record;
}

export function getLabRecordById(id) {
  return statements.getLabById.get(id) ?? null;
}

export function getRunningLabsByUser(userId) {
  return statements.getRunningLabsByUser.all(userId);
}

export function getExpiredRunningLabs(nowIso) {
  return statements.getExpiredRunningLabs.all(nowIso);
}

export function getAllRunningLabs() {
  return statements.getAllRunningLabs.all();
}

export function updateLabStatus(id, status) {
  statements.updateLabStatus.run({ id, status });
}

export { db };
