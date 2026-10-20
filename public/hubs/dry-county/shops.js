/* Fictional 1926 businesses. Prices are period-inspired game values; see docs. */
'use strict';
window.DryShops=(()=>{
const items={
 timber:{name:'Lumber bundle',price:2,stock:12,description:'Sawn boards for your house frame and floor.'},
 nails:{name:'Nail box',price:.30,stock:12,description:'Hardware for construction and furniture.'},
 brick:{name:'Brick bundle',price:1.50,stock:8,description:'Materials for the foundation and chimney.'},
 paint:{name:'Paint tin',price:1,stock:8,description:'Finish the walls and weatherproof your home.'},
 bed:{name:'Iron bed frame',price:8,stock:3,description:'Furnish your finished home for a good night\'s sleep.'},
 table:{name:'Kitchen table',price:3.50,stock:4,description:'A solid table for your own kitchen.'},
 chair:{name:'Wooden chair',price:1.25,stock:6,description:'A chair for your table or porch.'},
 radio:{name:'Table radio',price:18,stock:2,description:'A 1920s radio for the sitting room.'},
 lamp:{name:'Electric table lamp',price:2.50,stock:4,description:'Light for your finished home.'},
 moonshine:{name:'Sealed moonshine crate',price:4,stock:6,description:'Buy at the still and deliver to a discovered speakeasy. Police heat increases when you sell.'},
 bread:{name:'Bread loaf',price:.10,stock:12,heal:8,description:'A paper-wrapped loaf. Eat it to recover 8 health.'},
 coffee:{name:'Ground coffee, 1 lb',price:.50,stock:6,description:'Coffee for home or a lunch counter.'},
 sugar:{name:'Sugar, 1 lb',price:.07,stock:12,description:'A small paper sack from the grocer.'},
 milk:{name:'Milk, 1 quart',price:.14,stock:8,heal:6,description:'A glass bottle. Drink it to recover 6 health.'},
 sandwich:{name:'Ham sandwich',price:.20,stock:8,heal:15,description:'Wrapped for the road. Restores 15 health.'},
 tonic:{name:'First-aid tin',price:.75,stock:5,heal:35,description:'Dressings and antiseptic. Restores 35 health.'},
 bandage:{name:'Bandage roll',price:.15,stock:10,heal:12,description:'A clean dressing. Restores 12 health.'},
 belt:{name:'Fan belt',price:1.25,stock:5,description:'A rubber replacement belt.'},
 plugs:{name:'Spark plug set',price:2.00,stock:4,description:'A boxed set for a tired engine.'},
 cloth:{name:'Cotton cloth, 1 yard',price:.25,stock:8,description:'A bolt cut at the tailor\'s counter.'},
 cap:{name:'Wool driving cap',price:1.50,stock:3,description:'A practical cap for an open car.'},
 watch:{name:'Used pocket watch',price:4.50,stock:2,description:'A working watch with somebody else\'s initials.'},
 record:{name:'Jazz record',price:.75,stock:4,description:'A ten-inch shellac record.'},
 bottle:{name:'Empty glass bottle',price:.05,stock:15,description:'Clean glass for legal deliveries.'}
};
const secrets=[
 {front:'grocer',club:'velvet',jobs:2,price:7,door:'the flour-rack door',hint:'Finch keeps a flour rack in front of a narrow door. Knock twice. Nora runs the room behind it.'},
 {front:'tailor',club:'lucky',jobs:5,price:8,door:'the fitting-room panel',hint:'The fitting-room mirror at Brooks is a door. Ruth keeps Lucky Seven behind it.'},
 {front:'barber',club:'blue',jobs:8,price:9.50,door:'the linen-cupboard door',hint:'The linen cupboard at Leo\'s hides the Blue Lantern. Irene needs reliable suppliers.'}
];
const recipes=[
 {id:'foundation',name:'Lay the foundation',needs:{brick:4,nails:2},requires:[],description:'A brick foundation for your own place.'},
 {id:'frame',name:'Raise the walls',needs:{timber:6,nails:4},requires:['foundation'],description:'Build the frame and plank floor.'},
 {id:'roof',name:'Roof and finish the house',needs:{timber:4,nails:2,paint:2},requires:['frame'],description:'A roof, finished walls and a front door.'}
];
const shops=[
 {id:'garage',keeper:'Sal Bell',role:'MECHANIC',portrait:0,layout:'garage',color:'#87ab9a',floor:'#494e43',greeting:'Bring it in slow. A fan belt is cheaper than a tow. What do you need?',rumor:'A delivery truck earns its keep. Leave yourself enough cash for repairs.',goods:['belt','plugs'],service:['repair',3.50,'Repair your parked vehicle'],job:'parts'},
 {id:'still',keeper:'Mabel Reed',role:'STILL KEEPER',layout:'still',color:'#d0ad67',floor:'#5a4938',greeting:'Mind the copper. I need clean glass, and I pay for work that stays quiet.',rumor:'The dry law made a market. It also made every road home more dangerous.',goods:['bottle','sugar','moonshine'],job:'glass'},
 {id:'velvet',keeper:'Nora Vale',role:'JAZZ SINGER',portrait:1,layout:'club',color:'#ba8c9f',floor:'#453441',greeting:'The band starts soon. Someone always needs a record, a parcel, or a favor.',rumor:'A store receipt tells the police very little. An address on a crate tells them plenty.',goods:['record','sandwich','moonshine'],job:'music'},
 {id:'lucky',keeper:'Ruth Mercer',role:'CLUB PROPRIETOR',portrait:2,layout:'club',color:'#d7b26f',floor:'#474131',greeting:'Keep the front door respectable. Business happens at the counter.',rumor:'Goods have a price. Information depends on who is asking.',goods:['record','bottle','moonshine'],job:'glass'},
 {id:'blue',keeper:'Irene Cole',role:'BANDLEADER',layout:'club',color:'#84b9be',floor:'#30464c',greeting:'You brought the right parcel, I hope. Last night someone delivered axle grease to the piano.',rumor:'Nora at the Velvet Room has records the band wants to hear.',goods:['record','sandwich','moonshine'],job:'music'},
 {id:'docks',keeper:'Frank Doyle',role:'FREIGHT CLERK',layout:'depot',color:'#c9aa75',floor:'#5b4d3b',greeting:'Every parcel gets a label. Every label gets an address. It is a lovely system when people use it.',rumor:'The grocer, garage and tailor all collect freight here.',goods:['bottle','cloth','belt'],job:'parts'},
 {id:'safe',keeper:'Mae Sutton',role:'BOARDINGHOUSE KEEPER',layout:'boarding',color:'#a7bfa1',floor:'#514534',greeting:'A warm room, a clean bandage, and no questions shouted through my door.',rumor:'If you need honest work, the diner is short of supplies.',goods:['bandage','bread'],service:['rest',.50,'Rest and recover your health'],job:'lunch'},
 {id:'grocer',keeper:'Arthur Finch',role:'GROCER',layout:'grocer',color:'#b4bc83',floor:'#64543b',greeting:'Morning prices, even after dark. Bread is a dime. I buy back goods at a lower price than I sell them.',rumor:'The diner needs coffee and sugar. Talk to me about the lunch-counter job.',goods:['bread','coffee','sugar','milk','bottle'],job:'lunch'},
 {id:'diner',keeper:'Rose Miller',role:'LUNCH-COUNTER OWNER',layout:'diner',color:'#dcb18b',floor:'#5b5550',greeting:'Sit anywhere that does not wobble. A sandwich is twenty cents. Coffee is on the stove.',rumor:'Small deliveries pay less than a stolen car. They also attract fewer patrols.',goods:['sandwich','milk','coffee'],service:['meal',.30,'Hot meal: recover 25 health'],job:'lunch'},
 {id:'pharmacy',keeper:'Dr. Ellis Ward',role:'PHARMACIST',layout:'pharmacy',color:'#a5c5b6',floor:'#5a645b',greeting:'Dressings on the left. Antiseptic behind the counter. Tell me what you need.',rumor:'There are no miracle cures in these tins. Clean the wound and use a proper dressing.',goods:['tonic','bandage'],service:['care',1.50,'Treatment: recover full health'],job:'medical'},
 {id:'tailor',keeper:'Clara Brooks',role:'TAILOR',layout:'tailor',color:'#bb9c7d',floor:'#63503f',greeting:'Stand still if you want a straight seam. Moving parcels? That I can help with.',rumor:'The freight clerk has my cloth. The band has been waiting for its new jackets.',goods:['cloth','cap'],job:'cloth'},
 {id:'pawn',keeper:'Walter Price',role:'SECONDHAND DEALER',layout:'pawn',color:'#c2a465',floor:'#524734',greeting:'It ticks, it plays, or it is useful. Otherwise I cannot sell it. Nothing leaves this counter on credit.',rumor:'Buy for a reason. You will lose money selling the same goods straight back.',goods:['watch','record','cap','plugs'],job:'music'},
 {id:'barber',keeper:'Leo Russo',role:'BARBER',layout:'barber',color:'#bda8a3',floor:'#5c5650',greeting:'The chair is free. News costs nothing; a shave costs a quarter.',rumor:'Half this town talks while I hold a razor. The other half waits until I put it down.',goods:['bandage','cap'],service:['shave',.25,'Shave and a rest: recover 10 health'],job:'medical'},
 {id:'dealer',keeper:'Henry Cole',role:'AUTOMOBILE DEALER',layout:'dealer',color:'#c4ba94',floor:'#596261',greeting:'Look them over. The price on the card is the price I charge. Purchases are delivered outside this showroom.',rumor:'Keep some money for repairs. A fast car is no help with a cracked engine block.',goods:[],job:'parts'},
 {id:'hardware',keeper:'Agnes Bell',role:'HARDWARE MERCHANT',layout:'hardware',color:'#b2af83',floor:'#625540',greeting:'Lumber, nails, brick and paint. Building a home? Your construction book tells you how much to buy.',rumor:'A foundation needs four brick bundles and two nail boxes. Buy the materials, then build at your home lot.',goods:['timber','nails','brick','paint','belt'],job:'parts'},
 {id:'furniture',keeper:'Grace Abbott',role:'FURNITURE DEALER',layout:'furniture',color:'#c7a78a',floor:'#67503f',greeting:'A bed, a table and somewhere to sit. Once your house has a roof, bring these home and place them.',rumor:'Finish your roof before you furnish the rooms. You can move furniture back into your bag later.',goods:['bed','table','chair','radio','lamp'],job:'cloth'},
 {id:'home',keeper:'Your construction book',role:'YOUR HOME LOT',layout:'home',color:'#a8bd9a',floor:'#514f3e',greeting:'Check the plans, buy supplies at the hardware store, then construct your home in stages.',rumor:'Your house and placed furnishings save with your empire.',goods:[],job:'parts'}
];
const errands=[
 {id:'lunch',title:'Coffee Before the Lunch Rush',stops:['grocer','diner'],cargo:'coffee and sugar',pay:5,xp:70,description:'Collect the sealed coffee-and-sugar order from Finch, then hand it to Rose inside the diner.'},
 {id:'parts',title:'Keep the Delivery Trucks Moving',stops:['docks','garage'],cargo:'a box of fan belts',pay:7.50,xp:80,description:'Speak to the freight clerk inside the depot, collect the parts, then hand them to Sal inside Bell & Sons.'},
 {id:'medical',title:'Clean Dressings',stops:['pharmacy','safe'],cargo:'a medical-supply parcel',pay:6,xp:75,description:'Collect dressings from the pharmacist and deliver them to Mae inside the boardinghouse.'},
 {id:'cloth',title:'A Suit for Saturday',stops:['docks','tailor','diner'],cargo:'cloth and the finished jackets',pay:11,xp:95,description:'Collect cloth at the depot, take it to the tailor, then bring the finished jackets to Rose at the diner.'},
 {id:'music',title:'The New Record',stops:['pawn','diner','tailor'],cargo:'a borrowed jazz record',pay:9,xp:90,description:'Collect a record at the secondhand shop, let Rose hear it at the diner, then bring it to Clara at the tailor.'},
 {id:'glass',title:'Return the Empties',stops:['grocer','still'],cargo:'a crate of empty bottles',pay:8,xp:85,description:'Collect clean empty bottles at the grocer and deliver them inside the woodland still.'}
];
errands.push(
 {id:'clue-velvet',title:'The Flour Receipt',stops:['docks','grocer'],cargo:'an unusual flour receipt',pay:8,xp:90,reveal:'velvet',description:'Bring a freight receipt to Finch. Ask why the flour order lists a piano.'},
 {id:'clue-lucky',title:'The Extra Fitting Room',stops:['pharmacy','tailor'],cargo:'a parcel marked for the fitting room',pay:10,xp:100,reveal:'lucky',description:'Take a parcel from Ward to Brooks. The delivery note mentions a room that is not on the shop plan.'},
 {id:'clue-blue',title:'Music in the Linen Cupboard',stops:['diner','barber'],cargo:'a musician\'s letter',pay:12,xp:110,reveal:'blue',description:'Carry a letter from Rose to Leo. The musician asks for the cupboard entrance.'}
);
return{items,shops,errands,secrets,recipes,round:n=>Math.round((n+Number.EPSILON)*100)/100};
})();