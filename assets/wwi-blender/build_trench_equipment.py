"""Second museum batch. Interpretive WWI equipment, not engineering replicas."""
from build_exhibits import *

def respirator():
    # SBR mask displayed on a neutral museum bust beside 1915 gas cylinders.
    # The 1916 respirator is intentionally identified separately from the gas date.
    material('Neutral_Display_Bust',(.27,.25,.21),0,.95)
    material('Eyepiece_Glass',(.12,.17,.15),.1,.2)
    for x,y in [(-1.9,0),(-1.35,0),(-.8,0),(-1.65,-.55),(-1.08,-.55)]:
        rod('Gas cylinder body',(x,y,.13),(x,y,1.52),.195,'Olive_Painted_Metal',24)
        ellipsoid('Rounded cylinder shoulder',(x,y,1.51),(.195,.195,.18),'Olive_Painted_Metal')
        rod('Cylinder valve',(x,y,1.65),(x,y,1.79),.043,'Brass',12)
        torus('Valve handwheel',(x,y,1.80),.075,.018,'Dark_Blued_Steel',segments=16)
        rod('Cylinder foot rim',(x,y,.08),(x,y,.16),.21,'Dark_Blued_Steel',24)
    # Face points toward +X, making the two circular lenses visible at gallery angle.
    x=.90
    box('Display bust base',(x,0,.12),(1.03,.82,.22),'Neutral_Display_Bust',.05)
    ellipsoid('Shoulders',(x,0,.57),(.36,.55,.33),'Neutral_Display_Bust')
    rod('Neck',(x,0,.65),(x,0,1.13),.18,'Neutral_Display_Bust',24)
    ellipsoid('Mannequin head',(x,0,1.55),(.32,.30,.44),'Neutral_Display_Bust')
    ellipsoid('Rubberised fabric facepiece',(x+.22,0,1.56),(.23,.34,.36),'Canvas_Linen',32,16)
    ellipsoid('Mouthpiece',(x+.39,0,1.36),(.14,.18,.13),'Rubber')
    for y in [-.175,.175]:
        # Round glass eyepieces, small metal retaining rims.
        rod('Circular eyepiece',(x+.411,y,1.67),(x+.438,y,1.67),.105,'Eyepiece_Glass',32)
        torus('Eyepiece retaining ring',(x+.435,y,1.67),.112,.016,'Brass','X',28)
        tube('Fabric mask seam',[(x+.32,y*1.6,1.86),(x+.38,y*1.75,1.65),(x+.34,y*1.6,1.39)],.008,'Walnut_Wood')
        tube('Head strap',[(x+.15,y*1.8,1.80),(x-.24,y*1.5,1.79),(x-.32,0,1.80)],.025,'Rubber')
    box('Canvas respirator haversack',(1.40,.62,.40),(.62,.30,.67),'Canvas_Linen',.06)
    box('Haversack flap',(1.42,.62,.77),(.67,.34,.15),'Canvas_Linen',.025)
    box('Filter canister',(1.47,.62,.51),(.43,.23,.42),'Olive_Painted_Metal',.035)
    points=[(x+.45,0,1.31),(x+.66,0,1.14),(x+.67,.13,.91),(1.60,.42,.84),(1.47,.62,.74)]
    tube('Breathing hose',points,.064,'Rubber')
    # Corrugated hose collars convey the fabric-covered rubber tube without textures.
    for i in range(15):
        t=i/14
        a=Vector(points[0]).lerp(Vector(points[1]),t)
        torus('Hose corrugation',a,.068,.009,'Canvas_Linen','X',12)
    tube('Haversack shoulder strap',[(.60,-.35,.65),(.70,-.38,1.02),(1.10,.33,1.0),(1.40,.62,.74)],.022,'Canvas_Linen')

def wire():
    material('Oxidised_Iron',(.22,.13,.07),.45,.8)
    material('Worn_Wire',(.34,.29,.22),.6,.6)
    # Two lines of screw pickets with looped eyes, plus a barbed loose coil.
    for y in [-.72,.72]:
        for j in range(6):
            x=-3.35+j*1.30
            rod('Screw picket',(x,y,.03),(x,y,1.45),.023,'Oxidised_Iron',8)
            tube('Corkscrew ground section',[(x+.08*math.cos(t*.3),y+.08*math.sin(t*.3),.03+t*.006) for t in range(44)],.018,'Oxidised_Iron')
            for z in [.45,.88,1.38]:torus('Picket eye',(x,y,z),.057,.015,'Oxidised_Iron','Y',12)
        for row,z in enumerate([.45,.88,1.38]):
            for strand in [-1,1]:
                points=[]
                for k in range(81):
                    x=-3.35+6.5*k/80
                    points.append((x,y+strand*.011*math.cos(k*.8),z-.08*abs(math.sin((x+3.35)*math.pi/1.30))+strand*.011*math.sin(k*.8)))
                tube('Twisted wire strand',points,.007,'Worn_Wire')
            for k in range(25):
                x=-3.28+k*.26;h=z-.08*abs(math.sin((x+3.35)*math.pi/1.30))
                rod('Barb',(x-.043,y-.026,h-.04),(x+.043,y+.026,h+.04),.006,'Oxidised_Iron',4)
                rod('Barb',(x-.032,y+.035,h+.04),(x+.032,y-.035,h-.04),.006,'Oxidised_Iron',4)
    points=[]
    for k in range(241):
        a=k*math.tau*12/240
        points.append((-3.3+k*6.6/240,1.55+.42*math.sin(a),.48+.42*math.cos(a)))
    tube('Coiled barbed wire',points,.010,'Worn_Wire')
    for k in range(0,len(points),4):
        p=Vector(points[k]);d=Vector((.035,.04,.05))
        rod('Coil barb',p-d,p+d,.006,'Oxidised_Iron',4)
    for j in range(5):
        x=-3.35+j*1.30
        tube('Diagonal entanglement',[(x,-.72,1.38),(x+.65,0,.65),(x+1.3,.72,.45)],.009,'Worn_Wire')

def wex():
    # Wex M1917's characteristic annular fuel tank and central pressure vessel.
    box('Display base',(0,0,.07),(1.6,1.1,.14),'Dark_Blued_Steel',.03)
    rod('Display support',(0,-.18,.08),(0,-.18,1.90),.033,'Dark_Blued_Steel')
    torus('Annular fuel tank',(0,0,1.25),.48,.205,'Olive_Painted_Metal','Y',48)
    torus('Tank raised seam',(0,.201,1.25),.48,.016,'Burnished_Steel','Y',48)
    ellipsoid('Central pressure vessel',(0,0,1.25),(.235,.20,.235),'Burnished_Steel',28,14)
    box('Backplate',(0,-.22,1.25),(.69,.06,1.10),'Dark_Blued_Steel',.03)
    for x in [-.29,.29]:
        tube('Canvas shoulder strap',[(x,-.26,.77),(x,-.40,1.15),(x,-.40,1.70),(x,-.20,1.80)],.037,'Canvas_Linen')
        box('Strap buckle',(x,-.42,1.03),(.11,.035,.14),'Brass',.01)
    rod('Filler neck',(-.15,0,1.87),(-.15,0,2.01),.065,'Brass',16)
    rod('Filler cap',(-.15,0,2.01),(-.15,0,2.06),.089,'Dark_Blued_Steel',16)
    rod('Valve spindle',(.22,0,1.73),(.32,0,1.90),.033,'Brass')
    torus('Valve handwheel',(.32,0,1.90),.10,.018,'Dark_Blued_Steel','Y',20)
    tube('Fuel hose',[(.45,.08,.97),(.70,.28,.55),(1.15,.48,.42),(1.32,.63,.71),(1.14,.69,1.04)],.052,'Rubber')
    rod('Lance',(1.02,.69,1.06),(2.04,.69,1.06),.039,'Burnished_Steel',16)
    rod('Nozzle',(2.04,.69,1.06),(2.23,.69,1.06),.053,'Brass',16,r2=.032)
    rod('Nozzle bore',(2.235,.69,1.06),(2.24,.69,1.06),.022,'Rubber',12)
    box('Lance handgrip',(1.29,.69,.94),(.17,.09,.22),'Walnut_Wood',.025)
    rod('Trigger guard',(1.45,.69,.88),(1.55,.69,1.04),.013,'Dark_Blued_Steel',8)
    rod('Igniter tube',(1.97,.69,1.13),(2.22,.69,1.13),.017,'Dark_Blued_Steel')

if __name__=='__main__':
    builders={'small_box_respirator_1916':respirator,'screw_picket_wire_1916':wire,'wex_flamethrower_1917':wex}
    keys=[a for a in sys.argv[1:] if a in builders] or list(builders)
    for key in keys:reset();builders[key]();export(key)
