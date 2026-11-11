// NEON SHRINE ranking server — Advanced Sort Edition
const http = require('http'), fs = require('fs');
const PORT = +(process.env.PORT || 8787);
const FILE = process.env.SCORES_FILE || 'scores.json';
const SECRET_KEY = "my_super_secret_password_123";

let scores = [];
try { scores = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
function save() { try { fs.writeFileSync(FILE, JSON.stringify(scores)); } catch (e) {} }

function fnv(str) { 
  let h = 0x811c9dc5; 
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } 
  return ('00000000' + h.toString(16)).slice(-8); 
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET' && url.pathname === '/scores') {
    const rawData = scores.slice(0, 1000); 
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NEON SHRINE オンラインランキング</title><style>body { background: #0f0f13; color: #fff; font-family: sans-serif; text-align: center; padding: 20px; } h1 { color: #00ffcc; text-shadow: 0 0 10px rgba(0,255,20c,0.5); font-size: 24px; margin-bottom: 20px; } .control-panel { background: #1a1a24; max-width: 750px; margin: 0 auto 20px; padding: 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); } .section-title { font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: 8px; text-align: left; font-weight: bold; letter-spacing: 1px; } .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; } .tab-btn { background: #252535; color: #aaa; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; flex: 1; min-width: 110px; transition: 0.2s; } .tab-btn:hover { background: #353545; color: #fff; } .tab-btn.active { background: #00ffcc; color: #0f0f13; box-shadow: 0 0 10px rgba(0,255,20c,0.3); } .sort-options { display: flex; gap: 10px; } .sort-btn { background: #252535; color: #aaa; border: 1px solid #353545; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; flex: 1; transition: 0.2s; } .sort-btn:hover { border-color: #555; color: #fff; } .sort-btn.active { background: #ff007f; color: #fff; border-color: #ff007f; box-shadow: 0 0 10px rgba(255,0,127,0.3); } table { width: 100%; max-width: 750px; margin: 0 auto; border-collapse: collapse; background: #1a1a24; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5); } th, td { padding: 12px 12px; text-align: left; border-bottom: 1px solid #2a2a3a; font-size: 14px; } th { background: #252535; color: #00ffcc; font-size: 12px; text-transform: uppercase; } tr:hover { background: #222232; } .rank { font-weight: bold; color: #ff007f; width: 40px; text-align: center; } .name { font-weight: bold; } .highlight { background: rgba(255,255,255,0.04); font-weight: bold; } td.val-time { color: #ffcc00; font-family: monospace; } td.val-graze { color: #00ffcc; } td.val-enemy { color: #88fa42; } td.val-hit { color: #ff3333; } td.val-bomb { color: #aa66ff; } .empty { padding: 40px; color: #666; font-style: italic; text-align: center; }</style></head><body><h1>🏆 NEON SHRINE 総合ランキングシステム 🏆</h1><div class="control-panel"><div class="section-title">① 比較する項目を選択</div><div class="tabs"><button class="tab-btn active" onclick="changeFilter('time')">⏱️ タイム</button><button class="tab-btn" onclick="changeFilter('graze')">✨ グレイズ率</button><button class="tab-btn" onclick="changeFilter('enemy')">👾 敵撃破率</button><button class="tab-btn" onclick="changeFilter('hit')">💥 被弾数</button><button class="tab-btn" onclick="changeFilter('bomb')">💣 ボム消費</button></div><div class="section-title">② 並び順（トップ ⇔ ワースト）</div><div class="sort-options"><button id="btn-dir-best" class="sort-btn active" onclick="changeDirection('best')">👑 優秀（トップ）順</button><button id="btn-dir-worst" class="sort-btn" onclick="changeDirection('worst')">👁️ 逆（ワースト）順</button></div></div><table><thead><tr><th style="text-align:center">順位</th><th>プレイヤー</th><th>タイム</th><th>グレイズ</th><th>敵撃破</th><th>被弾数</th><th>ボム</th></tr></thead><tbody id="leaderboard-body"></tbody></table><script>const rawScores = ${JSON.stringify(rawData)}; let currentFilter = 'time'; let currentDirection = 'best'; function renderTable() { const tbody = document.getElementById('leaderboard-body'); if (rawScores.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="empty">データがまだありません。プレイしてスコアを残そう！</td></tr>'; return; } let sorted = rawScores.slice().sort((a, b) => { if (currentFilter === 'time') return currentDirection === 'best' ? a.t - b.t : b.t - a.t; if (currentFilter === 'hit') return currentDirection === 'best' ? (a.hit||0) - (b.hit||0) : (b.hit||0) - (a.hit||0); if (currentFilter === 'bomb') return currentDirection === 'best' ? (a.bomb||0) - (b.bomb||0) : (b.bomb||0) - (a.bomb||0); if (currentFilter === 'graze') return currentDirection === 'best' ? (b.pc_g||0) - (a.pc_g||0) : (a.pc_g||0) - (b.pc_g||0); if (currentFilter === 'enemy') return currentDirection === 'best' ? (b.pc_e||0) - (a.pc_e||0) : (a.pc_e||0) - (b.pc_e||0); return 0; }); tbody.innerHTML = sorted.map((x, idx) => \`<tr><td class="rank">#\${idx + 1}</td><td class="name">\${x.n}</td><td class="val-time \${currentFilter==='time'?'highlight':''}">\${Number(x.t).toFixed(2)} 秒</td><td class="val-graze \${currentFilter==='graze'?'highlight':''}">\${x.pc_g || 0}%</td><td class="val-enemy \${currentFilter==='enemy'?'highlight':''}">\${x.pc_e || 0}%</td><td class="val-hit \${currentFilter==='hit'?'highlight':''}">\${x.hit || 0} 回</td><td class="val-bomb \${currentFilter==='bomb'?'highlight':''}">\${x.bomb || 0} 回</td></tr>\`).join(''); } function changeFilter(type) { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); event.target.classList.add('active'); currentFilter = type; renderTable(); } function changeDirection(dir) { document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active')); document.getElementById('btn-dir-' + dir).classList.add('active'); currentDirection = dir; renderTable(); } renderTable();</script></body></html>`;
    const isBrowser = req.headers['accept'] && req.headers['accept'].includes('text/html');
    if (isBrowser) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(scores.slice().sort((a, b) => a.t - b.t).slice(0, 100)));
    }
  }

  if (req.method === 'POST' && url.pathname === '/scores') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      let o; try { o = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end(); }
      if (!o || typeof o.n !== 'string' || o.t === undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ error: 'missing data' }));
      }
      const expectedHash = fnv(o.n + '|' + o.t + '|' + SECRET_KEY);
      if (o.hash !== expectedHash) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ error: 'invalid hash' }));
      }
      const newScore = {
        id: fnv(o.n + '|' + o.t + '|' + (o.ts || Date.now())),
        n: o.n, s: o.s, t: Number(o.t), b: o.b, d: o.d, k: o.k, c: o.c, ts: o.ts || Date.now(), st: o.st, ch: o.ch,
        pc_g: Number(o.pc_g || 0), pc_e: Number(o.pc_e || 0), hit: Number(o.hit || 0), bomb: Number(o.bomb || 0)
      };
      if (scores.some(x => x.id === newScore.id)) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ ok: true, dup: true }));
      }
      const existingIndex = scores.findIndex(x => x.n === newScore.n);
      if (existingIndex !== -1) {
        if (newScore.t < scores[existingIndex].t) { scores[existingIndex] = newScore; }
      } else {
        scores.push(newScore);
      }
      if (scores.length > 5000) { scores.sort((a, b) => a.t - b.t); scores.length = 5000; }
      save();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
