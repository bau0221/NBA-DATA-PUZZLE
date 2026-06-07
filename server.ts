import express from "express";
import path from "path";
import * as cheerio from "cheerio";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Scraper: Search Player
  app.get("/api/search-player", async (req, res) => {
    const query = req.query.name as string;
    if (!query) return res.status(400).json({ error: "Missing query" });

    try {
      // 1. Local SQLite Search first for instant results
      const Database = (await import("better-sqlite3")).default;
      const db = new Database(path.resolve('./players.db'));
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
      
      const localResults = db.prepare(`SELECT id, name, url FROM players WHERE search_name LIKE ? LIMIT 15`).all(`%${query.toLowerCase()}%`) as any[];
      
      if (localResults.length > 0) {
        return res.json(localResults.map(r => ({
          name: r.name,
          id: r.id,
          url: `https://www.basketball-reference.com${r.url}`
        })));
      }

      // 2. Fallback to live scrape if not found in db (e.g. new players)
      const { gotScraping } = await import("got-scraping");
      const searchUrl = `https://www.basketball-reference.com/search/search.fcgi?search=${encodeURIComponent(query)}`;
      const response = await gotScraping({
        url: searchUrl,
        http2: true
      });

      if (response.statusCode !== 200) {
        console.error(`gotScraping failed with status: ${response.statusCode} for url: ${searchUrl}`);
        return res.json({ error: `搜尋球員失敗: ${response.statusCode}` });
      }

      // Check if redirected directly
      if (response.url && response.url.includes("/players/")) {
        const url = response.url;
        const pid = url.split('/').pop()?.replace('.html', '') || '';
        const $ = cheerio.load(response.body);
        let nameText = $('h1').text().trim() || $('title').text().split(' Stats')[0].trim();
        return res.json([{ name: nameText, id: pid, url }]);
      }

      const $ = cheerio.load(response.body);
      const seenPids = new Set<string>();
      const results: any[] = [];
      $('.search-results .search-item').each((i, el) => {
         const link = $(el).find('a').first();
         const href = link.attr('href') || '';
         if (href.includes('/players/')) {
           const pid = href.split('/').pop()?.replace('.html', '') || '';
           if (pid && !seenPids.has(pid)) {
             seenPids.add(pid);
             let name = link.text().trim();
             results.push({ name, id: pid, url: `https://www.basketball-reference.com${href}` });
           }
         }
      });
      res.json(results);
    } catch (err) {
      console.error(err);
      res.json({ error: "Failed to search players" });
    }
  });

  app.get("/api/player-stats", async (req, res) => {
      const pid = req.query.id as string;
      if (!pid) return res.status(400).json({ error: "Missing player ID" });
      
      const char = pid.charAt(0).toLowerCase();
      const url = `https://www.basketball-reference.com/players/${char}/${pid}.html`;
      
      try {
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(path.resolve('./players.db'));
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
        const row = db.prepare(`SELECT stats FROM players WHERE id=?`).get(pid) as any;
        
        // If previously crawled, return directly from SQLite!
        if (row && row.stats) {
          return res.json(JSON.parse(row.stats));
        }

        const { gotScraping } = await import("got-scraping");
        const response = await gotScraping({ url, http2: true });

        if (response.statusCode !== 200) {
            console.error(`gotScraping failed with status: ${response.statusCode} for url: ${url}`);
            return res.json({ error: `獲取球員數據失敗: ${response.statusCode}` });
        }

        const htmlData = response.body.replace(/<!--|-->/g, '');
        const $ = cheerio.load(htmlData);

        let name = $('h1').find('span').text().trim() || $('h1').text().trim();
        name = name.replace(/\s*\(\d{4}-\d{4}\)/, '').trim();

        // Extract Position
        const posText = $('p:contains("Position:")').text().replace(/Position:/g, '').trim();
        let position = 'Unknown';
        if (posText.includes('Guard')) position = 'Guard';
        if (posText.includes('Forward')) position = 'Forward';
        if (posText.includes('Center')) position = 'Center';
        // (If multiple, first match wins or we can look at the very first word)
        const primaryPosMatch = posText.match(/(Guard|Forward|Center)/);
        if (primaryPosMatch) {
            position = primaryPosMatch[1];
        }
        
        let careerPtsTotal = 0, careerTrbTotal = 0, careerAstTotal = 0;
        let careerStlTotal = 0, careerBlkTotal = 0;

        $('#totals_stats tfoot tr').each((i, el) => {
            const th = $(el).find('th');
            const thText = th.text().trim();
            const csk = th.attr('csk');
            if (thText === 'Career' || csk === 'Yrs') {
                $(el).find('td').each((j, td) => {
                    const stat = $(td).attr('data-stat');
                    const val = parseFloat($(td).text()) || 0;
                    if (stat === 'pts') careerPtsTotal = val;
                    if (stat === 'trb') careerTrbTotal = val;
                    if (stat === 'ast') careerAstTotal = val;
                    if (stat === 'stl') careerStlTotal = val;
                    if (stat === 'blk') careerBlkTotal = val;
                });
            }
        });
        
        if (!careerPtsTotal && $('#totals_stats tfoot tr').length > 0) {
           $('#totals_stats tfoot tr').first().find('td').each((j, td) => {
                const stat = $(td).attr('data-stat');
                const val = parseFloat($(td).text()) || 0;
                if (stat === 'pts') careerPtsTotal = val;
                if (stat === 'trb') careerTrbTotal = val;
                if (stat === 'ast') careerAstTotal = val;
                if (stat === 'stl') careerStlTotal = val;
                if (stat === 'blk') careerBlkTotal = val;
            });
        }

        let careerPtsAvg = 0, careerTrbAvg = 0, careerAstAvg = 0;
        let careerStlAvg = 0, careerBlkAvg = 0, careerFgAvg = 0, careerFg3Avg = 0;
        let peakPts = 0, peakTrb = 0, peakAst = 0;
        let peakStl = 0, peakBlk = 0, peakFg = 0, peakFg3 = 0;

        $('#per_game_stats tbody tr').each((i, el) => {
             const pts = parseFloat($(el).find('td[data-stat="pts_per_g"]').text()) || 0;
             const trb = parseFloat($(el).find('td[data-stat="trb_per_g"]').text()) || 0;
             const ast = parseFloat($(el).find('td[data-stat="ast_per_g"]').text()) || 0;
             const stl = parseFloat($(el).find('td[data-stat="stl_per_g"]').text()) || 0;
             const blk = parseFloat($(el).find('td[data-stat="blk_per_g"]').text()) || 0;
             // percentage is e.g. 0.507. We multiply by 100 to get a whole number base (e.g. 50.7) for easier gameplay
             const fg_pct = (parseFloat($(el).find('td[data-stat="fg_pct"]').text()) || 0) * 100;
             const fg3_pct = (parseFloat($(el).find('td[data-stat="fg3_pct"]').text()) || 0) * 100;

             if (pts > peakPts) peakPts = pts;
             if (trb > peakTrb) peakTrb = trb;
             if (ast > peakAst) peakAst = ast;
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
                    if (stat === 'pts_per_g') careerPtsAvg = val;
                    if (stat === 'trb_per_g') careerTrbAvg = val;
                    if (stat === 'ast_per_g') careerAstAvg = val;
                    if (stat === 'stl_per_g') careerStlAvg = val;
                    if (stat === 'blk_per_g') careerBlkAvg = val;
                    if (stat === 'fg_pct') careerFgAvg = val * 100;
                    if (stat === 'fg3_pct') careerFg3Avg = val * 100;
                });
            }
        });

        if (!careerPtsAvg && $('#per_game_stats tfoot tr').length > 0) {
            $('#per_game_stats tfoot tr').first().find('td').each((i, el) => {
                const stat = $(el).attr('data-stat');
                const val = parseFloat($(el).text()) || 0;
                if (stat === 'pts_per_g') careerPtsAvg = val;
                if (stat === 'trb_per_g') careerTrbAvg = val;
                if (stat === 'ast_per_g') careerAstAvg = val;
                if (stat === 'stl_per_g') careerStlAvg = val;
                if (stat === 'blk_per_g') careerBlkAvg = val;
                if (stat === 'fg_pct') careerFgAvg = val * 100;
                if (stat === 'fg3_pct') careerFg3Avg = val * 100;
            });
        }

        if (careerPtsTotal === 0 && careerPtsAvg === 0 && peakPts === 0) {
            return res.json({ error: "找不到該球員的數據，可能是因為該球員沒有足夠的比賽紀錄或名字匹配錯誤。" });
        }

        // Auto-calculate career average if missing but total exists, or vice versa
        if (careerPtsAvg === 0 && peakPts > 0) {
            careerPtsAvg = peakPts / 2; // Rough fallback to prevent 0
        }

        const playerStats = {
          id: pid,
          player_name: name,
          position: position,
          data: {
            PTS: { career_total: careerPtsTotal, career_average: careerPtsAvg, peak_season: peakPts },
            REB: { career_total: careerTrbTotal, career_average: careerTrbAvg, peak_season: peakTrb },
            AST: { career_total: careerAstTotal, career_average: careerAstAvg, peak_season: peakAst },
            STL: { career_total: careerStlTotal, career_average: careerStlAvg, peak_season: peakStl },
            BLK: { career_total: careerBlkTotal, career_average: careerBlkAvg, peak_season: peakBlk },
            // Percentages don't have cumulative totals making sense, so we store 0 for career_total
            FG_PCT: { career_total: 0, career_average: careerFgAvg, peak_season: peakFg },
            FG3_PCT: { career_total: 0, career_average: careerFg3Avg, peak_season: peakFg3 }
          }
        };

        // Cache it to the SQLite database
        const result = db.prepare('UPDATE players SET stats = ? WHERE id = ?').run(JSON.stringify(playerStats), pid);
        if (result.changes === 0) {
            db.prepare('INSERT INTO players (id, name, search_name, url, stats) VALUES (?, ?, ?, ?, ?)').run(
                pid, name, name.toLowerCase(), `/players/${char}/${pid}.html`, JSON.stringify(playerStats)
            );
        }

        res.json(playerStats);
      } catch (err) {
        console.error(err);
        res.json({ error: "Failed to load player stats" });
      }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    pingInterval: 10000,
    pingTimeout: 15000
  });

  const rooms = new Map<string, {
    name: string;
    password?: string;
    players: string[];
  }>();

  io.on('connection', (socket) => {
    socket.on('create_room', (data, callback) => {
      const { name, password } = data;
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      rooms.set(roomId, { name, password, players: [socket.id] });
      socket.join(roomId);
      console.log(`[DEBUG] 創建房間: ${roomId}, 目前所有房間: ${Array.from(rooms.keys())}`);
      callback({ success: true, roomId });
    });

    socket.on('join_room', (data, callback) => {
      const { roomId, password } = data;
      const room = rooms.get(roomId);
      
      console.log(`[DEBUG] 嘗試加入房間: ${roomId} (Socket ID: ${socket.id})`);

      if (!room) {
        console.log(`[DEBUG] 加入失敗: 找不到房間 ${roomId}`);
        return callback({ error: "找不到該房間" });
      }
      if (room.password && room.password !== password) {
        console.log(`[DEBUG] 加入失敗: 密碼錯誤 ${roomId}`);
        return callback({ error: "密碼錯誤" });
      }

      if (room.players.includes(socket.id)) {
        console.log(`[DEBUG] 該用戶已經在房間內: ${roomId}`);
        return callback({ success: true, name: room.name });
      }

      if (room.players.length >= 2) {
        console.log(`[DEBUG] 加入失敗: 房間已滿員 ${roomId}`);
        return callback({ error: "房間已滿員" });
      }
      
      room.players.push(socket.id);
      socket.join(roomId);
      console.log(`[DEBUG] 成功加入房間: ${roomId}, 目前人數: ${room.players.length}`);
      socket.to(roomId).emit('player_joined', { playerCount: room.players.length });
      callback({ success: true, name: room.name });
    });

    socket.on('game_event', (data) => {
      if (!data.roomId) {
        // Fallback: check which room this socket is in if data.roomId is missing
        const socketRooms = Array.from(socket.rooms);
        const roomId = socketRooms.find(r => r !== socket.id);
        if (roomId) {
          data.roomId = roomId;
        }
      }
      
      if (data.roomId) {
        socket.to(data.roomId).emit('game_event', data);
      }
    });

    socket.on('rejoin_room', (data) => {
      const { roomId } = data;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room) {
        if (!room.players.includes(socket.id)) {
           room.players.push(socket.id);
        }
        socket.join(roomId);
        console.log(`[DEBUG] 用戶重新加入房間: ${roomId}, 目前人數: ${room.players.length}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[DEBUG] 用戶斷線: ${socket.id}`);
      // Find room user was in and remove them
      for (const [roomId, room] of rooms.entries()) {
        const idx = room.players.indexOf(socket.id);
        if (idx !== -1) {
          room.players.splice(idx, 1);
          console.log(`[DEBUG] 從房間 ${roomId} 移除用戶, 剩餘人數: ${room.players.length}`);
          socket.to(roomId).emit('player_left', { playerCount: room.players.length });
          if (room.players.length === 0) {
            console.log(`[DEBUG] 房間 ${roomId} 為空, 等待 15 秒重新連線...`);
            setTimeout(() => {
              const checkRoom = rooms.get(roomId);
              if (checkRoom && checkRoom.players.length === 0) {
                console.log(`[DEBUG] 房間 ${roomId} 依然為空, 正在刪除`);
                rooms.delete(roomId);
              }
            }, 15000);
          }
        }
      }
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
