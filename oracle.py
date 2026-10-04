import json, sys, idna
cases = json.load(sys.stdin)
out = []
for c in cases:
    d = c['d']; r = {}
    if c['k'] == 'punyenc':
        try: r = d.encode('punycode').decode('ascii')
        except Exception as e: r = 'ERR'
    elif c['k'] == 'punydec':
        try: r = d.encode('ascii').decode('punycode')
        except Exception as e: r = 'ERR'
    elif c['k'] == '2003':
        try: r = d.encode('idna').decode('ascii')
        except Exception as e: r = 'ERR'
    elif c['k'] == 'uts46':
        try: r = idna.encode(d, uts46=True, transitional=False).decode('ascii')
        except Exception as e: r = 'ERR'
    elif c['k'] == '2008':
        try: r = idna.encode(d, uts46=False, strict=False).decode('ascii')
        except Exception as e: r = 'ERR'
    out.append(r)
json.dump(out, sys.stdout)
