import Database from 'better-sqlite3';
import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import path from 'path';

const dbPath = path.resolve('./players.db');
const db = new Database(dbPath);

async function run() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  
  for (const letter of letters) {
    console.log(`Crawling letter ${letter}...`);
    try {
      const resp = await gotScraping({
        url: `https://www.basketball-reference.com/players/${letter}/`,
        http2: true
      });
      
      const $ = cheerio.load(resp.body.replace(/<!--|-->/g, ''));
      
      const insert = db.prepare('INSERT OR IGNORE INTO players (id, name, search_name, url, stats) VALUES (?, ?, ?, ?, ?)');
      
      let count = 0;
      $('table#players tbody tr').each((i, el) => {
        const th = $(el).find('th[data-stat="player"]');
        const a = th.find('a');
        if (a.length > 0) {
          const name = a.text().trim();
          const href = a.attr('href') || ''; // e.g. /players/a/abdulka01.html
          const id = href.split('/').pop()?.replace('.html', '');
          
          if (id && href) {
            insert.run(id, name, name.toLowerCase(), href, null);
            count++;
          }
        }
      });
      
      console.log(`Letter ${letter}: Added ${count} players`);
      
      // Delay to avoid ban
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      console.error(`Error on letter ${letter}:`, e.message);
    }
  }
}

run();
