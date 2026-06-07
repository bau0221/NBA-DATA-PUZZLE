import fs from 'fs';
import axios from 'axios';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const ids = ["jamesle01", "abdulka01", "malonka01", "bryanko01", "jordami01", "nowitdi01", "chambwi01", "duranke01", "olajuha01", "piercpa01"];
  const updatedPlayers = [];
  for (const id of ids) {
    try {
      console.log(`Fetching stats for ${id}`);
      const statsRes = await axios.get(`http://localhost:3000/api/player-stats?id=${id}`);
      updatedPlayers.push(statsRes.data);
      await sleep(3500); // Wait 3.5s to respect 20req/min
    } catch (e) {
      console.error(e.message);
    }
  }
  
  const output = `// Pre-populated list of legendary players for CPU and puzzle generation
import { Player } from '../types';

export const PLAYERS: Player[] = ${JSON.stringify(updatedPlayers, null, 2)};
`;
  fs.writeFileSync('./src/data/players.ts', output);
  console.log('Updated players.ts');
}

run();
