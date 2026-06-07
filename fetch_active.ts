import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function run() {
  try {
    console.log('Fetching per game...');
    const perGameRes = await axios.get('https://www.basketball-reference.com/leagues/NBA_2026_per_game.html', {headers: {'User-Agent': 'Mozilla/5.0'}});
    console.log('Fetching totals...');
    const totalsRes = await axios.get('https://www.basketball-reference.com/leagues/NBA_2026_totals.html', {headers: {'User-Agent': 'Mozilla/5.0'}});

    const $pg = cheerio.load(perGameRes.data.replace(/<!--|-->/g, ''));
    const $tot = cheerio.load(totalsRes.data.replace(/<!--|-->/g, ''));

    const playersMap = {};

    $pg('table#per_game_stats tbody tr').each((i, el) => {
      if ($pg(el).hasClass('thead')) return;
      const $td = $pg(el).find('td[data-stat="name_display"]');
      if ($td.length === 0) return; // Might be empty row

      const id = $td.attr('data-append-csv');
      if (!id) return;
      if (playersMap[id]) return; // Handle traded players (TOT is usually first or we just take the first entry)

      const name = $td.find('a').text();
      const posText = $pg(el).find('td[data-stat="pos"]').text();
      let position = 'Unknown';
      if (posText.includes('G')) position = 'Guard';
      else if (posText.includes('F')) position = 'Forward';
      else if (posText.includes('C')) position = 'Center';

      const pts_per_g = parseFloat($pg(el).find('td[data-stat="pts_per_g"]').text()) || 0;
      const trb_per_g = parseFloat($pg(el).find('td[data-stat="trb_per_g"]').text()) || 0;
      const ast_per_g = parseFloat($pg(el).find('td[data-stat="ast_per_g"]').text()) || 0;
      const stl_per_g = parseFloat($pg(el).find('td[data-stat="stl_per_g"]').text()) || 0;
      const blk_per_g = parseFloat($pg(el).find('td[data-stat="blk_per_g"]').text()) || 0;
      const fg_pct = (parseFloat($pg(el).find('td[data-stat="fg_pct"]').text()) || 0) * 100;
      const fg3_pct = (parseFloat($pg(el).find('td[data-stat="fg3_pct"]').text()) || 0) * 100;

      playersMap[id] = {
        id,
        player_name: name,
        position,
        data: {
          PTS: { career_total: 0, career_average: pts_per_g, peak_season: pts_per_g },
          REB: { career_total: 0, career_average: trb_per_g, peak_season: trb_per_g },
          AST: { career_total: 0, career_average: ast_per_g, peak_season: ast_per_g },
          STL: { career_total: 0, career_average: stl_per_g, peak_season: stl_per_g },
          BLK: { career_total: 0, career_average: blk_per_g, peak_season: blk_per_g },
          FG_PCT: { career_total: 0, career_average: fg_pct, peak_season: fg_pct },
          FG3_PCT: { career_total: 0, career_average: fg3_pct, peak_season: fg3_pct }
        }
      };
    });

    $tot('table#totals_stats tbody tr').each((i, el) => {
       if ($tot(el).hasClass('thead')) return;
       const $td = $tot(el).find('td[data-stat="name_display"]');
       const id = $td.attr('data-append-csv');
       if (!id || !playersMap[id]) return;

       const pts = parseFloat($tot(el).find('td[data-stat="pts"]').text()) || 0;
       const trb = parseFloat($tot(el).find('td[data-stat="trb"]').text()) || 0;
       const ast = parseFloat($tot(el).find('td[data-stat="ast"]').text()) || 0;
       const stl = parseFloat($tot(el).find('td[data-stat="stl"]').text()) || 0;
       const blk = parseFloat($tot(el).find('td[data-stat="blk"]').text()) || 0;

       // Only update if it's currently 0 (in case multiple rows for traded player)
       if (playersMap[id].data.PTS.career_total === 0) {
           playersMap[id].data.PTS.career_total = pts;
           playersMap[id].data.REB.career_total = trb;
           playersMap[id].data.AST.career_total = ast;
           playersMap[id].data.STL.career_total = stl;
           playersMap[id].data.BLK.career_total = blk;
       }
    });

    const activePlayers = Object.values(playersMap);
    console.log(`Parsed ${activePlayers.length} players`);

    fs.writeFileSync('./src/data/activePlayers.ts', `import { Player } from '../types';\n\nexport const ACTIVE_PLAYERS: Player[] = ${JSON.stringify(activePlayers, null, 2)};\n`);
    console.log('Saved to src/data/activePlayers.ts');

  } catch (err) {
    console.error(err);
  }
}
run();
