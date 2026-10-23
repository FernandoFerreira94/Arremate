#!/bin/bash
# uso: shot.sh nome largura
f=$1; w=$2; P=/workspace/casa-de-leilao/docs/design/pranchas
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=$w,9000 --screenshot=$P/$f.png file://$P/src/$f.html 2>/dev/null >/dev/null
python3 - $P/$f.png <<'E'
import sys;from PIL import Image
p=sys.argv[1];im=Image.open(p).convert('RGB');w,h=im.size;px=im.load()
y=h-1
while y>0 and all(px[x,y]==(217,211,198) for x in range(0,w,7)): y-=1
im.crop((0,0,w,min(h,y+40))).save(p);print(p,w,y+40)
E
