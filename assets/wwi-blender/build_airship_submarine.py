"""WWI Zeppelin and U-boat gallery reconstructions; simplified external features."""
from build_exhibits import *

def hull(name,sections,mat,sides=32):
    verts=[]
    for x,ry,rz,z in sections:
        verts.extend((x,ry*math.sin(i*math.tau/sides),z+rz*math.cos(i*math.tau/sides)) for i in range(sides))
    faces=[]
    for j in range(len(sections)-1):
        for i in range(sides):faces.append((j*sides+i,(j+1)*sides+i,(j+1)*sides+(i+1)%sides,j*sides+(i+1)%sides))
    faces += [tuple(range(sides)),tuple((len(sections)-1)*sides+i for i in range(sides-1,-1,-1))]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    for p in mesh.polygons:p.use_smooth=True
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,mat)
    return o

def fin(name,vertices,mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],[tuple(range(len(vertices)))]);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,mat)
    mod=o.modifiers.new('Fin thickness','SOLIDIFY');mod.thickness=.025
    return o

def zeppelin():
    material('Airship_Fabric',(.54,.53,.46),.05,.85)
    material('Airship_Seams',(.39,.39,.35),.15,.8)
    material('Gondola_Aluminium',(.27,.29,.27),.55,.55)
    sections=[]
    for j in range(41):
        t=j/40
        # Rigid airship nose fullness and tapered cruciform tail, unlike a blimp.
        r=max(.008,math.sin(math.pi*t)**.40)
        if t<.18:r*=.70+.30*t/.18
        sections.append((-7.9+15.8*t,r*.91,r*.91,0))
    hull('Rigid fabric envelope',sections,'Airship_Fabric',40)
    for j in range(2,39,3):
        x,ry,rz,z=sections[j]
        tube('Frame ring seam',[(x,(ry+.008)*math.sin(i*math.tau/40),(rz+.008)*math.cos(i*math.tau/40)) for i in range(41)],.007,'Airship_Seams')
    for i in range(12):
        a=i*math.tau/12
        tube('Longitudinal fabric seam',[(x,(ry+.006)*math.sin(a),(rz+.006)*math.cos(a)) for x,ry,rz,z in sections],.005,'Airship_Seams')
    # Tail is aft (-X). Four stabilizing surfaces and visible control lines.
    for angle in [0,math.pi/2,math.pi,3*math.pi/2]:
        points=[(-7.35,.08),(-5.05,.70),(-5.70,1.74),(-7.28,1.17)]
        fin('Cruciform tail fin',[(x,r*math.sin(angle),r*math.cos(angle)) for x,r in points],'Airship_Fabric')
        tube('Tail fin seam',[(x,r*math.sin(angle),r*math.cos(angle)) for x,r in [(-6.85,.4),(-6.73,1.31)]],.008,'Airship_Seams')
    for x,length in [(3.10,1.55),(-3.1,1.70)]:
        box('Suspended gondola',(x,0,-1.25),(length,.36,.35),'Gondola_Aluminium',.10)
        for dx in [-.5,.5]:
            for y in [-.16,.16]:rod('Gondola suspension',(x+dx,y,-.72),(x+dx,y,-1.08),.016,'Burnished_Steel',6)
        for dx in [-.32,-.12,.08]:box('Gondola window',(x+dx,-.185,-1.20),(.12,.014,.095),'Dark_Blued_Steel')
    for x,y in [(-2.6,-.78),(-2.6,.78),(2.55,0)]:
        ellipsoid('Engine car',(x,y,-1.09),(.40,.18,.20),'Gondola_Aluminium',20,10)
        rod('Propeller shaft',(x-.4,y,-1.09),(x-.56,y,-1.09),.025,'Burnished_Steel')
        for a in [0,math.pi]:
            blade=ellipsoid('Engine propeller',(x-.57,y+math.sin(a)*.23,-1.09+math.cos(a)*.23),(.025,.05,.29),'Walnut_Wood',12,6)
            blade.rotation_euler.x=-a
        tube('Engine car support',[(x-.25,y,-1.0),(x-.25,y*.4,-.72)],.017,'Burnished_Steel')
    tube('Underside keel walkway',[(-5,0,-.94),(4.6,0,-.94)],.022,'Gondola_Aluminium')
    # No invented serial numbers or post-1918 markings.

def uboat():
    material('Submarine_Grey',(.29,.33,.34),.45,.62)
    material('Pressure_Hull_Dark',(.11,.15,.16),.55,.55)
    material('Deck_Timber',(.24,.19,.13),0,.85)
    # Representative WWI ocean-going boat with raised bow, narrow slotted casing,
    # modest bridge, two periscopes and one deck gun. Not a WWII Type VII tower.
    sections=[]
    for j in range(41):
        t=j/40;r=max(.008,math.sin(math.pi*t)**.46)
        sections.append((-5.75+11.5*t,r*.54,r*.49,.55))
    hull('Pressure hull',sections,'Pressure_Hull_Dark',32)
    casing=[(-5.65,.03,.07,.96),(-4.8,.22,.10,1.02),(-3,.39,.12,1.06),(0,.42,.12,1.06),(3,.36,.12,1.06),(4.8,.18,.16,1.08),(5.64,.015,.19,1.09)]
    hull('Raised external casing',casing,'Submarine_Grey',24)
    # Flat, tapering deck on the top of the casing.
    deckpoints=[(-5.4,.025),(-4.7,.16),(-3,.31),(0,.33),(3,.27),(4.7,.13),(5.58,.006)]
    vertices=[(x,-y,1.185) for x,y in deckpoints]+[(x,y,1.185) for x,y in reversed(deckpoints)]
    fin('Narrow wooden deck',vertices,'Deck_Timber')
    for y in [-.21,-.105,0,.105,.21]:rod('Deck plank seam',(-3.9,y,1.205),(3.7,y,1.205),.006,'Dark_Blued_Steel',4)
    for side in [-1,1]:
        for j in range(35):
            x=-4.65+j*.27; y=side*(.20+.18*math.sin((x+4.65)/9.3*math.pi))
            box('Casing flood slot',(x,y,1.02),(.11,.018,.045),'Dark_Blued_Steel',.009)
    box('Conning tower',(0,0,1.62),(1.10,.60,.83),'Submarine_Grey',.16)
    ellipsoid('Open bridge well',(0,0,2.05),(.49,.25,.055),'Dark_Blued_Steel',28,8)
    for y in [-.27,.27]:tube('Bridge coaming',[(-.42,y,2.03),(-.42,y,2.18),(.40,y,2.18),(.48,y,2.03)],.028,'Submarine_Grey')
    for x,z in [(-.17,2.94),(.20,2.76)]:
        rod('Periscope',(x,0,1.82),(x,0,z),.028,'Burnished_Steel',12)
        rod('Periscope head',(x,0,z),(x+.12,0,z),.038,'Dark_Blued_Steel',12)
    # Deck gun forward of bridge.
    rod('Deck gun pedestal',(1.65,0,1.19),(1.65,0,1.55),.11,'Submarine_Grey',16)
    box('Deck gun breech',(1.57,0,1.62),(.35,.18,.19),'Dark_Blued_Steel',.02)
    rod('Deck gun barrel',(1.69,0,1.66),(2.65,0,1.75),.045,'Submarine_Grey',16,r2=.027)
    rod('Deck gun open bore',(2.651,0,1.75),(2.66,0,1.751),.018,'Rubber',12)
    torus('Deck hatch',(-2.15,0,1.22),.18,.025,'Submarine_Grey',segments=24)
    rod('Hatch cover',(-2.15,0,1.21),(-2.15,0,1.245),.17,'Submarine_Grey',24)
    for x in [-4.5,4.5]:
        fin('Hydroplane',[(x-.3,-.85,.66),(x+.35,-.55,.66),(x+.35,.55,.66),(x-.3,.85,.66)],'Submarine_Grey')
    fin('Stern rudder',[(-5.48,0,.15),(-5.00,0,.15),(-5.0,0,.94),(-5.75,0,.80)],'Submarine_Grey')
    for y in [-.27,.27]:
        rod('Propeller shaft',(-4.65,y,.39),(-5.30,y,.39),.028,'Burnished_Steel')
        for j in range(3):
            a=j*math.tau/3
            blade=ellipsoid('Bronze propeller blade',(-5.22,y+.13*math.sin(a),.39+.13*math.cos(a)),(.035,.065,.16),'Brass',12,6)
            blade.rotation_euler.x=-a
    for x in [-4,-3,1,2.7,4.2]:
        for y in [-.24,.24]:rod('Low deck rail stanchion',(x,y,1.19),(x,y,1.40),.012,'Burnished_Steel',6)
    for y in [-.24,.24]:tube('Deck safety wire',[(-4,y,1.40),(-3,y,1.40),(-1,y,1.40)],.008,'Burnished_Steel')
    for a,b in [((-4.7,0,1.2),(-.12,0,2.35)),((.25,0,2.30),(4.7,0,1.23))]:tube('Wireless aerial', [a,b],.007,'Dark_Blued_Steel')

if __name__=='__main__':
    builders={'zeppelin_1915':zeppelin,'uboat_1916':uboat}
    for key in ([a for a in sys.argv[1:] if a in builders] or list(builders)):
        reset();builders[key]();export(key)
