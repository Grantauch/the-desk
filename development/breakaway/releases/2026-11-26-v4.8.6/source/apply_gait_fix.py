#!/usr/bin/env python3
"""V4.8.6: distance-anchored non-flickering athlete gait. Rendering only."""
from pathlib import Path
import sys

root=Path(__file__).resolve().parent
source=Path(sys.argv[1]) if len(sys.argv)>1 else root/'baseline-v4.8.5.html'
out=root/'BREAKAWAY_FOOTBALL_V4_8_6_WEIGHTED_FOOTFALLS_PLAYABLE.html'
s=source.read_text()
needle="this.frame=0;this.motionClock=0;this.lastPossession=-1;"
assert s.count(needle)==1
s=s.replace(needle,"this.frame=0;this.motionClock=0;this.gaitTracks=new Map();this.lastPossession=-1;")
needle="if(this.lastPossession!==game.possession){this.lastPossession=game.possession;this.camX="
assert s.count(needle)==1
s=s.replace(needle,"if(this.lastPossession!==game.possession){this.gaitTracks.clear();this.lastPossession=game.possession;this.camX=")
needle=""" // Render-only joint pose; tied to real actor velocity, never modifies actor state.
 // A zero-speed athlete stays still, and Reduced Effects tones down bounce and sway.
 motionPose(kind,o,game){"""
replacement=""" // Footfall phase is integrated from how far an athlete actually travels.
 // The old (elapsedTime * currentSpeed) expression jumped phase every time
 // speed changed, causing the visible feet to flicker at high frame rates.
 // A per-renderer track makes a planted cleat retain its phase through stops,
 // pauses, replays and short tackle struggles. Never mutate game actors.
 footfallPhase(kind,o,speed,offset){
  if(!Number.isFinite(o.x)||!Number.isFinite(o.y)){
   // Test-only synthetic actors without world position retain a slow, smooth
   // illustrative gait, not the speed-multiplication discontinuity.
   return this.motionClock*4.15+offset;
  }
  const key=kind==='runner'?'runner':kind+':'+(o.id??o.home??'preview');
  let track=this.gaitTracks.get(key);
  if(!track){
   track={x:o.x,y:o.y,phase:offset,time:this.motionClock,frame:this.frame};
   this.gaitTracks.set(key,track);
   return track.phase;
  }
  // motionPose may be queried twice in the same frame by diagnostics;
  // neither a test read nor a replay redraw should count as another step.
  if(track.frame!==this.frame){
   const elapsed=Math.max(0,this.motionClock-track.time);
   const distance=Math.hypot(o.x-track.x,o.y-track.y);
   // Reset or teleport across drives/recorded samples: keep foot phase, do
   // not animate dozens of steps from one discontinuous world displacement.
   const maxTravel=(speed+5)*Math.min(elapsed,.09)*1.65+.12;
   if(elapsed>0 && distance<3.4 && distance<=maxTravel){
    // ~10.8 yards per complete leg cycle (two ground contacts): slower and
    // tied to actual progress, without speed-dependent phase snapping.
    track.phase+=distance*(Math.PI*2/10.8);
   }
   track.x=o.x;track.y=o.y;track.time=this.motionClock;track.frame=this.frame;
  }
  return track.phase;
 }
 // Render-only joint pose; tied to real actor velocity, never modifies actor state.
 // A zero-speed athlete stays still, and Reduced Effects tones down bounce and sway.
 motionPose(kind,o,game){"""
assert s.count(needle)==1
s=s.replace(needle,replacement)
needle="const cycle=this.motionClock*(6.3+Math.min(speed,19)*.78)+offset;"
assert s.count(needle)==1
s=s.replace(needle,"const cycle=this.footfallPhase(kind,o,speed,offset);")
needle="const stride=Math.sin(cycle)*moving;"
assert s.count(needle)==1
s=s.replace(needle,"const stride=Math.sin(cycle)*moving;")
needle="""   liftL:Math.max(0,-Math.sin(cycle))*moving*(1-plant*.8)*restrained,
   liftR:Math.max(0,Math.sin(cycle))*moving*(1-plant*.8)*restrained};"""
replacement="""   // A grounded shoe stays planted briefly before lifting into the swing.
   liftL:clamp((-Math.sin(cycle)-.24)/.76,0,1)*moving*(1-plant*.8)*restrained,
   liftR:clamp((Math.sin(cycle)-.24)/.76,0,1)*moving*(1-plant*.8)*restrained};"""
assert s.count(needle)==1
s=s.replace(needle,replacement)
needle="""  const grounded=plantFoot===side;
  const swing=footShift*side;
  const lift=(side<0?pose.liftL:pose.liftR);"""
replacement="""  const grounded=plantFoot===side;
  const lift=(side<0?pose.liftL:pose.liftR);
  // While the shoe is grounded its screen-space travel is damped: avoid the
  // pinwheel/flicker effect where both feet slide through their contact.
  const swing=footShift*side*(lift<.05?.42:1);"""
assert s.count(needle)==1
s=s.replace(needle,replacement)
needle='torsoTwist=(Math.cos(cycle)*moving*.12+juke*.22*cutSide'
assert s.count(needle)==1
s=s.replace(needle,'torsoTwist=(Math.cos(cycle)*moving*.12+juke*.34*cutSide')
needle='<title>BREAKAWAY V4.8.5 — Contact Motion</title>'
assert s.count(needle)==1
s=s.replace(needle,'<title>BREAKAWAY V4.8.6 — Weighted Footfalls</title>')
out.write_text(s)
print(out, len(s))
