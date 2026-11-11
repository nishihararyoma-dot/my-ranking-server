// NEON SHRINE ranking server — Custom All-in-One Edition
const http = require('http'), fs = require('fs');
const PORT = +(process.env.PORT || 8787);
const FILE = process.env.SCORES_FILE || 'scores.json';

// 【パターン1】サーバーとゲームだけが知っている秘密の合言葉
const SECRET_KEY = "my_super_secret_password_123";

let scores = [];
try { scores = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
function save() { try { fs.writeFileSync(FILE, JSON.stringify(scores)); } catch (e) {} }

// FNV-1a ハッシュ関数（合言葉の検証およびID生成用）
function fnv(str) { 
  let h = 0x811c9dc5; 
  for (let i = 0; i < str.length; i++) { 
    h ^= str.charCodeAt(i); 
    h = Math.imul(h, 0x01000193) >>> 0; 
  } 
  return ('00000000' + h.toString(16)).slice(-8); 
}

function send(res, code, obj) {
  res.writeHead(code, { 
    'Content-Type': 'application/json; charset=utf-8', 
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 
    'Access-Control-Allow-Headers': 'Content-Type' 
  });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://x');

  // -------------------------------------------------------------
  // 【GET /scores】 ランキングの取得
  // -------------------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/scores') {
    const limit = Math.min(500, Math.max(1, +url.searchParams.get('limit') || 100));
    // ※【パターン2】タイム（t）が短い（小さい）順にソートして返します
    return send(res, 200, scores.slice().sort((a, b) => a.t - b.t).slice(0, limit));
  }

  // -------------------------------------------------------------
  // 【POST /scores】 スコアの投稿
  // -------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/scores') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      let o; 
      try { o = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'bad json' }); }

      // 最低限名前(n)とタイム(t)があることだけ確認
      if (!o || typeof o.n !== 'string' || o.t === undefined) return send(res, 400, { error: 'missing data' });

      // 【パターン1】チート検証
      const expectedHash = fnv(o.n + '|' + o.t + '|' + SECRET_KEY);
      if (o.hash !== expectedHash) {
        return send(res, 400, { error: 'invalid hash / tamper detected' });
      }

      // 【パターン4】ゲーム独自データを格納
      const newScore = {
        id: fnv(o.n + '|' + o.t + '|' + (o.ts || Date.now())),
        n: o.n,           // 名前
        s: o.s,           // スコア（一応残していますがソートには使いません）
        t: Number(o.t),   // タイム（ソート対象）
        b: o.b,
        d: o.d,
        k: o.k,
        c: o.c,
        ts: o.ts || Date.now(),
        st: o.st,         // ステージ番号
        ch: o.ch          // 使用キャラクター名
      };

      if (scores.some(x => x.id === newScore.id)) return send(res, 200, { ok: true, dup: true });

      // 【パターン3】自己ベストのみ制限（同じ名前のデータが既にあるか探す）
      const existingIndex = scores.findIndex(x => x.n === newScore.n);
      if (existingIndex !== -1) {
        // タイムアタック（短い方が上位）なので、今回の方が小さければ上書き
        if (newScore.t < scores[existingIndex].t) {
          scores[existingIndex] = newScore;
        } else {
          return send(res, 200, { ok: true, note: 'Time is slower than personal best' });
        }
      } else {
        scores.push(newScore);
      }

      // 【パターン2】上位5000件をタイムが短い順で残す
      if (scores.length > 5000) { 
        scores.sort((a, b) => a.t - b.t); 
        scores.length = 5000; 
      }

      save(); 
      send(res, 200, { ok: true });
    });
    return;
  }

  send(res, 404, { error: 'not found' });
}).listen(PORT, '0.0.0.0', () => console.log('Custom Ranking Server running on port ' + PORT));
