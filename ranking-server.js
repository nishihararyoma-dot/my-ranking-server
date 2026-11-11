// NEON SHRINE ranking server — Stylish Web View Edition
const http = require('http'), fs = require('fs');
const PORT = +(process.env.PORT || 8787);
const FILE = process.env.SCORES_FILE || 'scores.json';

// 【パターン1】サーバーとゲームだけが知っている秘密の合言葉（前のまま）
const SECRET_KEY = "my_super_secret_password_123";

let scores = [];
try { scores = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
function save() { try { fs.writeFileSync(FILE, JSON.stringify(scores)); } catch (e) {} }

function fnv(str) { 
  let h = 0x811c9dc5; 
  for (let i = 0; i < str.length; i++) { 
    h ^= str.charCodeAt(i); 
    h = Math.imul(h, 0x01000193) >>> 0; 
  } 
  return ('00000000' + h.toString(16)).slice(-8); 
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }
  const url = new URL(req.url, 'http://x');

  // -------------------------------------------------------------
  // 【GET /scores】 ランキングをキレイなWebサイトとして表示
  // -------------------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/scores') {
    // タイムが短い順に並び替え
    const sorted = scores.slice().sort((a, b) => a.t - b.t).slice(0, 100);

    // ★ ここでHTML（見た目）を組み立ててブラウザに返します
    let rows = sorted.map((x, idx) => `
      <tr>
        <td class="rank">#${idx + 1}</td>
        <td class="name">${x.n}</td>
        <td class="time">${Number(x.t).toFixed(2)} 秒</td>
        <td class="stage">${x.st || '-'}</td>
        <td class="char">${x.ch || '-'}</td>
      </tr>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>NEON SHRINE オンラインランキング</title>
      <style>
        body { background: #0f0f13; color: #fff; font-family: sans-serif; text-align: center; padding: 20px; }
        h1 { color: #00ffcc; text-shadow: 0 0 10px rgba(0,255,20c,0.5); font-size: 24px; margin-bottom: 30px; }
        table { width: 100%; max-width: 600px; margin: 0 auto; border-collapse: collapse; background: #1a1a24; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #2a2a3a; }
        th { background: #252535; color: #00ffcc; font-size: 14px; text-transform: uppercase; }
        tr:hover { background: #222232; }
        .rank { font-weight: bold; color: #ff007f; width: 50px; }
        .name { font-weight: bold; }
        .time { color: #ffcc00; text-align: right; font-family: monospace; font-size: 16px; }
        .stage { color: #aaa; }
        .char { color: #88fa42; }
        .empty { padding: 40px; color: #666; font-style: italic; }
      </style>
    </head>
    <body>
      <h1>🏆 NEON SHRINE オンラインランキング 🏆</h1>
      <table>
        <thead>
          <tr>
            <th>順位</th>
            <th>プレイヤー</th>
            <th style="text-align:right">タイム</th>
            <th>ステージ</th>
            <th>キャラ</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5" class="empty">データがまだありません。プレイしてスコアを残そう！</td></tr>'}
        </tbody>
      </table>
    </body>
    </html>
    `;

    // ※ブラウザで見た時はHTMLとして、ゲームからリクエストされた時はJSONとして判定されるようにします
    // ゲーム側が明示的にJSONを求めてきた場合（ヘッダー指定など）に対応するため、一応CORSも残します
    const isBrowser = req.headers['accept'] && req.headers['accept'].includes('text/html');
    if (isBrowser) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(sorted));
    }
  }

  // -------------------------------------------------------------
  // 【POST /scores】 スコアの投稿（前のまま）
  // -------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/scores') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      let o; try { o = JSON.parse(body); } catch (e) { return res.writeHead(400), res.end(); }
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
        n: o.n, s: o.s, t: Number(o.t), b: o.b, d: o.d, k: o.k, c: o.c, ts: o.ts || Date.now(), st: o.st, ch: o.ch
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
  res.writeHead(404), res.end();
}).listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
