/* Tale of the Tape — the real timeline.
   These fire on their real dates, in order, no matter what. The game only changes how they land on your life.
   `archive` is the plain-history note students read. Keep it accurate and short. m is 0-based (0 = January). */
(function (T) {
  'use strict';
  const D = T.data;
  const H = T.history = [
    {
      id: 'h_louis_debut', y: 1934, m: 6, d: 4, kicker: 'Sports Page', title: 'A Quiet Kid from Detroit Turns Pro',
      text: (s) => `A 20-year-old heavyweight named Joe Louis Barrow wins his first professional fight in Chicago, a first-round knockout. ${s.f.home === 'detroit' ? 'You have seen him at the Brewster Center. He does not say much. He does not have to.' : 'The old-timers at your gym say to remember the name.'}`,
      archive: 'Joe Louis made his pro debut on July 4, 1934. His managers built a careful public image for him because white America had not forgiven Jack Johnson, the first Black heavyweight champion, for refusing to act humble.',
      choices: [
        { label: 'Study his footage at the newsreel theater', hint: 'Defense', go: (x) => { x.stat('def', 1.5); return 'Short punches, no wasted motion. You steal everything you can.'; } },
        { label: 'Shrug. You have your own career', go: (x) => { x.heart(2); return 'Somebody else\'s story. You go back to yours.'; } },
      ],
    },
    {
      id: 'h_dust', y: 1935, m: 3, d: 14, kicker: 'Extra', title: 'Black Sunday',
      text: (s) => `A wall of dust a thousand miles long rolls across the Great Plains and turns day into night. ${s.f.bg === 'dust' || s.f.home === 'tulsa' ? 'A letter comes from home. The last of the wheat is gone. Your family is thinking about California.' : 'Newspapers call the region the Dust Bowl. Families are loading everything onto trucks and heading west.'}`,
      archive: 'On April 14, 1935, the worst "black blizzard" of the Dust Bowl hit the southern Plains. Drought and over-plowed farmland drove roughly 2.5 million people out of the Plains states during the 1930s.',
      choices: (s) => (s.f.bg === 'dust' || s.f.home === 'tulsa'
        ? [
            { label: 'Send home most of what you have', hint: 'Money down, heart up', go: (x) => { const n = Math.min(Math.max(0, x.s.money), Math.round(x.s.money * 0.7)); x.rawMoney(-n); x.heart(10); x.rep(4); x.flag('helped_family'); x.remember('family', `sent most of my money home when the Dust Bowl took the farm`, 2); return `You send $${n}. A letter comes back with a pressed flower and no complaints.`; } },
            { label: 'Send a little. You need to eat too', go: (x) => { x.rawMoney(-Math.min(Math.max(0, x.s.money), 10)); x.heart(2); return 'You send ten dollars and a promise.'; } },
            { label: 'Tell them to come live with you', hint: 'Costs more every month', go: (x) => { x.flag('family'); x.heart(12); x.remember('family', 'took my whole family in after the Dust Bowl', 2); return 'They arrive with two suitcases and a mattress tied to a Ford. The apartment gets loud. It also gets warm.'; } },
          ]
        : [{ label: 'Read the paper and keep training', go: (x) => { x.heart(-1); return 'The dust settles on somebody else\'s life. This time.'; } }]),
    },
    {
      id: 'h_wpa', y: 1935, m: 4, d: 6, kicker: 'Washington', title: 'Roosevelt Creates the WPA',
      text: 'The Works Progress Administration will hire millions of jobless Americans to build roads, bridges, schools, and parks. A steady government paycheck is suddenly possible between fights.',
      archive: 'The WPA was created in May 1935 as part of the New Deal. At its peak it employed more than 3 million people. "Work" between fights now pays more.',
      choices: [{ label: 'Good to know', go: () => 'You keep the clipping in your wallet.' }],
    },
    {
      id: 'h_braddock', y: 1935, m: 5, d: 13, kicker: 'Sports Page', title: 'Cinderella Man Wins the Title',
      text: 'James J. Braddock, a washed-up heavyweight who was on public relief two years ago, upsets Max Baer to become heavyweight champion of the world. Every broke fighter in America reads the story twice.',
      archive: 'Braddock had worked the docks and collected relief money during the worst of the Depression. He paid the relief money back after becoming champion. Sportswriter Damon Runyon called him the "Cinderella Man."',
      choices: [
        { label: 'If he can do it, so can you', hint: 'Heart', go: (x) => { x.heart(10); return 'You run an extra mile that morning, grinning like an idiot.'; } },
        { label: 'Pin the story above your locker', hint: 'Fame', go: (x) => { x.fame(1); x.heart(4); return 'A reporter sees it and asks about it. You tell him about your own long odds.'; } },
      ],
    },
    {
      id: 'h_carnera', y: 1935, m: 5, d: 25, kicker: 'Sports Page', title: 'Louis Destroys Carnera at Yankee Stadium',
      text: 'More than 60,000 people watch Joe Louis stop the giant Italian Primo Carnera in six rounds. With Mussolini threatening to invade Ethiopia, the papers treat it as more than a fight.',
      archive: 'Many Black Americans saw Louis\'s win as a symbolic answer to Fascist Italy, which invaded Ethiopia, one of the only independent African nations, that October.',
    },
    {
      id: 'h_social_security', y: 1935, m: 7, d: 14, kicker: 'Washington', title: 'Social Security Becomes Law',
      text: 'President Roosevelt signs the Social Security Act: old-age pensions and unemployment insurance. Your trainer laughs. "Nobody\'s paying pensions to prizefighters."',
      archive: 'The Social Security Act of 1935 created a federal safety net for old age and unemployment. Many agricultural and domestic workers, disproportionately Black and Mexican American, were left out at first.',
    },
    {
      id: 'h_detroit_champs', y: 1936, m: 3, d: 11, when: (s) => s.f.home === 'detroit', kicker: 'Local News', title: 'City of Champions',
      text: 'The Red Wings win the Stanley Cup. With the Tigers\' World Series and the Lions\' championship last year, and Joe Louis on the rise, Detroit is calling itself the City of Champions. The whole town feels taller.',
      archive: 'Between 1935 and 1936, Detroit teams won the World Series, the NFL championship, and the Stanley Cup, in the middle of the Depression.',
      choices: [{ label: 'Ride the wave', hint: 'Fame', go: (x) => { x.fame(2); x.heart(5); return 'A local sportswriter adds your name to a list of "Detroit\'s next champions."'; } }],
    },
    {
      id: 'h_green_book', y: 1936, m: 4, kicker: 'Notice', title: 'A Guide for the Road',
      text: (s) => `A postal worker from Harlem named Victor Hugo Green publishes a guide listing hotels, restaurants, and gas stations that will serve Black travelers. Deacon Tate, the best fighter in your gym, buys a copy. "So I know where I can sleep when they send me out of town."`,
      archive: 'The Negro Motorist Green Book was published from 1936 to 1966. Segregation, by law in the South and by custom in much of the North, made travel dangerous and humiliating for Black Americans, including athletes.',
      choices: [
        { label: 'Ask Deacon about it', go: (x) => { x.flag('tate_story'); x.rep(2); return '"You get used to it," he says. Then: "No. You don\'t."'; } },
        { label: 'Say nothing', go: () => 'He puts it in his gym bag, next to his wraps.' },
      ],
    },
    {
      id: 'h_schmeling1', y: 1936, m: 5, d: 19, kicker: 'Extra', title: 'SCHMELING KNOCKS OUT LOUIS',
      text: 'The unbeaten Joe Louis is knocked out in the twelfth round by Germany\'s Max Schmeling. Schmeling said he spotted a flaw: Louis dropped his left hand after jabbing. In Harlem, people cry in the street. In Berlin, the Nazi press celebrates.',
      archive: 'The loss on June 19, 1936, was the first of Louis\'s career. The Nazi government used Schmeling\'s win as propaganda, though Schmeling himself never joined the party.',
      choices: [
        { label: 'Check your own left hand', hint: 'Defense', go: (x) => { x.stat('def', 2); return 'Your trainer catches you dropping it after the jab. Every. Single. Time. You fix it.'; } },
        { label: 'Lesson: everybody can lose', hint: 'Heart', go: (x) => { x.heart(4); return 'If Louis can lose, a loss does not end anybody.'; } },
      ],
    },
    {
      id: 'h_owens', y: 1936, m: 7, d: 9, kicker: 'Berlin', title: 'Owens Wins Four Golds',
      text: 'At the Berlin Olympics, Jesse Owens wins four gold medals in front of Hitler\'s government. When he comes home, he still cannot enter some hotels through the front door.',
      archive: 'Jesse Owens won the 100m, 200m, long jump, and 4x100 relay in August 1936. President Roosevelt never invited him to the White House.',
      link: null,
    },
    {
      id: 'h_louis_champ', y: 1937, m: 5, d: 22, kicker: 'Extra', title: 'LOUIS IS CHAMPION',
      text: 'Joe Louis knocks out James J. Braddock in the eighth round at Comiskey Park in Chicago. He is the first Black heavyweight champion since Jack Johnson lost the title in 1915. In Black neighborhoods across the country, people pour into the streets.',
      archive: 'Louis held the heavyweight title from 1937 to 1949, longer than anyone in history. He defended it 25 times. That is why there is no heavyweight division in this game: the title was his.',
      choices: [
        { label: 'Celebrate with Deacon and the gym', hint: 'Heart', go: (x) => { x.heart(8); x.flag('tate_friend'); return 'Deacon dances on the ring apron. "The door\'s open now," he says. "Maybe it\'s open."'; } },
        { label: 'Train instead. Your title won\'t win itself', hint: 'Power', go: (x) => { x.stat('pow', 1.5); return 'You can hear the car horns from the heavy bag.'; } },
      ],
    },
    {
      id: 'h_schmeling2', y: 1938, m: 5, d: 22, kicker: 'Extra', title: 'TWO MINUTES, FOUR SECONDS',
      text: 'Rematch at Yankee Stadium. Joe Louis knocks out Max Schmeling in two minutes and four seconds of the first round. Tens of millions of Americans are listening on the radio. It is the biggest fight in the world, and everybody is treating it like a war before the war.',
      archive: 'June 22, 1938. With Nazi Germany expanding in Europe, Louis became an American hero across racial lines, still rare in 1938. Schmeling later helped hide two Jewish boys during the Kristallnacht pogrom.',
      link: { href: '/hubs/bts-two-minutes-four-seconds.html', label: 'Open the StoryHub: Two Minutes, Four Seconds' },
      choices: [
        { label: 'Listen at a packed tavern', hint: 'Fame', go: (x) => { x.fame(2); x.heart(5); return 'The place goes crazy. Somebody recognizes you and buys you a soda. Somebody else tries to buy you a beer.'; } },
        { label: 'Listen at home with family', hint: 'Heart', go: (x) => { x.heart(9); return 'Your mother cries. Your father pretends he isn\'t.'; } },
        { label: 'Listen at the gym with Deacon Tate', hint: 'Unlocks a story', go: (x) => { x.heart(6); x.flag('tate_friend'); x.flag('tate_story'); return '"The whole country is cheering for a Black man tonight," Deacon says. "Tomorrow, we\'ll see."'; } },
      ],
    },
    {
      id: 'h_poland', y: 1939, m: 8, d: 1, kicker: 'Extra', title: 'WAR IN EUROPE',
      text: 'Germany invades Poland. Britain and France declare war. The United States says it will stay out. The guys at the gym argue about it between rounds.',
      archive: 'World War II began in Europe on September 1, 1939. Most Americans wanted to stay neutral, but defense spending started pulling the economy out of the Depression.',
    },
    {
      id: 'h_draft', y: 1940, m: 9, d: 16, kicker: 'Washington', title: 'Draft Registration Day',
      text: (s) => {
        const a = T.engine.age(s);
        return a >= 21 && a <= 35
          ? `The first peacetime draft in American history. Every man from 21 to 35 has to register. You stand in line at a school gym and get a card with a number on it. You are ${a}.`
          : `The first peacetime draft in American history. Every man from 21 to 35 has to register. At ${a}, you are ${a < 21 ? 'too young for now' : 'too old'}, but half your gym is in line.`;
      },
      archive: 'The Selective Training and Service Act of 1940 registered about 16 million men on October 16, 1940. Draft numbers were drawn in a lottery in Washington.',
      go: (x) => { x.flag('registered'); return ''; },
    },
    {
      id: 'h_8802', y: 1941, m: 5, d: 25, kicker: 'Washington', title: 'Roosevelt Bans Discrimination in Defense Jobs',
      text: 'Under pressure from labor leader A. Philip Randolph, who threatened a march on Washington, President Roosevelt signs an order banning racial discrimination in defense industries.',
      archive: 'Executive Order 8802 (June 25, 1941) created the Fair Employment Practice Committee. It was the first federal action against job discrimination since Reconstruction.',
      choices: [{ label: 'Tell Deacon', go: (x) => { x.flag('tate_story'); return '"Defense jobs," he says. "Not title fights." But he is smiling a little.'; } }],
    },
    {
      id: 'h_pearl', y: 1941, m: 11, d: 7, kicker: 'Extra', title: 'JAPAN ATTACKS PEARL HARBOR',
      art: 'pearl',
      text: (s) => {
        const a = T.engine.age(s);
        const champ = s.champ ? ' You are the champion of the world. Everyone wants to know what you will do.' : '';
        return `Sunday morning. The radio cuts into the music: Japanese planes have bombed the American fleet at Pearl Harbor, Hawaii. Tomorrow the United States will be at war. You are ${a}.${champ} Your draft classification is about to matter.`;
      },
      archive: 'The attack on December 7, 1941 killed about 2,400 Americans. Congress declared war on Japan the next day. Germany and Italy declared war on the U.S. three days later.',
      choices: (s) => {
        const a = T.engine.age(s);
        const list = [];
        if (a <= 38) {
          list.push({ label: 'Enlist in the Army', hint: 'Your boxing career pauses', go: (x) => { x.enlist('Army', 'enlisted'); x.rep(8); x.fame(2); return 'You are in line at the recruiting office before the sun is up on Monday.'; } });
          list.push({ label: 'Enlist in the Navy', hint: 'Your boxing career pauses', go: (x) => { x.enlist('Navy', 'enlisted'); x.rep(8); x.fame(2); return 'You walk into the Navy recruiting station. The petty officer recognizes your name.'; } });
          if (s.fame >= 35) list.push({ label: 'Offer to box exhibitions for the troops', hint: 'Like Joe Louis did', go: (x) => { x.enlist('Army', 'exhibition'); x.rep(10); x.fame(4); return 'The Army has a job for famous fighters: boxing shows on bases, bond rallies, morale. You will still wear the uniform.'; } });
          list.push({ label: 'Keep fighting until they call your number', hint: 'You could be drafted any month', go: (x) => { x.flag('waiting_draft'); return 'You keep training. Every letter from the government makes your stomach drop.'; } });
        } else list.push({ label: 'Buy war bonds and keep fighting', hint: 'Too old for the draft', go: (x) => { x.rep(4); x.money(-20); return 'At your age, the draft board will not want you. You buy bonds and box charity shows.'; } });
        return list;
      },
    },
    {
      id: 'h_louis_relief', y: 1942, m: 0, d: 9, kicker: 'Sports Page', title: 'Louis Fights for the Navy, Then Joins the Army',
      text: 'Joe Louis defends his title against Buddy Baer and donates his purse to the Navy Relief Society, even though the Navy only allows Black sailors to serve as mess attendants. The next day he enlists in the Army.',
      archive: 'Louis gave two title-fight purses to military relief funds in 1942 and boxed close to 100 exhibitions for troops during the war. He also quietly pushed the Army to let Black soldiers, including Jackie Robinson, into officer training.',
      when: (s) => s.phase !== 'service',
      choices: [
        { label: 'Pledge your next purse to war relief', hint: 'Reputation, fame', go: (x) => { x.flag('charity_purse'); x.rep(8); x.fame(3); return 'The papers pick it up. A columnist calls you "a credit to the game."'; } },
        { label: 'Buy a war bond and move on', go: (x) => { x.money(-15); x.rep(2); return 'A $25 bond for $18.75. It is something.'; } },
      ],
    },
    {
      id: 'h_double_v', y: 1942, m: 1, d: 7, kicker: 'Pittsburgh Courier', title: 'Double Victory',
      text: 'The Pittsburgh Courier, a Black newspaper, launches the Double V campaign: victory over fascism abroad and victory over racism at home. Deacon Tate pins the Double V emblem to his gym bag.',
      archive: 'The Double V campaign spread across Black America in 1942. It argued that a country fighting Nazi racism overseas had to confront segregation at home.',
      choices: [
        { label: 'Wear a Double V pin to your next weigh-in', hint: 'Some will love it. Some won\'t', go: (x) => { x.rep(6); x.flag('activist_seed'); x.flag('tate_story'); if (x.chance(0.4)) { x.fame(-2); return 'A promoter tells you to "keep politics out of the ring." Deacon shakes your hand.'; } x.fame(2); return 'A photographer catches it. The picture runs in the Black press. Deacon shakes your hand.'; } },
        { label: 'Stay out of it', go: () => 'You keep your head down. Deacon does not mention it.' },
      ],
    },
    {
      id: 'h_rationing', y: 1942, m: 4, d: 5, kicker: 'Home Front', title: 'Ration Books',
      text: 'Sugar rationing begins. Coffee, meat, and gasoline are next. Every family gets a ration book, and every fighter makes weight a little easier.',
      archive: 'The Office of Price Administration rationed sugar, coffee, meat, butter, gasoline, tires, and shoes during the war, so the military would have enough.',
      when: (s) => s.phase !== 'service',
      choices: [
        { label: 'Plant a victory garden behind the gym', hint: 'Saves money', go: (x) => { x.flag('frugal'); x.heart(3); return 'Tomatoes, beans, and one heroic zucchini. Your monthly costs drop.'; } },
        { label: 'Buy a little extra on the black market', hint: 'Risky', go: (x) => { if (x.chance(0.3)) { x.rep(-8); x.money(-15); x.note('A ration inspector catches the deal. Your name ends up in a newspaper item.', 'bad'); return 'Caught. Fined, and your name in the paper next to the word "chiseler."'; } x.stat('pow', 0.5); return 'Steak in wartime. You don\'t ask where it came from.'; } },
      ],
    },
    {
      id: 'h_dday', y: 1944, m: 5, d: 6, kicker: 'Extra', title: 'D-DAY',
      text: (s) => s.phase === 'service' ? 'The Allies land in Normandy. The news moves through your unit in whispers, then in cheers, then in silence for the men who did not make it off the beach.' : 'Allied troops land on the beaches of Normandy, France. Church bells ring in American towns. At the gym, nobody hits anything for an hour.',
      archive: 'On June 6, 1944, about 156,000 Allied troops landed in Normandy, opening the western front against Nazi Germany.',
    },
    {
      id: 'h_gi_bill', y: 1944, m: 5, d: 22, kicker: 'Washington', title: 'The GI Bill',
      text: 'The Servicemen\'s Readjustment Act promises veterans money for college, job training, and home and business loans. For a fighter in uniform, it means life after boxing just got a little more possible.',
      archive: 'The GI Bill helped about 8 million veterans go to school and millions more buy homes. Many Black veterans were blocked from its benefits by segregated colleges and discriminatory banks.',
      go: (x) => { if (x.s.phase === 'service' || x.s.flags.veteran) x.flag('gi_bill'); return ''; },
    },
    {
      id: 'h_fdr', y: 1945, m: 3, d: 12, kicker: 'Extra', title: 'ROOSEVELT IS DEAD',
      text: 'Franklin Roosevelt, president since 1933, the only president you can remember, dies in Warm Springs, Georgia. Harry Truman is sworn in.',
      archive: 'FDR was elected four times and led the country through the Depression and most of the war.',
    },
    {
      id: 'h_ve', y: 1945, m: 4, d: 8, kicker: 'Extra', title: 'V-E DAY',
      text: 'Germany surrenders. The war in Europe is over. In Times Square, a million people. The war in the Pacific goes on.',
      archive: 'Victory in Europe Day, May 8, 1945.',
    },
    {
      id: 'h_vj', y: 1945, m: 7, d: 15, kicker: 'Extra', title: 'JAPAN SURRENDERS',
      text: (s) => s.phase === 'service' ? 'It is over. After atomic bombs destroy Hiroshima and Nagasaki, Japan surrenders. Someone in your unit fires a flare into the sky. You think about home, and about whether your legs still remember how to box.' : 'After atomic bombs destroy Hiroshima and Nagasaki, Japan surrenders. The war is over. Millions of men are coming home, and a lot of them are fighters.',
      archive: 'Japan announced its surrender on August 15, 1945, and signed on September 2. Around 16 million Americans served in the war; over 400,000 died.',
    },
    {
      id: 'h_conn_tv', y: 1946, m: 5, d: 19, kicker: 'Sports Page', title: 'Louis–Conn on Television',
      text: '"He can run, but he can\'t hide," Joe Louis said, and he was right: Louis knocks out Billy Conn in the rematch at Yankee Stadium. A few thousand people with television sets in a handful of Eastern cities watch it live. Something is starting.',
      archive: 'The June 19, 1946 rematch is often called the first televised heavyweight title fight. Very few homes had TV sets yet, so many viewers watched in bars.',
    },
    {
      id: 'h_jackie', y: 1947, m: 3, d: 15, kicker: 'Sports Page', title: 'Robinson Takes the Field',
      text: 'Jackie Robinson plays first base for the Brooklyn Dodgers, the first Black player in the modern major leagues. Deacon Tate reads the box score twice. "Baseball," he says. "Now let\'s see about boxing\'s champions."',
      archive: 'Robinson broke Major League Baseball\'s color line on April 15, 1947. Boxing had Black champions before baseball integrated, but many Black contenders were still avoided by white champions and their managers.',
      choices: [
        { label: 'Take Deacon to Ebbets Field', hint: 'Costs money, builds a friendship', req: (s) => s.money >= 20, go: (x) => { x.money(-5); x.heart(6); x.flag('tate_friend'); return 'Robinson steals second. Deacon stands up and doesn\'t sit down for an inning.'; } },
        { label: 'Listen on the radio', go: (x) => { x.heart(2); return 'The broadcaster says "Robinson" like it is any other name. That is the point.'; } },
      ],
    },
    {
      id: 'h_9981', y: 1948, m: 6, d: 26, kicker: 'Washington', title: 'The Military Desegregates',
      text: 'President Truman orders equal treatment in the armed forces, ending segregated units. It will take years to happen.',
      archive: 'Executive Order 9981 (July 26, 1948). The Army did not fully integrate until the Korean War.',
    },
    {
      id: 'h_louis_retires', y: 1949, m: 2, d: 1, kicker: 'Sports Page', title: 'Louis Retires; the IBC Takes Over',
      text: 'Joe Louis retires as champion after nearly twelve years. He sells the rights to the top contenders to a new company, the International Boxing Club. The IBC will soon control most title fights in America, and the television money that comes with them.',
      archive: 'The IBC, run by James Norris, dominated boxing in the 1950s. Courts later found it was an illegal monopoly, and it had ties to the mobster Frankie Carbo. Louis, broke and owing back taxes, came back to fight in 1950.',
      choices: [
        { label: 'Meet with the IBC', hint: 'Bigger fights. Strings attached', go: (x) => { x.flag('ibc'); x.fame(2); x.later('ibc_offer', 4, 16); return 'A smiling man in a good suit promises you "consideration." You leave with a cigar you do not smoke.'; } },
        { label: 'Keep your independence', hint: 'Fewer doors open', go: (x) => { x.rep(3); x.flag('independent'); return 'You tell your manager you\'ll make your own way. He sighs like a deflating tire.'; } },
      ],
    },
    {
      id: 'h_tv', y: 1949, m: 9, kicker: 'The Living Room', title: 'Fights on Every Channel',
      text: (s) => `The Gillette Cavalcade of Sports, the Pabst Blue Ribbon Bouts: boxing is on television several nights a week. Fewer than one home in ten has a set this year. By 1955 most will. ${s.retired ? 'You watch from your couch.' : 'Promoters want fighters who look good on a small screen: busy, aggressive, and willing to bleed.'}`,
      archive: 'Boxing was perfect for early TV: one small, bright ring, two people, cheap to film. But free fights at home emptied small boxing clubs. Hundreds closed in the 1950s.',
      choices: (s) => s.retired ? [{ label: 'Change the channel', go: () => 'You land on a cowboy show. Fine.' }] : [
        { label: 'Fight like a TV fighter: busy, aggressive', hint: 'Fame up, health down', go: (x) => { x.flag('tv_style'); x.fame(4); x.stat('def', -1.5); x.stat('pow', 1); return 'Promoters love it. Your corner man winces.'; } },
        { label: 'Stay who you are', go: (x) => { x.heart(3); return 'You are not a show. You are a fighter.'; } },
      ],
    },
    {
      id: 'h_korea', y: 1950, m: 5, d: 25, kicker: 'Extra', title: 'War in Korea',
      text: (s) => `North Korea invades South Korea. American troops are sent under the United Nations flag. ${T.engine.age(s) <= 26 ? 'You are young enough to be called up. You read the draft news closely.' : 'The draft calls up younger men. A kid from your gym gets his notice.'}`,
      archive: 'The Korean War lasted until an armistice in July 1953. About 1.8 million Americans served there; about 36,000 died.',
    },
    {
      id: 'h_marciano', y: 1952, m: 8, d: 23, kicker: 'Sports Page', title: 'Marciano Takes the Heavyweight Crown',
      text: 'Rocky Marciano, a former bricklayer from Brockton, Massachusetts, knocks out Jersey Joe Walcott in the 13th round to become heavyweight champion. Millions watch on theater television.',
      archive: 'Marciano retired in 1956 with a 49–0 record, the only heavyweight champion to retire undefeated.',
    },
    {
      id: 'h_brown', y: 1954, m: 4, d: 17, kicker: 'Extra', title: 'Court Strikes Down School Segregation',
      text: 'In Brown v. Board of Education, the Supreme Court rules unanimously that segregated public schools are unconstitutional. "Separate educational facilities are inherently unequal."',
      archive: 'The ruling overturned the "separate but equal" doctrine of Plessy v. Ferguson (1896) for schools. Many Southern states fought integration for years.',
      choices: (s) => s.fame >= 40 ? [
        { label: 'Speak up for it in the papers', hint: 'Some promoters won\'t like it', go: (x) => { x.rep(8); x.flag('activist'); x.achieve('activist'); x.remember('civil', 'used my name to speak up for civil rights', 3); if (x.chance(0.4)) { x.fame(-3); return 'A Southern promoter cancels a date. A thousand letters come in. Most of them say thank you.'; } x.fame(2); return 'The quote runs in papers across the country.'; } },
        { label: 'Say nothing publicly', go: () => 'Reporters ask. You say you are just a fighter. You are not sure you believe it.' },
      ] : null,
    },
    {
      id: 'h_montgomery', y: 1955, m: 11, d: 5, kicker: 'Montgomery, Ala.', title: 'Bus Boycott Begins',
      text: 'Rosa Parks is arrested for refusing to give up her bus seat. Black residents of Montgomery begin a boycott of the city buses, led by a young minister named Martin Luther King Jr.',
      archive: 'The boycott lasted 381 days and ended when the Supreme Court ruled bus segregation unconstitutional.',
      choices: (s) => s.money >= 200 ? [
        { label: 'Send money to help the boycott carpools', hint: 'Money, reputation', go: (x) => { x.rawMoney(-Math.round(Math.min(x.s.money * 0.2, 1000))); x.rep(6); x.flag('activist'); x.achieve('activist'); x.remember('civil', 'helped pay for the Montgomery bus boycott carpools', 2); return 'A thank-you note arrives on church letterhead.'; } },
        { label: 'Read about it', go: () => 'The boycott is still going a year later. Everybody is talking about it.' },
      ] : null,
    },
    {
      id: 'h_marciano_retires', y: 1956, m: 3, d: 27, kicker: 'Sports Page', title: 'Marciano Retires Unbeaten',
      text: (s) => `Rocky Marciano walks away at 32 with a perfect 49–0 record. ${T.engine.age(s) > 32 && !s.retired ? 'You are older than he is. Your trainer leaves the clipping on your stool without a word.' : 'Nobody quits on top. He just did.'}`,
      archive: 'Marciano said he wanted to spend time with his family. He never fought again.',
      choices: (s) => !s.retired && T.engine.age(s) >= 32 ? [
        { label: 'Think about walking away too', hint: 'Opens retirement', go: (x) => { x.flag('thinking_retire'); return 'You read it twice. Then a third time.'; } },
        { label: 'Crumple it up', hint: 'Heart', go: (x) => { x.heart(3); return 'You have more fights in you. Probably.'; } },
      ] : null,
    },
    {
      id: 'h_sputnik', y: 1957, m: 9, d: 4, kicker: 'Extra', title: 'SPUTNIK',
      text: 'The Soviet Union launches the first satellite into orbit. You can hear its radio beeps on a shortwave set. Suddenly every school in America wants more science.',
      archive: 'Sputnik set off the Space Race and led to the National Defense Education Act of 1958.',
    },
    {
      id: 'h_ibc_ruling', y: 1959, m: 0, d: 12, kicker: 'Washington', title: 'Supreme Court Breaks Up the IBC',
      text: 'The Supreme Court rules that the International Boxing Club is an illegal monopoly and must be broken up. Everyone in boxing knew who really ran things. Now it is in the law books.',
      archive: 'International Boxing Club v. United States (1959) upheld a lower court\'s antitrust ruling against Norris\'s IBC.',
      go: (x) => { if (x.has('ibc')) { x.note('Your old IBC contacts stop returning calls.', 'world'); } return ''; },
    },
    {
      id: 'h_clay', y: 1960, m: 8, d: 5, kicker: 'Rome', title: 'An 18-Year-Old from Louisville',
      text: 'A brash 18-year-old from Louisville named Cassius Clay wins the Olympic gold medal in Rome as a light heavyweight. He talks almost as fast as he moves.',
      archive: 'Clay turned pro that fall. In 1964 he beat Sonny Liston for the heavyweight title and announced he had joined the Nation of Islam. He became Muhammad Ali.',
    },
    {
      id: 'h_kefauver', y: 1960, m: 11, d: 5, kicker: 'Washington', title: 'The Senate Investigates Boxing',
      text: (s) => `A Senate subcommittee led by Estes Kefauver opens hearings on organized crime in boxing. Fighters testify about fixed fights, stolen purses, and the man they called "the commissioner": Frankie Carbo. ${s.flags.ever_crooked ? 'A Senate investigator calls your house. They have your name.' : ''}`,
      archive: 'The hearings exposed decades of mob control. Carbo was convicted in 1961 of conspiracy and extortion and sent to federal prison.',
      choices: (s) => s.flags.ever_crooked ? [
        { label: 'Testify and tell the truth', hint: 'Reputation, maybe trouble', go: (x) => { x.rep(15); x.fame(5); x.remember('scandal', 'told the Senate the truth about the fight I threw', 3); return 'Under the lights, you tell them about the envelope. Afterward, a reporter shakes your hand. Somebody else follows your car home.'; } },
        { label: 'Take the Fifth', go: (x) => { x.rep(-10); x.remember('scandal', 'took the Fifth when the Senate asked about the mob', 2); return '"I decline to answer on the grounds that it may tend to incriminate me." It is on the front page anyway.'; } },
      ] : null,
    },
    {
      id: 'h_clay_liston', y: 1964, m: 1, d: 25, kicker: 'Miami Beach', title: 'Clay Shocks Liston',
      text: 'Cassius Clay, a 7-to-1 underdog, beats Sonny Liston for the heavyweight title. "I shook up the world!" Within weeks he has a new name: Muhammad Ali. You watch an old sport turn into a new one.',
      archive: 'Ali became the most famous athlete in the world, and one of the most controversial, when he refused to be drafted for the Vietnam War in 1967.',
      link: { href: '/hubs/bts-whats-my-name.html', label: "Open the StoryHub: What's My Name" },
    },
  ];
  T.historyById = (id) => H.find((h) => h.id === id);
  void D;
})(globalThis.TOT = globalThis.TOT || {});
