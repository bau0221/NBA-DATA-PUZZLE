import axios from 'axios';
import fs from 'fs';

async function run() {
  try {
    const perGameRes = await axios.get('https://www.basketball-reference.com/leagues/NBA_2024_per_game.html', {headers: {'User-Agent': 'Mozilla/5.0'}});
    console.log(perGameRes.status, perGameRes.data.length);
    fs.writeFileSync('test.html', perGameRes.data);
  } catch (e) {
    console.error(e.response?.status, e.message);
  }
}
run();
