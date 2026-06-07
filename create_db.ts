import Database from 'better-sqlite3';
import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('./players.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT,
    search_name TEXT,
    url TEXT,
    stats TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_search_name ON players(search_name);
`);

console.log('DB initialized at', dbPath);
