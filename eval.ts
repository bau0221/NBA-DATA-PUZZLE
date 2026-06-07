import axios from "axios";
import * as cheerio from "cheerio";

axios.get('https://www.basketball-reference.com/players/j/jamesle01.html', {headers: {'User-Agent': 'Mozilla/5.0'}}).then(res => {
  const htmlData = res.data.replace(/<!--|-->/g, '');
  const $ = cheerio.load(htmlData);
  const p = $('p:contains("Position:")').text();
  console.log('Position:', p.replace(/\s+/g, ' '));
  
  // Per game stats
  let careerStlAvg = 0, careerBlkAvg = 0, careerFgAvg = 0, careerFg3Avg = 0;
  let peakStl = 0, peakBlk = 0, peakFg = 0, peakFg3 = 0;

  $('#per_game_stats tbody tr').each((i, el) => {
    const stl = parseFloat($(el).find('td[data-stat="stl_per_g"]').text()) || 0;
    const blk = parseFloat($(el).find('td[data-stat="blk_per_g"]').text()) || 0;
    const fg_pct = parseFloat($(el).find('td[data-stat="fg_pct"]').text()) || 0;
    const fg3_pct = parseFloat($(el).find('td[data-stat="fg3_pct"]').text()) || 0;
    if (stl > peakStl) peakStl = stl;
    if (blk > peakBlk) peakBlk = blk;
    if (fg_pct > peakFg) peakFg = fg_pct;
    if (fg3_pct > peakFg3) peakFg3 = fg3_pct;
  });

  $('#per_game_stats tfoot tr').each((i, el) => {
      const th = $(el).find('th');
      const thText = th.text().trim();
      const csk = th.attr('csk');
      if (thText === 'Career' || csk === 'Yrs') {
          $(el).find('td').each((j, td) => {
              const stat = $(td).attr('data-stat');
              const val = parseFloat($(td).text()) || 0;
              if (stat === 'stl_per_g') careerStlAvg = val;
              if (stat === 'blk_per_g') careerBlkAvg = val;
              if (stat === 'fg_pct') careerFgAvg = val;
              if (stat === 'fg3_pct') careerFg3Avg = val;
          });
      }
  });

  console.log('Career Avg:', careerStlAvg, careerBlkAvg, careerFgAvg, careerFg3Avg);
  console.log('Peak:', peakStl, peakBlk, peakFg, peakFg3);
}).catch(e => console.error(e.message));
