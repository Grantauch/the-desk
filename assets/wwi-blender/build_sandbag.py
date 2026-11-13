"""Low-poly pillow sandbag for instanced trench defenses."""
from build_exhibits import *

def sandbag():
    # Baked rounded corners, a slightly sagging top and a tied seam. 128 tris
    # before the small perimeter seam; repeated by the existing InstancedMeshes.
    o=box('Filled hessian sandbag',(0,0,0),(.62,.34,.20),'Canvas_Linen')
    mod=o.modifiers.new('Low-poly soft corners','BEVEL');mod.width=.065;mod.segments=1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in o.data.polygons:poly.use_smooth=True
    for v in o.data.vertices:
        x,y,z=v.co
        # Uneven compacted fill, without random export-to-export changes.
        v.co.z += .010*math.sin(x*15)*math.cos(y*15)*(1-abs(x)/.32)
        v.co.y *= 1-.08*abs(x)/.32
    # Pinched end conveys the tied fabric mouth without extra per-instance meshes.
    for v in o.data.vertices:
        if v.co.x>.24:v.co.y*=.82;v.co.z*=.88

if __name__=='__main__':
    reset();sandbag();export('trench_sandbag_1916')
