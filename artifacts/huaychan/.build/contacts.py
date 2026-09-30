from PIL import Image,ImageDraw
from pathlib import Path
b=Path('D:/tonpalmproject/artifacts/huaychan/.build')
for folder,prefix,n,cols,w,step in [('docx-render','page-',40,4,480,8),('slide-render','slide-',22,3,640,6)]:
 for start in range(1,n+1,step):
  count=min(step,n-start+1); thumbs=[]
  for i in range(start,start+count):
   im=Image.open(b/folder/f'{prefix}{i}.png');im.thumbnail((w,700));thumbs.append((i,im))
  rh=max(im.height for _,im in thumbs)+30
  out=Image.new('RGB',(cols*w,((count+cols-1)//cols)*rh),'#cccccc');dr=ImageDraw.Draw(out)
  for j,(i,im) in enumerate(thumbs):
   x=(j%cols)*w;y=(j//cols)*rh;out.paste(im,(x,y+25));dr.text((x+8,y+4),str(i),fill='black')
  out.save(b/f'{folder}-contact-{start}.png')
