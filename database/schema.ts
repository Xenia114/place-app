import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 2;

export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;'
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `Версия базы данных ${currentVersion} новее поддерживаемой версии ${DATABASE_VERSION}.`
    );
  }

  await database.withTransactionAsync(async () => {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS marker_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marker_id INTEGER NOT NULL,
        uri TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (marker_id) REFERENCES markers (id) ON DELETE CASCADE
      );
    `);

    const markerColumns = await database.getAllAsync<{ name: string }>(
      'PRAGMA table_info(markers);'
    );
    if (!markerColumns.some(column => column.name === 'name')) {
      await database.execAsync(
        "ALTER TABLE markers ADD COLUMN name TEXT NOT NULL DEFAULT '';"
      );
    }

    await database.runAsync(
      "UPDATE markers SET name = 'Место ' || id WHERE name = '';"
    );
    await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  });
}
