// Reads a JSON list of domains on stdin, prints Node's WHATWG domainToASCII (UTS 46, non-transitional) and the legacy punycode module results.
var url = require('url'), data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
process.removeAllListeners('warning');
console.log(JSON.stringify(data.map(function (d) { var r = url.domainToASCII(d); return r === '' ? 'ERR' : r; })));
