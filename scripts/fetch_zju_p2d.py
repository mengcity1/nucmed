"""抓回浙大 p2d 原图（1,996 张）· 断点续跑 · ≤2 req/s"""
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(r"D:\nucmed")
MAN = ROOT / "data" / "raw" / "_harvest" / "ext" / "radiopharm_p2d" / "_manifest.json"
OUT = ROOT / "data" / "raw" / "_harvest" / "ext" / "radiopharm_p2d" / "png"
LOG = ROOT / "logs" / "zju_p2d_fetch.log"
OUT.mkdir(parents=True, exist_ok=True)

man = json.loads(MAN.read_text(encoding="utf-8"))
items = [(k, v) for k, v in man.items()]
log = LOG.open("a", encoding="utf-8")


def w(msg):
    log.write(f"{time.strftime('%H:%M:%S')} {msg}\n")
    log.flush()


ok = skip = fail = 0
for i, (did, v) in enumerate(items, 1):
    url = v.get("url")
    dst = OUT / f"{did}.png"
    if dst.exists() and dst.stat().st_size > 1000:
        skip += 1
        continue
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "nucmed/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        if data[:4] != b"\x89PNG":
            fail += 1
            w(f"FAIL not-png {did}")
            continue
        dst.write_bytes(data)
        ok += 1
    except Exception as e:
        fail += 1
        w(f"FAIL {did} {type(e).__name__} {str(e)[:60]}")
    if i % 50 == 0:
        w(f"progress {i}/{len(items)} ok={ok} skip={skip} fail={fail}")
    time.sleep(0.5)

w(f"DONE total={len(items)} ok={ok} skip={skip} fail={fail}")
log.close()
