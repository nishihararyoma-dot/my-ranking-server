// NEON SHRINE ranking server — Multi-Filter Tab Edition
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

  // -------------------------------------------------------------
  // 【GET /scores】 切り替え機能付きのランキング画面を表示
  // -------------------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/scores') {
    
    // それぞれの条件でソートしたデータを作成
    const sortByTime = scores.slice().sort((a, b) => a.t - b.t).slice(0, 100);
    const sortByGraze = scores.slice().sort((a, b) => (b.pc_g || 0) - (a.pc_g || 0)).slice(0, 100);
    const sortByEnemy = scores.slice().sort((a, b) => (b.pc_e || 0) - (a.pc_e || 0)).slice(0, 100);

    // HTML用のテーブル行を組み立てる関数
    const makeRows = (list, type) => {
      if (list.length === 0) return '<tr><td colspan="5" class="empty">データがまだありません。</td></tr>';
      return list.map((x, idx) => `
        <tr>
          <td class="rank">#${idx + 1}</td>
          <td class="name">${x.n}</td>
          <td class="time ${type==='time'?'highlight':''}">${Number(x.t).toFixed(2)} 秒</td>
          <td class="graze ${type==='graze'?'highlight':''}">${x.pc_g || 0}%</td>
          <td class="enemy ${type==='enemy'?'highlight':''}">${x.pc_e || 0}%</td>
        </tr>
      `).join('');
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>NEON SHRINE オンラインランキング</title>
      <style>
        body { background: #0f0f13; color: #fff; font-family: sans-serif; text-align: center; padding: 20px; }
        h1 { color: #00ffcc; text-shadow: 0 0 10px rgba(0,255,20c,0.5); font-size: 24px; margin-bottom: 20px; }
        .tabs { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; max-width: 600px; margin-left: auto; margin-right: auto; }
        .tab-btn { background: #252535; color: #aaa; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; flex: 1; transition: 0.2s; }
        .tab-btn:hover { background: #353545; color: #fff; }
        .tab-btn.active { background: #00ffcc; color: #0f0f13; box-shadow: 0 0 10px rgba(0,255,20c,0.4); }
        table { width: 100%; max-width: 600px; margin: 0 auto; border-collapse: collapse; background: #1a1a24; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #2a2a3a; }
        th { background: #252535; color: #00ffcc; font-size: 13px; text-transform: uppercase; }
        tr:hover { background: #222232; }
        .rank { font-weight: bold; color: #ff007f; width: 50px; }
        .name { font-weight: bold; }
        .highlight { color: #fff !important; font-weight: bold; text-shadow: 0 0 5px rgba(255,255,255,0.3); }
        td.time { color: #ffcc00; font-family: monospace; }
        td.graze { color: #ff007f; }
        td.enemy { color: #88fa42; }
        .empty { padding: 40px; color: #666; font-style: italic; text-align: center; }
        .tbody-panel { display: none; }
        .tbody-panel.active { display: table-row-group; }
      </style>
    </head>
    <body>
      <h1>🏆 NEON SHRINE 総合ランキング 🏆</h1>
      
      <!-- 【ボタン部分】ここでポチポチ切り替えます -->
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('time')">⏱️ タイム順</button>
        <button class="tab-btn" onclick="switchTab('graze')">✨ グレイズ順</button>
        <button class="tab-btn" onclick="switchTab('enemy')">👾 敵撃破順</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>順位</th>
            <th>プレイヤー</th>
            <th>タイム</th>
            <th>グレイズ</th>
            <th>敵撃破</th>
          </tr>
        </thead>
        <!-- ボタンに合わせて表示を切り替える3つのデータグループ -->
        <tbody id="panel-time" class="tbody-panel active">${makeRows(sortByTime, 'time')}</tbody>
        <tbody id="panel-graze" class="tbody-panel">${makeRows(sortByGraze, 'graze')}</tbody>
        <tbody id="panel-enemy" class="tbody-panel">${makeRows(sortByEnemy, 'enemy')}</tbody>
      </table>

      <script>
        // ボタンをポチポチしたときに中身を切り替える超シンプルな仕組み（JavaScript）
        function switchTab(type) {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tbody-panel').forEach(p => p.classList.remove('active'));
          event.target.classList.add('active');
          document.getElementById('panel-' + type).classList.add('active');
        }
      </script>
    </body>
    </html>
    `;

    // ブラウザからのアクセスならHTMLを返し、ゲーム内からの要求ならJSON(タイム順)を返します
    const isBrowser = req.headers['accept'] && req.headers['accept'].includes('text/html');
    if (isBrowser) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(sortByTime));
    }
  }

  // -------------------------------------------------------------
  // 【POST /scores】 内訳データも一緒に受け取って保存する
  // -------------------------------------------------------------
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
      
      // ゲーム側から送られてくる内訳データ（pc_g と pc_e）を受け取って金庫に保存
      const newScore = {
        id: fnv(o.n + '|' + o.t + '|' + (o.ts || Date.now())),
        n: o.n, s: o.s, t: Number(o.t), b: o.b, d: o.d, k: o.k, c: o.c, ts: o.ts || Date.now(), st: o.st, ch: o.ch,
        pc_g: Number(o.pc_g || 0), // 【追加】グレイズのパーセント
        pc_e: Number(o.pc_e || 0)  // 【追加】敵撃破のパーセント
      };
      
      if (scores.some(x => x.id === newScore.id)) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ ok: true, dup: true }));
      }
      const existingIndex = scores.findIndex(x => x.n === newScore.n);
      if (existingIndex !== -1) {
        // 基本はタイムアタックなので、タイムが短ければ上書き更新
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
