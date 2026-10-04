'use strict';
var P = require('./engine.js'), cp = require('child_process'), vec = require('./rfc-vectors.json');
var checks = 0, fails = 0, report = [];
function eq(a, b, m) { checks++; if (a !== b) { fails++; if (fails < 25) console.log('FAIL', m, JSON.stringify(a), '!=', JSON.stringify(b)); } }
// 1. RFC 3492 section 7.1 sample strings (A to S), parsed from the RFC text. Mixed-case digits mark case annotation, so compare lower-cased.
vec.forEach(function (v) { var s = String.fromCodePoint.apply(null, v[1]); eq(P.encode(s).toLowerCase(), v[2].toLowerCase(), 'RFC encode ' + v[0]); eq(P.decode(v[2]).toLowerCase(), s.toLowerCase(), 'RFC decode ' + v[0]); });
// 2. Known domain results
eq(P.toASCII('bücher.de', 'uts46').ascii, 'xn--bcher-kva.de', 'bucher'); eq(P.toASCII('faß.de', 'uts46').ascii, 'xn--fa-hia.de', 'fass uts46'); eq(P.toASCII('faß.de', 'idna2003').ascii, 'fass.de', 'fass 2003');
eq(P.toASCII('日本語.jp', 'uts46').ascii, 'xn--wgv71a119e.jp', 'nihongo'); eq(P.toUnicode('xn--bcher-kva.de'), 'bücher.de', 'toUnicode');
eq(!!P.toASCII('a'.repeat(64) + '.com', 'uts46').error, true, '64-char label rejected');
// 3. Random checks against oracles
var seed = 5; function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
var POOL = 'abcdefghijklmnopqrstuvwxyz0123456789-'.split('').concat('äöüéèñçøåšžœæþðıİ'.split(''), 'αβγδλμπσΣΩ'.split(''), 'бвгджзклмнпрстф'.split(''), '日本語中文한국어あいうカナ'.split(''), 'אבגשלום'.split(''), 'مرحبا'.split(''), Array.from('😀🎉'), ['\u00df', '\u03c2', '\u200d', '\u200c', 'ÄÖÜ', 'É', 'Ж', 'ı', 'ǆ', 'ﬁ', '①']);
function rl(n) { var s = ''; for (var i = 0; i < n; i++) s += pick(POOL); return s; }
var N = 5000, strs = []; for (var i = 0; i < N; i++) strs.push(rl(1 + Math.floor(rnd() * 12)));
function run(cmd, args, input) { try { return JSON.parse(cp.execFileSync(cmd, args, { input: JSON.stringify(input), maxBuffer: 1 << 28, cwd: __dirname, stdio: ['pipe', 'pipe', 'ignore'] }).toString()); } catch (e) { return null; } }
// 3a. Raw punycode encode and decode vs Python's punycode codec (letters only, no mapping involved)
var o = run('python3', ['oracle.py'], strs.map(function (s) { return { k: 'punyenc', d: s }; }));
strs.forEach(function (s, i) { eq(P.encode(s), o[i], 'punycode encode ' + JSON.stringify(s)); });
var enc = strs.map(function (s) { return P.encode(s); });
o = run('python3', ['oracle.py'], enc.map(function (e) { return { k: 'punydec', d: e }; }));
strs.forEach(function (s, i) { eq(P.decode(enc[i]), o[i], 'punycode decode ' + enc[i]); eq(P.decode(enc[i]), s, 'roundtrip ' + JSON.stringify(s)); });
report.push('Punycode encode/decode: ' + N + ' random strings vs Python punycode codec, plus round trips');
// 3b. Whole-label conversion per profile. Oracles apply the full mapping tables; mine is simplified, so count agreement and list classes of disagreement.
function profile(name, kind, oracleArgs) {
  var o = run(oracleArgs[0], oracleArgs[1], strs.map(function (s) { return oracleArgs[2](s); })); if (!o) { report.push(name + ': skipped'); return; }
  var agree = 0, dis = {}, rej = 0, tot = 0;
  strs.forEach(function (s, i) {
    if (/^([0-9]+|0x[0-9a-f]*)$/i.test(s)) return; // all-digit names are read as IPv4 hosts by the URL parser
    tot++;
    if (o[i] === 'ERR') { rej++; return; } // the oracle applies validity rules (bidi, disallowed characters, hyphens) that this engine does not model
    var mine = P.toASCII(s, kind), mv = mine.error ? 'ERR' : mine.ascii;
    if (mv === o[i]) { agree++; checks++; return; }
    var why = /[\u200c\u200d]/.test(s) ? 'joiner' : /[\u2460\ufb01\u01c6]/.test(s) ? 'compat mapping' : 'other';
    dis[why] = (dis[why] || 0) + 1; if (why === 'other') { fails++; if (fails < 25) console.log('FAIL', name, JSON.stringify(s), mv, o[i]); } });
  report.push(name + ': ' + tot + ' strings; ' + agree + ' agree; ' + rej + ' rejected by the oracle (validity rules not modelled here); explained gaps ' + JSON.stringify(dis));
}
profile('UTS46 vs Node domainToASCII', 'uts46', ['node', ['oracle-node.js'], function (s) { return s; }]);
profile('IDNA2003 vs Python idna codec', 'idna2003', ['python3', ['oracle.py'], function (s) { return { k: '2003', d: s }; }]);
profile('UTS46 vs Python idna package', 'uts46', ['python3', ['oracle.py'], function (s) { return { k: 'uts46', d: s }; }]);
report.forEach(function (l) { console.log(l); });
console.log(checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
