"""Editable M1903 rifle/bayonet and generic WWI timber supply case.

Blender 5.2, approximate life-size display props, not engineering replicas.
"""
from build_exhibits import *


def stock_mesh():
    outline=[(-.065,0),(.030,0),(.040,.27),(.018,.37),(.020,.84),
             (-.012,.84),(-.020,.40),(-.035,.33),(-.067,.28)]
    verts=[(x,y,z) for y in [-.021,.021] for x,z in outline]
    n=len(outline);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    for i in range(n):j=(i+1)%n;faces.append((i,j,j+n,i+n))
    mesh=bpy.data.meshes.new('Straight grip stock');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('M1903 straight walnut stock',mesh);bpy.context.collection.objects.link(o)
    finish(o,o.name,'Walnut_Wood')
    bevel=o.modifiers.new('Worn stock edges','BEVEL');bevel.width=.006;bevel.segments=2
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')


def springfield():
    stock_mesh()
    rod('M1903 barrel',(.023,0,.56),(.023,0,1.10),.009,'Dark_Blued_Steel',16,r2=.007)
    rod('Receiver',(.023,0,.43),(.023,0,.60),.015,'Dark_Blued_Steel',16)
    box('Upper wood handguard',(.033,0,.73),(.018,.038,.25),'Walnut_Wood',.004)
    box('Internal magazine floorplate',(-.015,0,.46),(.014,.039,.11),'Dark_Blued_Steel',.003)
    rod('Bolt body',(.025,0,.47),(.025,0,.56),.012,'Burnished_Steel',12)
    rod('Bolt handle',(.025,.008,.49),(.019,.060,.48),.005,'Burnished_Steel',10)
    ellipsoid('Bolt knob',(.019,.064,.48),(.010,.010,.010),'Burnished_Steel',12,6)
    guard=torus('Trigger guard',(-.034,0,.415),.035,.004,'Dark_Blued_Steel','Y',20)
    guard.scale.x=.63
    rod('Curved trigger',(-.020,0,.44),(-.030,0,.424),.003,'Burnished_Steel',8)
    box('Butt plate',(-.017,0,-.003),(.102,.046,.009),'Burnished_Steel',.004)
    for z in [.78,.91]:
        box('Steel barrel band',(.020,0,z),(.052,.049,.014),'Dark_Blued_Steel',.004)
    box('Rear leaf sight base',(.046,0,.622),(.015,.035,.053),'Dark_Blued_Steel',.002)
    box('Folded ladder rear sight',(.056,0,.632),(.006,.025,.048),'Burnished_Steel',.001)
    box('Front sight base',(.030,0,1.071),(.018,.017,.026),'Dark_Blued_Steel',.002)
    box('Front sight blade',(.043,0,1.077),(.018,.004,.013),'Dark_Blued_Steel')
    rod('Dark muzzle bore',(.023,0,1.100),(.023,0,1.102),.004,'Rubber',12)
    # M1905 bayonet: long straight blade with walnut grip under the muzzle.
    box('M1905 bayonet wooden grip',(-.026,0,1.045),(.020,.025,.105),'Walnut_Wood',.004)
    box('Bayonet pommel',(-.026,0,.987),(.022,.029,.015),'Burnished_Steel',.002)
    box('Bayonet crossguard',(-.005,0,1.102),(.075,.032,.009),'Dark_Blued_Steel',.002)
    torus('Bayonet muzzle ring',(.023,0,1.103),.010,.003,'Dark_Blued_Steel','Z',16)
    verts=[(-.038,-.002,1.109),(-.014,-.002,1.109),(-.014,.002,1.109),(-.038,.002,1.109),
           (-.035,-.002,1.442),(-.017,-.002,1.442),(-.017,.002,1.442),(-.035,.002,1.442),(-.026,0,1.508)]
    faces=[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,8),(5,6,8),(6,7,8),(7,4,8)]
    mesh=bpy.data.meshes.new('Bayonet blade');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('M1905 straight bayonet blade',mesh);bpy.context.collection.objects.link(o);finish(o,o.name,'Burnished_Steel')
    for z in [.10,.77]:torus('Sling swivel',(-.055,0,z),.014,.0025,'Dark_Blued_Steel','X',12)
    # Loose leather sling follows the stock rather than creating new collision.
    tube('Leather sling',[(-.055,0,.10),(-.094,0,.24),(-.106,0,.48),(-.085,0,.66),(-.055,0,.77)],.006,'Canvas_Linen')
    for z in [1.015,1.073]:rod('Bayonet grip rivet',(-.026,-.014,z),(-.026,.014,z),.003,'Burnished_Steel',8)


def supply_case():
    material('Aged_Timber',(.33,.24,.13),0,.92)
    material('Pale_Timber',(.43,.32,.18),0,.93)
    # Separate planks, battens, recessed seams and nail heads. Generic case,
    # intentionally no invented cartridge type, factory or quantity stencil.
    for side in [-1,1]:
        for row in range(3):
            box('Side plank',(0,side*.187,-.13+row*.129),(.60,.026,.123),'Aged_Timber' if row%2 else 'Pale_Timber',.003)
    for end in [-1,1]:
        for row in range(3):box('End plank',(end*.287,0,-.13+row*.129),(.026,.36,.123),'Aged_Timber',.003)
    for x in [-.20,.20]:
        for y in [-.204,.204]:
            box('Reinforcing batten',(x,y,0),(.052,.019,.39),'Walnut_Wood',.003)
            for z in [-.15,.15]:rod('Square case nail',(x,y,z),(x,y+(.003 if y>0 else -.003),z),.004,'Dark_Blued_Steel',6)
    for x in [-.2,0,.2]:box('Removable lid plank',(x,0,.204),(.194,.40,.024),'Pale_Timber',.003)
    for x in [-.21,.21]:box('Lid cross batten',(x,0,.224),(.046,.39,.018),'Walnut_Wood',.002)
    box('Case floor',(0,0,-.202),(.57,.36,.022),'Aged_Timber')
    for x in [-.302,.302]:
        tube('Rope carrying handle',[(x,-.065,.09),(x*1.13,-.04,.015),(x*1.13,.04,.015),(x,.065,.09)],.010,'Canvas_Linen')


if __name__=='__main__':
    for key,builder in [('springfield_m1903_1918',springfield),('timber_supply_case_1916',supply_case)]:
        reset();builder();export(key)
