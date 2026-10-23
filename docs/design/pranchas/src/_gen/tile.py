import sys;from PIL import Image
for f in sys.argv[1:]:
    im=Image.open(f'/workspace/casa-de-leilao/docs/design/pranchas/{f}.png');w,h=im.size;n=0
    for y in range(0,h,1000):
        for x in range(0,w,1000):
            im.crop((x,y,min(w,x+1000),min(h,y+1000))).save(f'/tmp/t_{f}_{n}.png');n+=1
    print(f,n)
