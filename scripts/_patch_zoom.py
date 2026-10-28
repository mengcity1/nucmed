"""让分子组成的三段小图也能点击放大（灯箱改为存 src 字符串）。"""
from pathlib import Path

P = Path(r"D:\nucmed\web\src\pages\DrugDetail.tsx")
text = P.read_text(encoding="utf-8")
orig = text

PAIRS = [
    # 1) state: boolean -> 存图片地址（null = 关闭）
    (
        "const [zoom, setZoom] = useState(false);",
        "const [zoom, setZoom] = useState<string | null>(null);",
    ),
    # 2) 整药结构图点击：传实际图片地址
    (
        "                onClick={() => setZoom(true)}",
        "                onClick={() => setZoom(`${import.meta.env.BASE_URL}struct/${drug.drug_id}.webp`)}",
    ),
    # 3) 三段小图：加 onClick + 放大光标
    (
        '                  className="mt-2 w-full rounded border border-[#eef2f8] bg-white"\n',
        '                  onClick={() => setZoom(`${import.meta.env.BASE_URL}parts/${drug.drug_id}_${p.part}.png`)}\n'
        + '                  className="mt-2 w-full cursor-zoom-in rounded border border-[#eef2f8] bg-white transition hover:opacity-90"\n',
    ),
    # 4) 灯箱：显示被点的那张
    (
        "            src={`${import.meta.env.BASE_URL}struct/${drug.drug_id}.webp`}\n"
        + "            alt={drug.name_en}\n"
        + '            className="max-h-[90vh] max-w-[90vw] rounded-xl bg-white p-6 shadow-2xl"',
        "            src={zoom}\n"
        + '            alt="放大预览"\n'
        + '            className="max-h-[90vh] max-w-[90vw] rounded-xl bg-white p-6 shadow-2xl"',
    ),
    # 5) 关闭：回到 null
    (
        "          onClick={() => setZoom(false)}",
        "          onClick={() => setZoom(null)}",
    ),
]

for old, new in PAIRS:
    if old not in text:
        print("MISS:", old.strip()[:60])
    else:
        text = text.replace(old, new, 1)
        print("OK  :", old.strip()[:60])

if text != orig:
    P.write_text(text, encoding="utf-8", newline="\n")
    print("written", len(orig), "->", len(text))
else:
    print("no change")
