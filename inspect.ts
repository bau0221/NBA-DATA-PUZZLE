import * as cheerio from 'cheerio';
import fs from 'fs';

const html = fs.readFileSync('test.html', 'utf8');
const $ = cheerio.load(html);
const firstRow = $('table#per_game_stats tbody tr:not(.thead)').first();
console.log(firstRow.html());
