"""Editable classroom reconstructions. Run with Blender Python (bpy 5.2).

Axes: X = length, Y = width, Z = up. Dimensions are gallery display units.
Geometry is joined by material before uncompressed, texture-free GLB export.
Sources and deliberate simplifications are recorded in README.md.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector

BASE = Path(__file__).resolve().parents[2]
OUT = BASE / 'public/hubs/ush9-the-arsenal/models'
SOURCE = BASE / 'assets/wwi-blender'
OUT.mkdir(parents=True, exist_ok=True)
M = {}

def material(name, color, metal=0, rough=.65):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    M[name]=m
    return m

def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for d in list(bpy.data.materials): bpy.data.materials.remove(d)
    M.clear()
    material('Olive_Painted_Metal',(.19,.23,.12),.3)
    material('Dark_Blued_Steel',(.07,.085,.09),.65,.38)
    material('Burnished_Steel',(.30,.32,.30),.7,.38)
    material('Walnut_Wood',(.25,.105,.04),0,.6)
    material('Canvas_Linen',(.50,.43,.27),0,.9)
    material('Brass',(.55,.35,.10),.7,.35)
    material('Rubber',(.035,.04,.035),0,.85)
    material('Doped_Linen',(.42,.39,.23),0,.85)
    material('Roundel_Blue',(.025,.07,.16),0,.7)
    material('Roundel_White',(.80,.77,.66),0,.8)
    material('Roundel_Red',(.45,.035,.025),0,.7)

def finish(o,name,mat):
    o.name=name; o.data.materials.append(M[mat]); return o

def box(name,loc,size,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object
    o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        m=o.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=2
        bpy.ops.object.modifier_apply(modifier=m.name)
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return finish(o,name,mat)

def rod(name,a,b,r,mat,vertices=12,r2=None):
    a,b=Vector(a),Vector(b);d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    finish(o,name,mat)
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return o

def ellipsoid(name,loc,size,mat,segments=24,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc)
    o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for f in o.data.polygons:f.use_smooth=True
    return finish(o,name,mat)

def tube(name,points,r,mat,sides=6):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1
    c.bevel_depth=r;c.bevel_resolution=0;c.resolution_u=2;c.resolution_v=sides
    sp=c.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o)
    c.materials.append(M[mat]);return o

def torus(name,loc,major,minor,mat,axis='Z',segments=32):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=segments,minor_segments=6,location=loc)
    o=bpy.context.object
    if axis=='Y':o.rotation_euler.x=math.pi/2
    if axis=='X':o.rotation_euler.y=math.pi/2
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat)

def wheel(x,y,z,r,spokes=12):
    torus('Steel wheel tyre',(x,y,z),r-.025,.025,'Dark_Blued_Steel','Y')
    torus('Wooden felloe',(x,y,z),r-.07,.045,'Walnut_Wood','Y')
    rod('Axle hub',(x,y-.11,z),(x,y+.11,z),.11,'Olive_Painted_Metal',16)
    for i in range(spokes):
        a=i*math.tau/spokes
        rod('Tapered wooden spoke',(x,y,z),(x+math.sin(a)*(r-.07),y,z+math.cos(a)*(r-.07)),.035,'Walnut_Wood',6,r2=.023)

def vickers():
    # Water-cooled Vickers Mk I on tripod: jacket, muzzle booster, box receiver,
    # two spade grips, steam hose, condenser can and belt-fed ammunition.
    z=1.48
    box('Receiver',(-.65,0,z),(.78,.30,.34),'Dark_Blued_Steel',.025)
    rod('Water jacket',(-.26,0,z),(1.02,0,z),.175,'Dark_Blued_Steel',32)
    for x in [-.24,1.0]:torus('Jacket end seam',(x,0,z),.177,.013,'Burnished_Steel','X')
    rod('Muzzle booster',(1.02,0,z),(1.22,0,z),.075,'Burnished_Steel',20,r2=.057)
    rod('Open muzzle',(1.222,0,z),(1.228,0,z),.037,'Rubber',16)
    box('Feed block',(-.51,0,z+.19),(.30,.36,.08),'Burnished_Steel',.015)
    box('Rear sight',(-.90,0,z+.23),(.08,.07,.17),'Dark_Blued_Steel',.008)
    box('Front sight',(.88,0,z+.20),(.06,.035,.11),'Dark_Blued_Steel')
    for y in [-.19,.19]:
        rod('Spade grip',(-1.07,y,z-.14),(-1.07,y,z+.16),.043,'Walnut_Wood')
        rod('Grip bracket',(-.97,0,z),(-1.07,y,z),.026,'Burnished_Steel')
    box('Tripod saddle',(-.31,0,1.21),(.37,.31,.14),'Olive_Painted_Metal',.02)
    for p in [(1.0,-.82,.04),(1.0,.82,.04),(-1.24,0,.04)]:
        rod('Tripod leg',(-.31,0,1.20),p,.048,'Olive_Painted_Metal')
        box('Tripod foot',p,(.24,.12,.065),'Dark_Blued_Steel',.012)
    rod('Elevation screw',(-.79,0,.90),(-.79,0,1.31),.026,'Burnished_Steel')
    torus('Elevation handwheel',(-.79,0,1.0),.11,.017,'Burnished_Steel','X',20)
    box('Ammunition box',(-.48,.75,.23),(.55,.29,.43),'Olive_Painted_Metal',.025)
    box('Ammo box lid',(-.48,.75,.46),(.60,.33,.045),'Walnut_Wood',.012)
    points=[]
    for i in range(23):
        t=i/22;y=.18+t*.61;h=z-.03-(t*t)*.98
        points.append((-.48,y,h))
        rod('Belt cartridge',(-.56,y,h),(-.29,y,h),.018,'Brass',8,r2=.009)
    tube('Canvas ammunition belt',points,.032,'Canvas_Linen')
    rod('Condenser can',(.69,-.66,.05),(.69,-.66,.48),.16,'Olive_Painted_Metal',20)
    tube('Steam return hose',[(.92,-.13,z),(.98,-.32,1.12),(.85,-.58,.65),(.69,-.66,.48)],.023,'Rubber')
    for x in [-.93,-.76,-.58,-.40]:
        for y in [-.155,.155]:ellipsoid('Receiver rivet',(x,y,z+.08),(.018,.012,.018),'Burnished_Steel',8,4)

def fieldgun():
    # British QF 18-pounder Mk I/II: single pole trail, spoked wheels,
    # narrow curved shield and recuperator above the barrel.
    for y in [-1.02,1.02]:wheel(0,y,.78,.76)
    rod('Axle',(0,-1.13,.78),(0,1.13,.78),.075,'Dark_Blued_Steel')
    box('Carriage',(0,0,.87),(.65,1.3,.32),'Olive_Painted_Metal',.035)
    # Polygonal shield with characteristic central opening around gun.
    for y in [-.60,.60]:
        box('Shield wing',(.36,y,1.46),(.065,.72,1.18),'Olive_Painted_Metal',.025)
    box('Shield upper bridge',(.36,0,2.01),(.065,.60,.16),'Olive_Painted_Metal',.02)
    box('Shield lower apron',(.36,0,.84),(.065,1.87,.30),'Olive_Painted_Metal',.02)
    for y in [-.91,.91]:rod('Shield rolled edge',(.40,y,.90),(.40,y,2.0),.016,'Burnished_Steel',6)
    box('Breech',(-.54,0,1.38),(.58,.37,.35),'Dark_Blued_Steel',.035)
    rod('Gun tube',(-.38,0,1.40),(2.12,0,1.70),.13,'Olive_Painted_Metal',28,r2=.078)
    rod('Muzzle face',(2.12,0,1.70),(2.132,0,1.702),.080,'Burnished_Steel',24)
    rod('Recessed bore',(2.134,0,1.702),(2.14,0,1.703),.051,'Rubber',20)
    rod('Recoil spring housing',(-.42,0,1.68),(1.60,0,1.92),.11,'Olive_Painted_Metal',20)
    box('Recoil cradle',(-.08,0,1.23),(1.13,.38,.15),'Burnished_Steel',.025)
    trail=box('Single pole trail',(-1.30,0,.50),(2.48,.36,.24),'Olive_Painted_Metal',.04);trail.rotation_euler.y=-.23
    box('Ground spade',(-2.52,0,.13),(.29,.89,.23),'Dark_Blued_Steel',.025)
    torus('Towing eye',(-2.65,0,.20),.11,.028,'Burnished_Steel','Y',20)
    for x in [-.3,-.8,-1.3,-1.8]:
        for y in [-.19,.19]:ellipsoid('Trail rivet',(x,y,.5+(x+1.3)*.23),(.025,.015,.025),'Burnished_Steel',8,4)
    torus('Traverse handwheel',(-.46,-.43,1.20),.18,.025,'Burnished_Steel','Y',20)
    rod('Handwheel spindle',(-.46,-.43,1.20),(-.46,0,1.20),.028,'Burnished_Steel')
    for x in [1.12,1.39,1.66]:
        rod('18-pounder shell',(x,.72,.02),(x,.72,.45),.086,'Brass',16)
        rod('Ogival projectile',(x,.72,.45),(x,.72,.64),.085,'Dark_Blued_Steel',16,r2=.018)

def airfoil(name,x,z,span,chord):
    # Closed shallow cambered sections, rounded leading edge and tapered tips.
    verts=[];N=24
    for j in range(N+1):
        y=-span/2+span*j/N;t=abs(y)/(span/2)
        c=chord*(1-.2*max(0,(t-.86)/.14))
        for dx,dz in [(0,-.018),(.18,.052),(.55,.038),(1,0),(.55,-.012),(.18,-.032)]:
            verts.append((x+c*(dx-.5),y,z+dz))
    faces=[]
    for j in range(N):
        for k in range(6):faces.append((j*6+k,j*6+(k+1)%6,(j+1)*6+(k+1)%6,(j+1)*6+k))
    faces.extend([tuple(range(5,-1,-1)),tuple(N*6+k for k in range(6))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,'Doped_Linen')
    for y in [-span/2+i*.42 for i in range(int(span/.42)+1)]:
        rod('Fabric rib seam',(x-chord*.42,y,z+.039),(x+chord*.43,y,z+.023),.006,'Canvas_Linen',5)

def biplane():
    # Sopwith Camel F.1, 1917: short rotary-engine nose, paired wings,
    # twin Vickers guns, single cockpit, fixed undercarriage and tail skid.
    # Length/display ratio ~5.49:8.53 wingspan.
    ellipsoid('Tapered rear fuselage',(-1.12,0,.10),(1.82,.30,.33),'Doped_Linen',32,12)
    ellipsoid('Forward fuselage',(.78,0,.13),(1.16,.43,.47),'Walnut_Wood',28,12)
    rod('Rotary engine cowling',(1.54,0,.13),(1.98,0,.13),.49,'Burnished_Steel',40)
    rod('Dark engine opening',(1.985,0,.13),(1.995,0,.13),.40,'Dark_Blued_Steel',32)
    for i in range(9):
        a=i*math.tau/9
        rod('Rotary engine cylinder',(2.005,math.sin(a)*.12,.13+math.cos(a)*.12),(2.005,math.sin(a)*.34,.13+math.cos(a)*.34),.062,'Burnished_Steel',10)
    ellipsoid('Cockpit dark recess',(.0,0,.50),(.38,.235,.065),'Rubber',24,8)
    torus('Leather cockpit coaming',(.0,0,.51),.255,.03,'Walnut_Wood',segments=28).scale.x=1.4
    airfoil('Upper wing',.60,1.24,8.45,1.18)
    airfoil('Lower wing',.58,-.35,7.95,1.14)
    for y in [-2.65,2.65]:
        for x in [.16,1.02]:rod('Interplane strut',(x,y,-.30),(x,y,1.24),.030,'Walnut_Wood',8)
        tube('Cross bracing',[(.16,y,-.30),(1.02,y,1.24)],.009,'Burnished_Steel')
        tube('Cross bracing',[(1.02,y,-.30),(.16,y,1.24)],.009,'Burnished_Steel')
        tube('Landing wire',[(.4,y,1.24),(.55,.39,-.32)],.009,'Burnished_Steel')
    for y in [-.33,.33]:
        for x in [.25,.95]:rod('Cabane strut',(x,y,.39),(x,y*.72,1.24),.025,'Walnut_Wood',8)
        rod('Vickers gun',(.45,y*.58,.57),(1.40,y*.58,.57),.045,'Dark_Blued_Steel',12)
    ellipsoid('Horizontal tailplane',(-2.57,0,.11),(.59,1.18,.035),'Doped_Linen')
    ellipsoid('Vertical fin',(-2.60,0,.44),(.53,.035,.57),'Doped_Linen')
    for y in [-.70,.70]:
        for x in [.15,1.15]:rod('Landing strut',(x,y*.46,-.28),(.69,y,-1.12),.035,'Walnut_Wood',8)
        torus('Undercarriage tyre',(.69,y,-1.10),.30,.065,'Rubber','Y')
        rod('Canvas wheel cover',(.69,y-.048,-1.10),(.69,y+.048,-1.10),.27,'Doped_Linen',24)
    rod('Undercarriage axle',(.69,-.81,-1.10),(.69,.81,-1.10),.035,'Burnished_Steel')
    rod('Tail skid',(-2.50,0,-.10),(-2.86,0,-.68),.035,'Walnut_Wood')
    for angle in [.12,math.pi+.12]:
        blade=ellipsoid('Laminated wooden propeller',(2.08,math.sin(angle)*.59,.13+math.cos(angle)*.59),(.05,.13,.67),'Walnut_Wood',20,8)
        blade.rotation_euler.x=-angle
    rod('Propeller boss',(2.02,0,.13),(2.16,0,.13),.13,'Brass',20)
    for y in [-2.95,2.95]:
        for r,m,z in [(.44,'Roundel_Blue',1.30),(.31,'Roundel_White',1.308),(.16,'Roundel_Red',1.316)]:
            rod('RFC roundel',(.60,y,z),(.60,y,z+.008),r,m,32)

BUILDERS={'vickers_mki_1914':vickers,'qf18_field_gun_1914':fieldgun,'sopwith_camel_1917':biplane}

def export(key):
    # Keep individual components editable in the blend; export a temporary
    # optimized scene where all geometry is baked and merged by material.
    bpy.context.scene['historical_status']='Interpretive reconstruction; not an archival scan'
    bpy.context.scene['gallery_axes']='X length, Y width, Z up; display scale, not engineering dimensions'
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(key+'.blend')),compress=True)
    meshes=[]
    for o in list(bpy.context.scene.objects):
        if o.type not in {'MESH','CURVE'}:continue
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.convert(target='MESH')
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        meshes.append(o)
    groups={mat:[] for mat in M.values()}
    for o in meshes:
        if o.data.materials:groups[o.data.materials[0]].append(o)
    batches=[]
    for mat,objects in groups.items():
        if not objects:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        o=bpy.context.object;o.name=mat.name;batches.append(o)
    bpy.ops.object.select_all(action='SELECT')
    path=OUT/(key+'_web.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=False,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_animations=False)
    triangles=sum(len(p.vertices)-2 for o in batches for p in o.data.polygons)
    print('EXHIBIT',json.dumps({'id':key,'batches':len(batches),'triangles':triangles,'bytes':path.stat().st_size}),flush=True)

if __name__=='__main__':
    keys=[a for a in sys.argv[1:] if a in BUILDERS] or list(BUILDERS)
    for key in keys:reset();BUILDERS[key]();export(key)
