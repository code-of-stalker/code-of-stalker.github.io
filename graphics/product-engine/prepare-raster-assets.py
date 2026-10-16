"""Prepare only immutable raster/soft assets from the approved supplied artwork.
No animation frames are baked: every moving position is evaluated by Rust.
"""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'engine' / 'assets'
PUBLIC = ROOT.parent.parent / 'public' / 'graphics'
ASSETS.mkdir(exist_ok=True)

def radial(w, h, stops, rgb):
    y, x = np.mgrid[:h, :w]
    r = np.sqrt(((x+.5-w/2)/(w/2))**2 + ((y+.5-h/2)/(h/2))**2)
    alpha = np.interp(r, [p for p,a in stops], [a for p,a in stops])
    arr = np.empty((h,w,4), np.uint8); arr[:,:,:3] = rgb; arr[:,:,3] = np.rint(alpha*255).astype(np.uint8)
    return Image.fromarray(arr)

def polygon_mask(size, points, stroke, blur):
    image = Image.new('L',size); draw = ImageDraw.Draw(image)
    draw.polygon(points, fill=255); draw.line(points+[points[0]], fill=255, width=stroke, joint='curve')
    return image.filter(ImageFilter.GaussianBlur(blur))

def alpha_mask(image, mask):
    image = image.copy(); arr = np.array(image); arr[:,:,3] = np.rint(arr[:,:,3].astype(float)*np.array(mask)/255).astype(np.uint8)
    return Image.fromarray(arr)

def atlas(name, images):
    # Rows are fixed and cached. No texture packing or allocation in a frame.
    width = 4096; height = 1; x=y=row=0; placements=[]
    for key,im in images:
        w,h=im.size
        if x+w+2>width: x=0; y+=row+2; row=0
        placements.append((key,im,x+1,y+1)); x+=w+2; row=max(row,h); height=max(height,y+h+2)
    image=Image.new('RGBA',(width,height)); entries=[]
    for key,im,x,y in placements:
        image.paste(im,(x,y)); entries.append((key,[x,y,*im.size]))
    image.save(ASSETS/(name+'-atlas.png'), optimize=True)
    text='pub const SIZE:[u32;2]=['+str(width)+','+str(height)+'];\n'
    for key,rect in entries:text+='pub const '+key.upper()+':[f32;4]=['+','.join(str(v)+'.' for v in rect)+'];\n'
    (ASSETS/(name+'-atlas.rs')).write_text(text,encoding='utf8')

def gallery(sand=False):
    source=Image.open(ASSETS/'gallery-sand-approved.webp' if sand else PUBLIC/'gallery.webp').convert('RGBA'); source=source.resize((1487,1058),Image.Resampling.LANCZOS) if source.size!=(1487,1058) else source
    polygons=[[(52,247),(234,314),(233,709),(52,761)],[(255,175),(432,236),(432,574),(255,633)],[(464,161),(615,214),(615,512),(464,547)],[(873,214),(1024,161),(1024,547),(873,512)],[(1055,237),(1232,175),(1232,633),(1055,580)],[(1254,315),(1436,247),(1436,761),(1254,709)]]
    images=[]; cards=[]; combined=Image.new('L',source.size)
    for i,p in enumerate(polygons):
        x=math.floor(min(a for a,b in p)-23); y=math.floor(min(b for a,b in p)-23)
        w=math.ceil(max(a for a,b in p)-x+23); h=math.ceil(max(b for a,b in p)-y+23)
        local=[(a-x,b-y) for a,b in p]; mask=polygon_mask((w,h),local,19,2)
        card=alpha_mask(source.crop((x,y,x+w,y+h)),mask)
        images.append(('card'+str(i),card)); arr=np.array(card); brightness=np.maximum(0,(arr[:,:,0]/255-.35)/.65)**1.5; arr[:,:,3]=np.rint(arr[:,:,3]*brightness).astype(np.uint8)
        images.append(('light'+str(i),Image.fromarray(arr))); cards.append([x,y,w,h])
        cut=polygon_mask(source.size,p,31,4); combined=Image.fromarray(np.maximum(np.array(combined),np.array(cut)))
    backplate=alpha_mask(source,Image.fromarray(255-np.array(combined)))
    # Erase the four original spheres, then paint their original pixels as sprites.
    pixels=np.array(backplate); yy,xx=np.mgrid[:1058,:1487]
    for x,y,r in [(351,701,14),(523,678,6),(965,678,6),(1135,701,14)]:
        distance=np.sqrt((xx-x)**2+(yy-y)**2); erase=np.clip((r+13-distance)/10,0,1)
        if sand: pixels[:,:,3]=np.rint(pixels[:,:,3]*(1-erase)).astype(np.uint8)
        else: pixels[:,:,:3]=np.rint(pixels[:,:,:3]*(1-erase[:,:,None])).astype(np.uint8)
    backplate=Image.fromarray(pixels); images.insert(0,('base',backplate))
    for key,x,y,r in [('sphere_large',351,701,14),('sphere_small',523,678,6)]:
        sphere=source.crop((x-32,y-32,x+32,y+32)); yy,xx=np.mgrid[:64,:64]; radius=np.sqrt((xx+.5-32)**2+(yy+.5-32)**2); mask=Image.fromarray(np.rint(np.clip((r+6-radius)/7,0,1)*255).astype(np.uint8)); images.append((key,alpha_mask(sphere,mask)))
    emission=source.crop((625,0,859,1058)); arr=np.array(emission); xx=np.arange(234)[None,:]; edge=np.maximum(0,1-np.abs(xx-118)/118)**.6; brightness=np.maximum(0,(arr[:,:,0]/255-.18)/.82)**1.6; arr[:,:,3]=np.rint((arr[:,:,3] if sand else 255)*edge*brightness).astype(np.uint8); images.append(('emission',Image.fromarray(arr)))
    halos=[('base_halo',(255,102,0)),('top_halo',(255,245,190)),('ground_halo',(255,199,89)),('glint',(255,242,177))] if sand else [('base_halo',(255,184,14)),('top_halo',(255,222,62)),('ground_halo',(255,208,22)),('glint',(255,218,90))]
    for key,rgb in halos:images.append((key,radial(192,192,[(0,.8),(.08,.42),(.28,.14),(1,0)],rgb)))
    floor=source.crop((0,632,1487,1044)); arr=np.array(floor); yy,xx=np.mgrid[:412,:1487]; full=yy+632; half=np.where(full<748,50,42); gate=np.clip((half-np.abs(xx-743))/8,0,1)*np.clip((850-full)/6,0,1); alpha=gate*np.clip((arr[:,:,0].astype(float)-48)/120,0,1); arr[:,:,:3]=255; arr[:,:,3]=np.rint(alpha*255).astype(np.uint8);images.append(('floor_mask',Image.fromarray(arr)))
    name='gallery-sand' if sand else 'gallery'
    images.append(('white',Image.new('RGBA',(2,2),(255,255,255,255))));atlas(name,images)
    with (ASSETS/(name+'-atlas.rs')).open('a',encoding='utf8') as file:file.write('pub const CARDS:[[f32;4];6]=['+','.join('['+','.join(str(v)+'.' for v in rect)+']' for rect in cards)+'];\n')

def mirror():
    source=Image.open(PUBLIC/'mirror.webp').convert('RGBA'); source=source.resize((576,410),Image.Resampling.LANCZOS) if source.size!=(576,410) else source
    curves=[(155,391,149,356,145,324),(141,294,141,262,149,231),(153,211,175,199,191,191),(201,184,203,177,199,165),(190,150,195,130,201,122),(210,111,229,109,242,118),(256,127,256,148,249,163),(246,174,237,180,244,191),(255,199,275,205,282,224),(288,243,286,267,292,291),(298,320,305,354,305,386),(307,398,303,406,298,410)]
    p=(157,410); points=[p]
    for x1,y1,x2,y2,x,y in curves:
        for i in range(1,41):
            t=i/40; u=1-t; points.append((u**3*p[0]+3*u*u*t*x1+3*u*t*t*x2+t**3*x,u**3*p[1]+3*u*u*t*y1+3*u*t*t*y2+t**3*y))
        p=(x,y)
    solid=Image.new('L',source.size);ImageDraw.Draw(solid).polygon(points,fill=255)
    hero=solid.filter(ImageFilter.GaussianBlur(2.4)); occlusion=solid.copy();ImageDraw.Draw(occlusion).line(points+[points[0]],fill=255,width=5,joint='curve');occlusion=occlusion.filter(ImageFilter.GaussianBlur(.65))
    yy,xx=np.mgrid[:410,:576]; face=np.zeros((410,576))
    for x,y,rx,ry in [(65,179,38,56),(145,148,49,76),(322,134,64,92),(439,176,46,73),(530,159,43,79)]:
        r=np.sqrt(((xx+.5-x)/rx)**2+((yy+.5-y)/ry)**2);a=np.clip((1-r)/.56,0,1);face=1-(1-face)*(1-a)
    face*=1-np.array(hero)/255;code=np.clip((340-(yy+.5))/65,0,1)*((xx>=20)&(xx<562));code*=1-np.array(occlusion)/255;code*=1-face
    # Laboratory draws this border with destination-out, after removing the
    # foreground. Adding it back lets rain/attenuation cut through the hero.
    wall=Image.new('L',source.size);ImageDraw.Draw(wall).line([(43,77),(550,10),(548,305),(42,281),(43,77)],fill=255,width=9,joint='curve');code*=1-np.array(wall)/255
    mask=np.zeros((410,576,4),np.uint8);mask[:,:,0]=np.array(hero);mask[:,:,1]=np.rint(face*255).astype(np.uint8);mask[:,:,2]=np.rint(code*255).astype(np.uint8);mask[:,:,3]=255
    energy=np.zeros_like(mask);energy[:,:,0]=np.array(hero.filter(ImageFilter.GaussianBlur(12)));energy[:,:,1]=np.array(hero.filter(ImageFilter.GaussianBlur(30)));energy[:,:,2]=np.array(occlusion);energy[:,:,3]=255
    images=[('base',source),('mask',Image.fromarray(mask)),('energy',Image.fromarray(energy)),('emission',alpha_mask(source,hero)),('glint',radial(64,64,[(0,.95),(.1,.45),(.35,.12),(1,0)],(255,229,107))),('white',Image.new('RGBA',(2,2),(255,255,255,255)))]
    atlas('mirror',images)

if __name__ == '__main__':
    gallery(); gallery(sand=True); mirror(); print('Prepared immutable gallery, sand gallery and mirror assets')
