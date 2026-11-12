const http = require('http');
const fs = require('fs');
const PORT = +(process.env.PORT || 8787);
const FILE = process.env.SCORES_FILE || 'scores.json';

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

function getCors(req) {
  return {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true'
  };
}

http.createServer((req, res) => {
  const cors = getCors(req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET' && url.pathname === '/scores') {
    const rawData = scores.slice(0, 1000);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NEON SHRINE ランキング</title><style>body{background:#0f0f13;color:#fff;font-family:sans-serif;text-align:center;padding:20px}h1{color:#00ffcc;font-size:22px}.box{background:#1a1a24;max-width:750px;margin:0 auto 15px;padding:12px;border-radius:8px}.tabs,.sorts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}button{background:#252535;color:#aaa;border:none;padding:8px 12px;border-radius:4px;cursor:pointer;font-weight:bold;flex:1}button.active{background:#00ffcc;color:#0f0f13}.sorts button.active{background:#ff007f;color:#fff}table{width:100%;max-width:750px;margin:0 auto;border-collapse:collapse;background:#1a1a24}th,td{padding:10px;border-bottom:1px solid #2a2a3a;font-size:13px}th{background:#252535;color:#00ffcc}.rank{color:#ff007f;font-weight:bold}</style></head><body><h1>NEON SHRINE 総合ランキング</h1><div class="box"><div class="tabs"><button class="active" onclick="setF('time',this)">タイム</button><button onclick="setF('graze',this)">グレイズ</button><button onclick="setF('enemy',this)">敵撃破</button><button onclick="setF('hit',this)">被弾数</button><button onclick="setF('bomb',this)">ボム消費</button></div><div class="sorts"><button id="b-best" class="active" onclick="setD('best')">優秀（トップ）順</button><button id="b-worst" onclick="setD('worst')">逆（ワースト）順</button></div></div><table><thead><tr><th>順位</th><th>名前</th><th>タイム</th><th>グレイズ</th><th>撃破</th><th>被弾</th><th>ボム</th></tr></thead><tbody id="tb"></tbody></table><script>const data=${JSON.stringify(rawData)};let f='time',d='best';function draw(){const tb=document.getElementById('tb');if(!data.length){tb.innerHTML='<tr><td colspan="7">データがありません</td></tr>';return}let s=data.slice().sort((a,b)=>{if(f==='time')return d==='best'?a.t-b.t:b.t-a.t;if(f==='hit')return d==='best'?(a.h||0)-(b.h||0):(b.h||0)-(a.h||0);if(f==='bomb')return d==='best'?(a.bm||0)-(b.bm||0):(b.bm||0)-(a.bm||0);if(f==='graze')return d==='best'?(b.g||0)-(a.g||0):(a.g||0)-(b.g||0);if(f==='enemy')return d==='best'?(b.kl||0)-(a.kl||0):(a.kl||0)-(b.kl||0);return 0});tb.innerHTML=s.map((x,i)=>\`<tr><td class="rank">#\${i+1}</td><td>\${x.n}</td><td>\${Number(x.t).toFixed(2)}秒</td><td>\${x.g||0}</td><td>\${x.kl||0}</td><td>\${x.h||0}</td><td>\${x.bm||0}</td></tr>\`).join('')}function setF(nf,el){document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));el.classList.add('active');f=nf;draw()}function setD(nd){document.querySelectorAll('.sorts button').forEach(b=>b.classList.remove('active'));document.getElementById('b-'+nd).classList.add('active');d=nd;draw()}draw();</script></body></html>`;

    const isBrowser = req.headers['accept'] && req.headers['accept'].includes('text/html');
    if (isBrowser) {
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, cors));
      return res.end(html);
    } else {
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors));
      return res.end(JSON.stringify(scores.slice().sort((a, b) => a.t - b.t).slice(0, 200)));
    }
  }

  if (req.method === 'POST' && url.pathname === '/scores') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      let o;
      try { o = JSON.parse(body); } catch (e) { res.writeHead(400, cors); return res.end(); }
      if (!o || typeof o.n !== 'string' || o.t === undefined) {
        res.writeHead(400, Object.assign({ 'Content-Type': 'application/json' }, cors));
        return res.end(JSON.stringify({ error: 'missing data' }));
      }
      const newScore = {
        id: fnv(o.n + '|' + o.t + '|' + (o.ts || Date.now()) + '|' + Math.random()),
        n: o.n, s: Number(o.s || 0), t: Number(o.t), b: o.b, d: o.d, k: o.k, c: o.c, ts: o.ts || Date.now(),
        g: Number(o.g || 0), kl: Number(o.kl || 0), es: Number(o.es || 0), h: Number(o.h || 0), bm: Number(o.bm || 0)
      };
      scores.push(newScore);
      if (scores.length > 5000) { scores.sort((a, b) => a.t - b.t); scores.length = 5000; }
      save();
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(404, cors);
  res.end();
}).listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
