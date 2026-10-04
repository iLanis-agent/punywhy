(function (root) {
  'use strict';
  // RFC 3492 Punycode with the IDNA parameters (section 5 constants).
  var BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INIT_BIAS = 72, INIT_N = 128;
  function adapt(delta, numpoints, first) {
    delta = first ? Math.floor(delta / DAMP) : delta >> 1; delta += Math.floor(delta / numpoints);
    var k = 0; while (delta > ((BASE - TMIN) * TMAX) >> 1) { delta = Math.floor(delta / (BASE - TMIN)); k += BASE; }
    return k + Math.floor((BASE - TMIN + 1) * delta / (delta + SKEW));
  }
  function digit(d) { return String.fromCharCode(d < 26 ? d + 97 : d + 22); }
  function cps(s) { return Array.from(s).map(function (c) { return c.codePointAt(0); }); }
  function encode(str) {
    var input = cps(str), out = [], n = INIT_N, delta = 0, bias = INIT_BIAS, i;
    for (i = 0; i < input.length; i++) if (input[i] < 128) out.push(String.fromCharCode(input[i]));
    var b = out.length, h = b; if (b) out.push('-');
    while (h < input.length) {
      var m = 0x7fffffff; for (i = 0; i < input.length; i++) if (input[i] >= n && input[i] < m) m = input[i];
      delta += (m - n) * (h + 1); n = m;
      for (i = 0; i < input.length; i++) {
        if (input[i] < n) delta++;
        if (input[i] === n) {
          var q = delta;
          for (var k = BASE; ; k += BASE) {
            var t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias; if (q < t) break;
            out.push(digit(t + (q - t) % (BASE - t))); q = Math.floor((q - t) / (BASE - t));
          }
          out.push(digit(q)); bias = adapt(delta, h + 1, h === b); delta = 0; h++;
        }
      }
      delta++; n++;
    }
    return out.join('');
  }
  function decode(str) {
    var out = [], b = str.lastIndexOf('-'), i, n = INIT_N, bias = INIT_BIAS; if (b < 0) b = 0;
    for (i = 0; i < b; i++) { if (str.charCodeAt(i) >= 128) throw new Error('Non-ASCII before the last hyphen'); out.push(str.charCodeAt(i)); }
    var idx = 0;
    for (var pos = b > 0 ? b + 1 : 0; pos < str.length;) {
      var oldi = idx, w = 1;
      for (var k = BASE; ; k += BASE) {
        if (pos >= str.length) throw new Error('Truncated: ends in the middle of a number');
        var c = str.charCodeAt(pos++), d = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : BASE;
        if (d >= BASE) throw new Error('Invalid character "' + str[pos - 1] + '"');
        idx += d * w; if (idx > 0x7fffffff) throw new Error('Overflow');
        var t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias; if (d < t) break; w *= BASE - t;
      }
      bias = adapt(idx - oldi, out.length + 1, oldi === 0); n += Math.floor(idx / (out.length + 1)); idx %= out.length + 1;
      if (n > 0x10ffff || (n >= 0xd800 && n < 0xe000)) throw new Error('Not a valid code point');
      out.splice(idx++, 0, n);
    }
    return String.fromCodePoint.apply(null, out);
  }
  // Mapping step (simplified, only what differs between the three profiles is spelled out):
  //  idna2003: NFKC + case fold, ss for sharp s, final sigma folded, joiners and soft hyphen removed
  //  uts46:    NFKC + lowercase, sharp s and final sigma kept (non-transitional), joiners kept
  //  idna2008: no mapping at all, uppercase and compatibility characters are rejected
  var JOIN = /[\u200c\u200d\u00ad\u200b\u2060\ufeff]/g;
  function mapLabel(label, profile) {
    var notes = [], s = label;
    if (profile === 'idna2008') {
      if (s !== s.toLowerCase() || s !== s.normalize('NFC')) return { error: 'IDNA2008 rejects uppercase or non-NFC characters (no mapping step).' };
      return { label: s, notes: notes };
    }
    if (profile === 'idna2003') {
      var t = s.replace(JOIN, ''); if (t !== s) notes.push('Zero-width and soft-hyphen characters are deleted.'); s = t;
      s = s.normalize('NFKC').replace(/\u03a3/g, '\u03c3').toLowerCase();
      if (/[\u00df\u03c2]/.test(s)) { notes.push('Sharp s becomes ss and final sigma becomes sigma.'); s = s.replace(/\u00df/g, 'ss').replace(/\u03c2/g, '\u03c3'); }
      return { label: s, notes: notes };
    }
    var u = s.normalize('NFKC').replace(/\u03a3/g, '\u03c3').toLowerCase(); if (u !== s) notes.push('Mapped to lowercase and compatibility forms.');
    return { label: u, notes: notes };
  }
  function toASCIILabel(label, profile) {
    var m = mapLabel(label, profile); if (m.error) return { error: m.error };
    if (!m.label) return { error: 'Empty label.' };
    var l = m.label, a = /^[\x00-\x7f]*$/.test(l) ? l : 'xn--' + encode(l);
    if (a.length > 63) return { error: 'Label is ' + a.length + ' characters in ASCII form; the limit is 63.', ascii: a, notes: m.notes };
    return { ascii: a, notes: m.notes, mapped: l };
  }
  function toASCII(domain, profile) {
    var labels = String(domain).split(/[.\u3002\uff0e\uff61]/), out = [], notes = [], err = null;
    labels.forEach(function (l, i) { var r = toASCIILabel(l, profile); if (r.error) { if (!err) err = r.error; out.push(r.ascii || ''); } else { out.push(r.ascii); notes = notes.concat(r.notes); } });
    var res = out.join('.'); if (!err && res.length > 253) err = 'Whole name is ' + res.length + ' characters; the limit is 253.';
    return { ascii: res, error: err, notes: notes };
  }
  function toUnicode(domain) {
    return String(domain).split('.').map(function (l) { if (/^xn--/i.test(l)) { try { return decode(l.slice(4)); } catch (e) { return '[invalid: ' + e.message + ']'; } } return l; }).join('.');
  }
  var api = { encode: encode, decode: decode, toASCII: toASCII, toASCIILabel: toASCIILabel, toUnicode: toUnicode, mapLabel: mapLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PunyWhy = api;
})(typeof window !== 'undefined' ? window : this);
