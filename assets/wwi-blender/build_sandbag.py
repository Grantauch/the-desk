"""Low-poly pillow sandbag for instanced trench defenses."""
from build_exhibits import *

def sandbag():
    # Baked rounded corners, a slightly sagging top and a tied seam. 128 tris
    # before the small perimeter seam; repeated by the existing InstancedMeshes.
    o=box('Filled hessian sandbag',(0,0,0),(.62,.34,.20),'Canvas_Linen',.065)
    for v in o.data.vertices:
        x,y,z=v.co
        # Uneven compacted fill, without random export-to-export changes.
        v.co.z += .010*math.sin(x*15)*math.cos(y*15)*(1-abs(x)/.32)
        v.co.y *= 1-.08*abs(x)/.32
    points=[]
    for i in range(17):
        a=i*math.tau/16
        # Superellipse perimeter on the equator of the pillow.
        points.append((.304*math.copysign(abs(math.cos(a))**.5,math.cos(a)),.162*math.copysign(abs(math.sin(a))**.5,math.sin(a)),0))
    tube('Stitched perimeter seam',points,.004,'Canvas_Linen')
    tube('Tied mouth',[(.26,-.04,.015),(.32,0,.015),(.26,.04,.015)],.006,'Canvas_Linen')

if __name__=='__main__':
    reset();sandbag();export('trench_sandbag_1916')
