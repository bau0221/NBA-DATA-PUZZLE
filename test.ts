import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';

async function test() {
  const resp = await gotScraping({url:'https://www.basketball-reference.com/players/j/jamesle01.html', http2:true});
  const html = resp.body.replace(/<!--|-->/g, '');
  const $ = cheerio.load(html);
  
  console.log('TFOOT rows:', $('#per_game_stats tfoot tr').length);
  $('#per_game_stats tfoot tr').each((i, el) => {
    const th = $(el).find('th');
    const thText = th.text().trim();
    console.log('Row thText:', thText, 'csk:', th.attr('csk'));
    if (thText === 'Career' || th.attr('csk') === 'Yrs' || thText.includes('Yrs') || thText.includes('Career')) {
        console.log('PTS:', $(el).find('td[data-stat="pts_per_g"]').text());
    }
  });
}
test();
