/* Tale of the Tape — world data: places, people, names, venues.
   Everything here is plain data. The engine (engine.js) reads it; nothing here runs on its own. */
(function (T) {
  'use strict';
  const D = T.data = T.data || {};

  D.START_YEAR = 1934;
  D.END_YEAR = 1966; // the epilogue closes here at the latest

  // Heavyweight is deliberately missing: in this era it belongs to Joe Louis, and the game says so.
  D.DIVISIONS = {
    feather: { name: 'Featherweight', limit: 126, height: [62, 67], reach: [64, 69] },
    light: { name: 'Lightweight', limit: 135, height: [64, 69], reach: [66, 71] },
    welter: { name: 'Welterweight', limit: 147, height: [66, 71], reach: [68, 73] },
    middle: { name: 'Middleweight', limit: 160, height: [68, 73], reach: [70, 75] },
    lightheavy: { name: 'Light Heavyweight', limit: 175, height: [70, 75], reach: [72, 78] },
  };

  D.STYLES = {
    slugger: { name: 'Slugger', blurb: 'Hits like a freight car. Takes a few to give a few.', mods: { pow: 12, spd: -4, sta: 0, chn: 6, def: -6 } },
    boxer: { name: 'Boxer', blurb: 'Jab, move, make them miss. The thinking fighter.', mods: { pow: -4, spd: 8, sta: 2, chn: -4, def: 10 } },
    swarmer: { name: 'Swarmer', blurb: 'Never stops coming. Lives on the inside.', mods: { pow: 2, spd: 4, sta: 10, chn: 2, def: -6 } },
    counter: { name: 'Counterpuncher', blurb: 'Waits for the mistake, then makes it hurt.', mods: { pow: 4, spd: 4, sta: -4, chn: -2, def: 8 } },
  };

  D.BACKGROUNDS = {
    newsboy: { name: 'Newsboy', who: "a newsboy", blurb: 'Sold papers on the corner and fought for the corner too.', mods: { spd: 5, fame: 3, money: 15 }, age: 17 },
    coal: { name: "Coal miner's kid", who: "a coal miner's kid", blurb: 'Grew up in a company town. Nothing hits harder than a mine.', mods: { chn: 6, sta: 4, money: 5 }, age: 18 },
    dust: { name: 'Dust Bowl farm', who: "a Dust Bowl farm kid", blurb: 'The wind took the farm. You took the road.', mods: { sta: 7, heart: 10, money: 0 }, age: 18 },
    docks: { name: 'Dock worker', who: "a dock worker", blurb: 'Hauled cargo off the boats. Shoulders like a crane.', mods: { pow: 7, money: 25 }, age: 20 },
    amateur: { name: 'Golden Gloves amateur', who: "a Golden Gloves amateur", blurb: 'Won a city title. The pros already know your name.', mods: { def: 5, spd: 2, fame: 6, sharp: 20, money: 10 }, age: 19 },
    ccc: { name: 'CCC camp', who: "a kid out of a CCC camp", blurb: 'Planted trees for the New Deal at a dollar a day. Camp bouts on Fridays.', mods: { sta: 4, pow: 3, heart: 6, money: 20 }, age: 18 },
  };

  // Hometowns. gym: where you start. club: small local venue. arena: the big room in town.
  D.CITIES = {
    detroit: { name: 'Detroit', gym: 'the Brewster Recreation Center', club: 'the Arcadia', arena: 'Olympia Stadium', park: 'Briggs Stadium', job: 'the Ford Rouge plant', region: 'Midwest' },
    chicago: { name: 'Chicago', gym: 'a gym above a Halsted Street pool hall', club: 'Marigold Gardens', arena: 'Chicago Stadium', park: 'Comiskey Park', job: 'the Union Stock Yards', region: 'Midwest' },
    newyork: { name: 'New York', gym: "Stillman's Gym", club: 'St. Nicholas Arena', arena: 'Madison Square Garden', park: 'Yankee Stadium', job: 'the Hudson River piers', region: 'East' },
    philly: { name: 'Philadelphia', gym: 'a South Philly basement gym', club: 'the Cambria Athletic Club', arena: 'the Philadelphia Arena', park: 'Shibe Park', job: 'the Navy Yard', region: 'East' },
    pittsburgh: { name: 'Pittsburgh', gym: 'a gym on the North Side', club: 'the Motor Square Garden', arena: 'Duquesne Gardens', park: 'Forbes Field', job: 'the Jones & Laughlin steel mill', region: 'East' },
    la: { name: 'Los Angeles', gym: 'the Main Street Gym', club: 'Hollywood Legion Stadium', arena: 'the Olympic Auditorium', park: 'Wrigley Field (L.A.)', job: 'the oil fields in Signal Hill', region: 'West' },
    neworleans: { name: 'New Orleans', gym: 'a gym off Rampart Street', club: 'the Coliseum Arena', arena: 'the Coliseum Arena', park: 'Pelican Stadium', job: 'the river docks', region: 'South' },
    tulsa: { name: 'Tulsa', gym: 'a barn gym outside town', club: 'the county fairgrounds', arena: 'the Tulsa Coliseum', park: 'Texas League Park', job: 'the oil refinery', region: 'Plains' },
  };

  // Cities you can be booked into beyond home. Big rooms first.
  D.ROAD = [
    { city: 'New York', venues: ['Madison Square Garden', 'St. Nicholas Arena', 'Ridgewood Grove', 'Sunnyside Garden', 'the Polo Grounds', 'Yankee Stadium'] },
    { city: 'Chicago', venues: ['Chicago Stadium', 'Marigold Gardens', 'Comiskey Park'] },
    { city: 'Detroit', venues: ['Olympia Stadium', 'the Arcadia'] },
    { city: 'Philadelphia', venues: ['the Philadelphia Arena', 'Shibe Park'] },
    { city: 'Pittsburgh', venues: ['Duquesne Gardens', 'Forbes Field'] },
    { city: 'Boston', venues: ['Boston Garden', 'the Mechanics Building'] },
    { city: 'Cleveland', venues: ['the Cleveland Arena', 'Public Hall'] },
    { city: 'Los Angeles', venues: ['the Olympic Auditorium', 'Hollywood Legion Stadium'] },
    { city: 'Washington', venues: ['Griffith Stadium', 'Uline Arena'] },
    { city: 'Miami Beach', venues: ['the Miami Beach Auditorium'] },
    { city: 'London', venues: ['Harringay Arena'] },
  ];
  // Rooms that did not exist yet before a given year.
  D.VENUE_OPENED = { 'the Cleveland Arena': 1937, 'Briggs Stadium': 1938, 'Uline Arena': 1941, 'Harringay Arena': 1936, 'the Miami Beach Auditorium': 1951 };

  // Small-time stages for the first fights of a career.
  D.SMOKERS = ['an Elks Lodge smoker', 'the National Guard armory', 'a church basement card', 'the American Legion hall', 'a county fair tent', 'a lumberyard card', 'the Knights of Columbus hall'];

  D.FIRST = ['Joe', 'Johnny', 'Eddie', 'Tommy', 'Frankie', 'Billy', 'Jimmy', 'Sammy', 'Tony', 'Lou', 'Al', 'Benny', 'Willie', 'Ray', 'Mickey', 'Pete', 'Nick', 'Gus', 'Leo', 'Sal', 'Abe', 'Izzy', 'Max', 'Stan', 'Walt', 'Hank', 'Earl', 'Clarence', 'Leroy', 'Otis', 'Ernest', 'Henry', 'Manuel', 'Ruben', 'Alfredo', 'Pedro', 'Ramon', 'Ernesto', 'Vince', 'Dom', 'Harry', 'Jack', 'Charlie', 'Freddie', 'Danny', 'Marty', 'Augie', 'Wes', 'Cleo', 'Roscoe', 'Teddy', 'Irv', 'Joey', 'Bobby', 'Carmine', 'Fritz', 'Lefty', 'Moe', 'Rocco', 'Felix', 'Julio', 'Armand', 'Cecil', 'Archie', 'Luis', 'Tadeusz', 'Paddy', 'Seamus', 'Ike', 'Herb'];
  D.LAST = ['Brennan', 'Callahan', 'Doyle', 'Flynn', 'Kearney', 'Malone', 'Shea', 'Rizzo', 'Marino', 'DeLuca', 'Ferrante', 'Bellomo', 'Levin', 'Rosen', 'Kaplan', 'Siegel', 'Wexler', 'Kowalski', 'Novak', 'Zaleski', 'Hrabal', 'Washington', 'Jefferson', 'Hollis', 'Moore', 'Pettaway', 'Gaines', 'Tate', 'Ortega', 'Salas', 'Herrera', 'Villa', 'Dela Cruz', 'Santos', 'Reyes', 'Villanueva', 'Lindqvist', 'Svoboda', 'Brandt', 'Hogan', 'Quinlan', 'Costa', 'Abruzzi', 'Greenberg', 'Pulaski', 'Dombrowski', 'Banks', 'Coleman', 'Merritt', 'Strickland', 'Fuentes', 'Mendoza', 'Castillo', 'Okafor', 'Duval', 'Fontaine', 'Mahoney', 'Garrity', 'Petrakis', 'Stavros', 'Haddad', 'Nakamura', 'Lund', 'Kessler', 'Vogel', 'Tierney', 'Burke', 'Spano', 'Lombardi', 'Esposito', 'Gilmore', 'Truitt', 'Ashby', 'Pruitt', 'Haley'];
  D.NICKS = ['Kid', 'Battling', 'Young', 'Two-Fisted', 'Steamboat', 'Tiger', 'Cyclone', 'Iron', 'Sailor', 'Sweet', 'Gentleman', 'Bulldog', 'Hurricane', 'Smokey', 'Honey Boy', 'Choo-Choo', 'Butcher Boy', 'Babyface', 'Irish', 'Slugger', 'Lefty', 'Toy Bulldog', 'Wildcat', 'Dynamite', 'Kingfish', 'Rawhide', 'Sugar', 'Bomber', 'Ace', 'Duke', 'Professor', 'Deacon', 'Rocky', 'Bearcat', 'Whirlwind', 'Tornado', 'Gunboat', 'Spider', 'Sonny', 'Champ', 'Bingo', 'Spike', 'Mule', 'Doc', 'Bucky', 'Scrap Iron', 'Bounce', 'Pug', 'Cannonball', 'Twinkletoes'];
  // Names too close to famous real fighters of the era. Generated names skip these.
  D.AVOID = ['Joe Louis', 'Billy Conn', 'Tony Zale', 'Barney Ross', 'Henry Armstrong', 'Jimmy Braddock', 'Max Baer', 'Rocky Graziano', 'Jake LaMotta', 'Willie Pep', 'Sandy Saddler', 'Jersey Joe', 'Ray Robinson', 'Max Schmeling', 'Joey Maxim', 'Archie Moore', 'Ike Williams', 'Fritzie Zivic', 'Tony Canzoneri', 'Lou Ambers', 'Beau Jack', 'Bob Montgomery'];

  D.TRAINERS = [
    { name: 'Pops Delaney', trait: 'old school', line: 'Roadwork at five. Complaints at never.' },
    { name: 'Gus Abruzzi', trait: 'scientist', line: 'Every fighter has a tell. Every one.' },
    { name: 'Doc Hollis', trait: 'cutman', line: 'I can close anything but your mouth.' },
    { name: 'Mama Salas', trait: 'tough love', line: 'You eat, you sleep, you jab. In that order.' },
    { name: 'Whitey Brandt', trait: 'old school', line: 'In my day we fought forty rounds and liked it.' },
    { name: 'Clarence "Sarge" Banks', trait: 'conditioning', line: 'Lungs win fights. Fists just sign the paperwork.' },
    { name: 'Izzy Wexler', trait: 'scientist', line: "Don't fight the man. Fight his habits." },
    { name: 'Teddy Quinlan', trait: 'motivator', line: 'They paid to see you. Show them something.' },
  ];
  D.MANAGERS = [
    { name: 'Lou "the Ledger" Rosen', trait: 'honest', line: 'A third is my cut. A third is the law. I take a third.' },
    { name: 'Benny Marino', trait: 'connected', line: 'I know a guy. I always know a guy.' },
    { name: 'Hattie Coleman', trait: 'honest', line: 'You fight. I read the fine print.' },
    { name: 'Sal "Sunny" Spano', trait: 'connected', line: 'Smile for the camera, kid. Smile for my friends.' },
    { name: 'Marty Kessler', trait: 'showman', line: 'Nobody pays to see a nice guy. Be a story.' },
    { name: 'Roscoe Pettaway', trait: 'honest', line: 'We take the fights that make sense, not the ones that make noise.' },
  ];
  D.REPORTERS = [
    { name: 'Dutch Fontaine', paper: 'the Evening Telegram' },
    { name: 'Nellie Haddad', paper: 'the Daily Clarion' },
    { name: 'Ward Ashby', paper: 'the Morning Ledger' },
    { name: 'Ruby Truitt', paper: 'the Courier' },
  ];
  D.SPONSORS_1950S = ['Kingsley Razor Blades', 'Crest-O Hair Tonic', 'Bluebird Beer', 'Atlas Cigars', 'Golden Crown Coffee'];

  // Things an opponent does in the ring. Purely for flavor and the "tale of the tape" card.
  D.QUIRKS = [
    'chews gum the entire fight', 'blows a kiss to his mother in row three', 'flexes for the photographers between rounds',
    'hums a Bing Crosby tune while he works', 'wears the same lucky socks since 1929', 'touches gloves, then sneers',
    'keeps a rabbit foot taped inside his robe', 'shadowboxes his own reflection in the ring post', 'winks at the judges',
    'never stops smiling, even when he is bleeding', 'dances a little Lindy Hop when he lands one', 'insults your haircut',
    'reads poetry to reporters at the weigh-in', 'brings a live parrot to the weigh-in', 'calls every punch out loud before he throws it',
    'refuses to sit on his stool between rounds', 'eats a raw onion before every fight', 'slicks his hair back after every exchange',
  ];
  D.TRASH = [
    "I've seen tougher customers at the bakery.", 'Tell your corner to bring a stretcher.', 'Your mother should have kept you in school.',
    "I'll be home in time for supper.", 'I hope you like the smell of canvas.', 'You hit like a library book.',
    "I'm gonna dance on you like it's Saturday night.", 'Nobody remembers the guy I beat. Get used to it.',
    "Let's make it quick. I've got a date.", "They told me you were somebody. They lied.", "I'll be gentle. Nah, I won't.",
  ];

  // Skin, hair, trunks palettes for drawing fighters.
  D.SKINS = ['#f2c9a0', '#e5b48a', '#cf9a6c', '#b07a4f', '#8c5a36', '#6a4128', '#4a2c1b'];
  D.HAIRS = ['#1d1612', '#3a2618', '#5b3a22', '#8a5a2b', '#b98a4a', '#c9c2b5', '#7a2f18'];
  D.TRUNKS = ['#b8231b', '#1f3f8f', '#e0a526', '#1a1612', '#f1e6cc', '#2f6b3a', '#6b2d7a', '#d76a1f'];
  D.HAIRCUTS = ['slick', 'crop', 'curly', 'bald', 'flat', 'wave'];

  // Work you can find, by era. pay is per month in that era's dollars.
  D.JOBS = [
    { from: 1934, to: 1935, name: 'day labor', pay: [18, 30] },
    { from: 1935, to: 1942, name: 'a WPA road crew', pay: [40, 55], note: 'The Works Progress Administration put millions to work building roads, schools and parks.' },
    { from: 1942, to: 1945, name: 'a war plant', pay: [120, 170], note: 'War production ended the Depression almost overnight. Factories ran around the clock.' },
    { from: 1946, to: 1966, name: 'factory work', pay: [150, 260] },
  ];

  // Era of the world, which drives presentation and some rules.
  D.ERAS = [
    { id: 'depression', from: 1934, to: 1941, name: 'The Depression', look: 'poster', blurb: 'One in five workers had no job when you started. A purse could feed a family for a month.' },
    { id: 'war', from: 1941, to: 1945, name: 'The War Years', look: 'newsreel', blurb: 'Fighters traded robes for uniforms. Boxing went on, often for the troops.' },
    { id: 'postwar', from: 1946, to: 1949, name: 'Postwar Boom', look: 'newsreel', blurb: 'The soldiers came home, the factories kept humming, and everyone had money for a ticket.' },
    { id: 'tv', from: 1949, to: 1967, name: 'The Television Era', look: 'tv', blurb: 'Boxing became the biggest show on the new small screen. Small clubs started to empty out.' },
  ];

  // Played-fight announcer voices by era.
  D.CALLS = {
    poster: {
      open: ['Good evening, ladies and gentlemen of the radio audience!', 'From ringside, where the smoke is thick and the seats are full!'],
      down: ["He's down! He's down! Glory be!", 'Down goes {N}! The crowd is on its feet!', 'Oh my, what a punch! {N} is on the canvas!'],
      big: ['A thunderbolt from {N}!', "Oh, he felt that one in his grandmother's teeth!", 'What a wallop!'],
      bell: ['And there is the bell!', 'Saved by the bell, folks, if he needed saving.'],
    },
    newsreel: {
      open: ['From the fight capital of the world, the boys are ready!', 'Tonight the fight fans forget their ration books!'],
      down: ['Down he goes! A real knockdown!', '{N} hits the deck!'],
      big: ['Bombs away from {N}!', 'A haymaker that would make a sergeant proud!'],
      bell: ['There goes the bell!', 'End of the round, and what a round!'],
    },
    tv: {
      open: ['Good evening and welcome to the Friday night fights!', 'Live, coast to coast, here come the fighters!'],
      down: ['DOWN! {N} is down, folks, right in your living room!', 'He is DOWN! Pull the kids closer to the set!'],
      big: ['What a shot by {N}!', 'Did you see that one at home?'],
      bell: ["That's the bell. Stay tuned, folks.", 'Bell! And a word from our sponsor.'],
    },
  };

  D.ONOMATOPOEIA = ['POW!', 'WHAM!', 'SOCK!', 'BIFF!', 'BAM!', 'CRACK!', 'THWACK!', 'BLAM!', 'SMACK!', 'WALLOP!', 'BONK!', 'KA-POW!'];

  D.ACHIEVEMENTS = [
    { id: 'first_win', name: 'Paid in Full', text: 'Win your first professional fight.' },
    { id: 'ko_artist', name: 'Lights Out', text: 'Score ten knockouts in one career.' },
    { id: 'champ', name: 'The Belt', text: 'Win a world title.' },
    { id: 'defender', name: 'Fighting Champion', text: 'Defend the title three times.' },
    { id: 'iron_chin', name: 'Iron Chin', text: 'Finish a career of 20+ fights without being knocked out.' },
    { id: 'comeback', name: 'Comeback Kid', text: 'Win three straight after losing three straight.' },
    { id: 'served', name: 'Service Stripe', text: 'Serve in the armed forces during World War II.' },
    { id: 'tv_star', name: 'Ready for Your Close-Up', text: 'Headline a televised main event.' },
    { id: 'clean', name: 'Clean Hands', text: 'Refuse every crooked offer and finish your career.' },
    { id: 'bent', name: 'Took a Dive', text: 'Throw a fight for the mob.' },
    { id: 'broke', name: 'Easy Come, Easy Go', text: 'Go broke after earning $10,000 or more.' },
    { id: 'rich', name: 'Smart Money', text: 'Retire with $25,000 in the bank.' },
    { id: 'gym', name: 'The Gym Rat', text: 'Open your own gym.' },
    { id: 'old_man', name: 'Old Man River', text: 'Win a fight at age 37 or older.' },
    { id: 'rival_done', name: 'Settled It', text: 'Beat your rival twice.' },
    { id: 'abroad', name: 'Passport Stamped', text: 'Fight overseas.' },
    { id: 'unbeaten', name: 'Unbeaten', text: 'Retire with no losses after 15 or more fights.' },
    { id: 'skill_ko', name: 'Fists of Fury', text: 'Win a fight you played yourself by knockout.' },
    { id: 'long_life', name: 'The Long Game', text: 'Reach the 1960s.' },
    { id: 'activist', name: 'Bigger Than Boxing', text: 'Use your name to fight for civil rights.' },
  ];
})(globalThis.TOT = globalThis.TOT || {});
