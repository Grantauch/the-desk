"""Three editable WWI trench props. Run with Blender Python 5.2.

Interpretive, texture-free reconstructions; see README for museum references.
Helmet dimensions are approximately life size. The periscope is enlarged to
the existing scene prop's display height; it is not a measured No.9 replica.
"""
from build_exhibits import *


def shell(name, profile, mat, oval=1.0, segments=40):
    # Continuous outer crown, brim, rolled edge and inner crown; no solid cap
    # across the opening. Profiles run from top outside to top inside.
    verts=[]
    for radius,z in profile:
        for i in range(segments):
            a=i*math.tau/segments
            verts.append((radius*math.cos(a),radius*math.sin(a)*oval,z))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.append(tuple(range(segments-1,-1,-1)))
    faces.append(tuple((len(profile)-1)*segments+i for i in range(segments)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    finish(o,name,mat)
    # Recalculate outward normals, including the open shell interior.
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    o.select_set(False)
    for p in mesh.polygons:p.use_smooth=True
    return o


def chinstrap(width, length):
    # Loose leather strap visible under the bowl. Flat strip, rather than a rope.
    points=[(-width,0,.018),(-width*.85,0,-.05),(-width*.5,0,-.09),
            (0,0,-.105),(width*.5,0,-.09),(width*.85,0,-.05),(width,0,.018)]
    verts=[]
    for x,y,z in points:verts.extend([(x,y-.008,z),(x,y+.008,z)])
    faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)]
    mesh=bpy.data.meshes.new('Leather strap');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Leather chinstrap',mesh);bpy.context.collection.objects.link(o)
    finish(o,'Leather chinstrap','Walnut_Wood')
    mod=o.modifiers.new('Leather thickness','SOLIDIFY');mod.thickness=.002
    box('Chinstrap buckle',(.06,-.002,-.095),(.021,.023,.008),'Burnished_Steel',.001)
    for x in [-width,width]:
        rod('Chinstrap attachment',(x,-.009,.025),(x,.009,.025),.006,'Burnished_Steel',10)


def m1917():
    profile=[(.004,.115),(.043,.111),(.078,.096),(.101,.071),(.112,.042),
             (.119,.020),(.145,.007),(.166,0),(.169,-.003),(.168,-.006),
             (.145,.001),(.118,.014),(.107,.038),(.096,.066),(.073,.091),
             (.04,.106),(.004,.109)]
    shell('M1917 shallow steel crown and broad brim',profile,'Olive_Painted_Metal',.94)
    rod('Crown fixing rivet',(0,0,.115),(0,0,.119),.006,'Burnished_Steel',12)
    chinstrap(.108,.2)
    # Six simple leather liner pads remain editable inside the open shell.
    for i in range(6):
        a=i*math.tau/6
        o=box('Leather liner pad',(.081*math.cos(a),.078*math.sin(a),.042),(.037,.009,.04),'Walnut_Wood',.002)
        o.rotation_euler.z=a+math.pi/2


def adrian():
    material('Horizon_Blue_Steel',(.20,.27,.29),.35,.66)
    profile=[(.004,.14),(.045,.133),(.08,.112),(.103,.08),(.114,.041),
             (.119,.018),(.139,.011),(.149,.002),(.15,-.002),
             (.145,-.005),(.136,.006),(.115,.012),(.108,.038),
             (.097,.075),(.074,.107),(.04,.128),(.004,.134)]
    shell('Adrian crown visor and neck guard',profile,'Horizon_Blue_Steel',1.15)
    # Raised longitudinal ventilator comb, tapering into the crown.
    verts=[(-.012,-.123,.054),(.012,-.123,.054),(-.009,-.08,.15),(.009,-.08,.15),
           (-.009,.035,.174),(.009,.035,.174),(-.007,.117,.068),(.007,.117,.068)]
    faces=[(0,1,3,2),(2,3,5,4),(4,5,7,6),(0,2,4,6),(1,7,5,3),(0,6,7,1)]
    mesh=bpy.data.meshes.new('Ventilator crest');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Adrian raised ventilator crest',mesh);bpy.context.collection.objects.link(o)
    finish(o,o.name,'Horizon_Blue_Steel')
    # Simplified raised infantry flaming grenade, no invented unit insignia.
    ellipsoid('Infantry grenade badge',(0,-.123,.065),(.018,.003,.019),'Horizon_Blue_Steel',16,8)
    for dx in [-.009,0,.009]:
        rod('Badge flame',(dx,-.121,.079),(dx*.6,-.117,.10+(.006 if dx==0 else 0)),.003,'Horizon_Blue_Steel',6,r2=.0005)
    for y in [-.085,.06]:
        for x in [-.012,.012]:ellipsoid('Crest rivet',(x,y,.137),(.003,.003,.002),'Burnished_Steel',8,4)
    chinstrap(.106,.2)


def periscope():
    material('Olive_Wood',(.24,.26,.16),0,.87)
    material('Mirror_Glass',(.42,.53,.52),.80,.16)
    # Timber box with opposed viewing apertures, hinged access panels,
    # brass fittings and a sliding shutter, following surviving WWI examples.
    box('Left timber side',(-.064,0,.82),(.018,.12,1.50),'Olive_Wood',.003)
    box('Right timber side',(.064,0,.82),(.018,.12,1.50),'Olive_Wood',.003)
    box('Lower closed face',(0,.056,.70),(.12,.012,1.25),'Olive_Wood',.002)
    box('Upper closed face',(0,-.056,.96),(.12,.012,1.23),'Olive_Wood',.002)
    for z in [.074,1.566]:box('End cap',(0,0,z),(.147,.134,.016),'Walnut_Wood',.003)
    for z,y in [(.30,-.063),(1.43,.063)]:
        box('Deep black viewing aperture',(0,y,z),(.107,.007,.117),'Rubber')
        mirror=box('Angled internal mirror',(0,y*.42,z),(.098,.003,.10),'Mirror_Glass')
        mirror.rotation_euler.x=math.pi/4
        for x in [-.058,.058]:box('Viewing frame',(x,y,z),(.009,.016,.132),'Burnished_Steel')
        for dz in [-.064,.064]:box('Viewing frame',(0,y,z+dz),(.125,.016,.009),'Burnished_Steel')
    box('Sliding lower shutter',(0,-.072,.205),(.114,.014,.065),'Olive_Wood',.003)
    rod('Shutter grip',(-.03,-.083,.22),(.03,-.083,.22),.006,'Brass',8)
    for z in [.16,.81,1.51]:
        for x in [-.075,.075]:
            box('Panel hinge',(x,0,z),(.012,.04,.025),'Brass',.002)
    rod('Wooden handgrip',(0,0,-.10),(0,0,.07),.029,'Walnut_Wood',12)
    for z in [.52,1.08]:box('Box joining band',(0,0,z),(.152,.14,.021),'Dark_Blued_Steel',.002)


if __name__=='__main__':
    for key,builder in [('m1917_helmet_1917',m1917),('adrian_helmet_1915',adrian),('wooden_trench_periscope_1917',periscope)]:
        reset();builder();export(key)
