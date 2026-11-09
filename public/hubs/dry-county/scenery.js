/* Spatial guide authored from Grant's eight October 20 aerial references.
   Coordinates share world.js's original trace frame; P applies the west margin.
   Modern land-use shapes guide the geography. Architecture and names are fictional
   1926 adaptations. No reference pixels or modern imagery ship with the game. */
'use strict';
window.DryScenery=(()=>{
 const land=[
  {id:'west-crops',kind:'field',color:'#77734b',points:[[-195,-20],[-46,-20],[-44,339],[-192,345]]},
  {id:'west-pasture',kind:'meadow',color:'#65714b',points:[[-38,-20],[12,-20],[12,338],[-35,338]]},
  {id:'south-crops',kind:'field',color:'#86734c',points:[[-194,385],[-65,385],[-66,573],[-125,601],[-194,610]]},
  {id:'south-pasture',kind:'meadow',color:'#6e7950',points:[[-56,385],[8,385],[8,549],[-55,549]]},
  {id:'west-woods',kind:'wood',color:'#354b38',points:[[43,131],[250,131],[250,341],[43,341]]},
  {id:'south-woods',kind:'wood',color:'#344b39',points:[[43,390],[128,390],[194,412],[174,447],[109,488],[75,537],[43,527]]},
  {id:'southwest-woods',kind:'wood',color:'#344b39',points:[[38,570],[243,570],[243,755],[38,755]]},
  {id:'north-park',kind:'park',label:'TOWN COMMON',color:'#6b7950',points:[[377,125],[507,125],[507,168],[383,168]]},
  {id:'north-school-green',kind:'meadow',color:'#6b7851',points:[[660,124],[700,124],[700,274],[661,270]]},
  {id:'east-woods',kind:'wood',color:'#344c3b',points:[[722,24],[849,24],[916,230],[918,313],[820,315],[820,180],[722,180]]},
  {id:'dort-meadow',kind:'meadow',color:'#677650',points:[[790,376],[934,371],[934,721],[727,721],[706,615],[761,564]]},
  {id:'east-farm',kind:'field',color:'#8a7951',points:[[1298,25],[1407,25],[1407,287],[1298,287]]},
  {id:'southeast-woods',kind:'wood',color:'#354e3b',points:[[1011,569],[1403,569],[1403,755],[1011,755]]}
 ];
 // Measured massing around the junction, plus period replacements for the
 // larger civic/campus lots. Each business has one stable footprint and entrance.
 const lots=[
  {id:'garage',x:492,y:324,w:56,h:76,z:36,style:'workshop',sign:'BELL & SONS',wall:'#92694c',roof:'#5d655b'},
  {id:'grocer',x:538,y:375,w:64,h:42,z:42,style:'store',sign:"FINCH'S GROCERY",wall:'#9c6850',roof:'#67706a'},
  {id:'diner',x:574,y:375,w:56,h:42,z:30,style:'store',sign:"ROSE'S DINER",wall:'#b18b68',roof:'#6b746a'},
  {id:'pharmacy',x:543,y:339,w:58,h:54,z:48,style:'store',sign:"WARD'S PHARMACY",wall:'#9b7656',roof:'#65706b'},
  {id:'tailor',x:382,y:130,w:56,h:44,z:36,style:'store',sign:'BROOKS TAILORING',wall:'#827563',roof:'#665f50'},
  {id:'pawn',x:505,y:571,w:40,h:40,z:33,style:'store',sign:"PRICE'S SECONDHAND",wall:'#8d6f52',roof:'#666a60'},
  {id:'dealer',x:682,y:328,w:128,h:72,z:38,style:'workshop',sign:'COLE MOTOR CO.',wall:'#a1815d',roof:'#6b756a'},
  {id:'hardware',x:449,y:550,w:48,h:44,z:35,style:'workshop',sign:"BELL'S HARDWARE",wall:'#8f684b',roof:'#6d715d'},
  {id:'furniture',x:412,y:223,w:48,h:36,z:40,style:'store',sign:'ABBOTT FURNISHINGS',wall:'#927961',roof:'#71695b'},
  {id:'home',x:340,y:604,w:64,h:44,z:25,style:'house',sign:'YOUR HOME',wall:'#b2a382',roof:'#6f6454'},
  {id:'barber',x:562,y:535,w:30,h:38,z:30,style:'store',sign:"LEO'S BARBERSHOP",wall:'#ae9373',roof:'#74665a'},
  {id:'still',x:5,y:555,w:60,h:50,z:26,style:'barn',sign:'WOODLAND STILL',wall:'#785c42',roof:'#625f4d'},
  {id:'safe',x:311,y:498,w:32,h:32,z:30,style:'house',sign:'BOARDING HOUSE',wall:'#9b9478',roof:'#695d50'},
  {id:'docks',x:580,y:584,w:104,h:80,z:42,style:'warehouse',sign:'MT. MORRIS FREIGHT',wall:'#8b694b',roof:'#687063'},
  {id:'library',x:495,y:198,w:56,h:40,z:42,style:'civic',sign:'READING ROOM',wall:'#a28360',roof:'#777463'},
  {id:'common-bandstand',x:466,y:146,w:26,h:26,z:23,style:'house',sign:'BANDSTAND',wall:'#b8a584',roof:'#657363'},
  {id:'west-schoolhouse',x:-14,y:285,w:100,h:80,z:38,style:'civic',sign:'COUNTY SCHOOL',wall:'#a5815d',roof:'#726752'},
  {id:'north-chapel',x:500,y:99,w:40,h:36,z:46,style:'chapel',sign:'CHAPEL',wall:'#a99574',roof:'#756853'},
  {id:'rail-warehouse',x:414,y:338,w:52,h:72,z:34,style:'warehouse',wall:'#94704e',roof:'#737965'},
  {id:'junction-store',x:538,y:307,w:40,h:48,z:40,style:'store',sign:'DRY GOODS',wall:'#956b50',roof:'#727364'},
  {id:'south-corner-store',x:543,y:390,w:36,h:36,z:34,style:'store',wall:'#a98460',roof:'#6d7164'},
  {id:'depot-office',x:481,y:424,w:34,h:42,z:31,style:'workshop',wall:'#a18d68',roof:'#6c705f'},
  {id:'east-meeting-house',x:718,y:420,w:72,h:96,z:40,style:'chapel',sign:'MEETING HOUSE',wall:'#a08a67',roof:'#756f59'},
  {id:'west-farmhouse',x:-91,y:311,w:52,h:40,z:26,style:'house',wall:'#b4a785',roof:'#716451'},
  {id:'west-barn',x:-107,y:279,w:72,h:52,z:30,style:'barn',wall:'#946747',roof:'#766e55'},
  {id:'south-farmhouse',x:-36,y:487,w:48,h:36,z:24,style:'house',wall:'#a79d7f',roof:'#726754'},
  {id:'south-barn',x:-35,y:464,w:68,h:52,z:32,style:'barn',wall:'#8e6247',roof:'#71684e'}
 ];
 const details=[
  {kind:'path',width:9,points:[[384,147],[420,147],[466,146],[504,146]]},
  {kind:'path',width:7,points:[[466,126],[466,166]]},
  {kind:'orchard',bounds:[63,286,115,45]},
  {kind:'green',bounds:[-26,140,30,106]},
  {kind:'yard',bounds:[562,567,54,36]},
  {kind:'yard',bounds:[668,309,30,39]}
 ];
 return{land,lots,details};
})();
