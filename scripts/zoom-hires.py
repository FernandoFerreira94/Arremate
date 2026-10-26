"""D28: gera a versão de zoom (~2500 px no lado maior) de cada obra do catálogo demo e das fixtures do E2E.

Fonte: o mesmo objeto do The Met Open Access (CC0) já usado no catálogo (primaryImage = arquivo original).
Saída: <destino>/<externalId>.jpg + manifest.json (origem, tamanho original, tamanho gerado, sha256).
Uso: python scripts/zoom-hires.py .data/media/zoom   (precisa de Python 3 + Pillow; só rede pública do Met)
"""
import hashlib, io, json, re, sys, time, urllib.request
from pathlib import Path
from PIL import Image

TARGET = 2500
API = "https://collectionapi.metmuseum.org/public/collection/v1/objects/"
ROOT = Path(__file__).resolve().parent.parent

def ids():
    seed = (ROOT / "back-end/prisma/seed-catalog.ts").read_text(encoding="utf-8")
    e2e = (ROOT / "e2e/support/api-session.ts").read_text(encoding="utf-8")
    found = re.findall(r'externalId: "(\d+)"', seed)
    m = re.search(r"MET_IDS = \[([^\]]*)\]", e2e)
    found += re.findall(r'"(\d+)"', m.group(1)) if m else []
    return list(dict.fromkeys(found))

def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "arremate-demo/1.0 (zoom D28)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception:
            if i == tries - 1: raise
            time.sleep(2 * (i + 1))

def main(out):
    out.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for oid in ids():
        obj = json.loads(get(API + oid))
        if not obj.get("isPublicDomain"): raise SystemExit(f"{oid}: sem domínio público")
        src = obj.get("primaryImage") or obj.get("primaryImageSmall")
        if not src.startswith("https://images.metmuseum.org/"): raise SystemExit(f"{oid}: origem inesperada")
        img = Image.open(io.BytesIO(get(src))); img.load()
        original = img.size
        img = img.convert("RGB")
        if max(original) > TARGET:
            scale = TARGET / max(original)
            img = img.resize((round(original[0] * scale), round(original[1] * scale)), Image.LANCZOS)
        buf = io.BytesIO(); img.save(buf, "JPEG", quality=85, optimize=True, progressive=True)
        data = buf.getvalue(); (out / f"{oid}.jpg").write_bytes(data)
        manifest[oid] = {"source": src, "original": list(original), "zoom": list(img.size), "full": max(img.size) >= TARGET, "sha256": hashlib.sha256(data).hexdigest()}
        print(oid, original, "->", img.size, flush=True)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / ".data/media/zoom"))
