import { readFileSync } from 'node:fs';
const [k, a, b, re] = process.argv.slice(2);
const p = JSON.parse(readFileSync(k + '.json'));
for (let i = +a; i <= +b; i++) { let t = p[i-1]; if (re) { const r = new RegExp(re, 'ig'); const out = []; let m; while ((m = r.exec(t))) out.push('…' + t.slice(Math.max(0, m.index-150), m.index+350).replace(/\s+/g,' ') + '…'); if (out.length) console.log('--- p.' + i + '\n' + out.join('\n')); } else console.log('--- p.' + i + '\n' + t.replace(/\s+/g,' ')); }
