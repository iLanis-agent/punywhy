# PunyWhy

Shows the ASCII (xn--) form of an international domain name under three rule sets (UTS 46 non-transitional as used by browsers, IDNA2003, IDNA2008), decodes xn-- names, and asks your own browser what it does.

Open `app.html` (static, client-side). Run `node test-engine.js` for the checks (needs python3 with the `idna` package).

## Sources
- RFC 3492 (Punycode): https://www.rfc-editor.org/rfc/rfc3492.txt, read directly (algorithm constants and section 7.1 sample strings A to S, parsed into rfc-vectors.json).
- The mapping rules for UTS 46, IDNA2003 and IDNA2008 were NOT read from their specifications. The mapping here is a simplified model (NFKC, lowercase, sharp s, final sigma, joiners). It was checked only against the oracles below.

## Checks
- All 19 RFC 3492 sample strings encode and decode correctly (case-insensitive, because the RFC samples use case annotation).
- 5000 random strings: encode and decode vs the Python punycode codec, plus round trips.
- Whole-name conversion vs Node `url.domainToASCII` (UTS 46), Python `str.encode('idna')` (IDNA2003) and the Python `idna` package (UTS 46 non-transitional). About half of the random strings are rejected by the oracles under validity rules (bidi, disallowed characters, hyphen positions) that this engine does not model, so they are not compared; the rest agree except a few compatibility-character cases listed by the test output.
- All-digit and 0x names are skipped, because URL parsers read them as IPv4 addresses.

## Limits
Not a validator. A result does not mean a registry or browser accepts the name.
