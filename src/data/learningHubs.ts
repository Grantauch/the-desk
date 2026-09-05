export interface HubTimelineEvent {
  date: string;
  label: string;
  detail: string;
}

export interface HubTerm {
  term: string;
  definition: string;
}

export interface HubIdea {
  heading: string;
  body: string;
}

export interface HubDecision {
  setup: string;
  prompt: string;
  options: { label: string; feedback: string }[];
}

export interface LearningUnit {
  slug: string;
  title: string;
  period: string;
  icon: string;
  deck: string;
  essentialQuestion: string;
  overview: string[];
  ideas: HubIdea[];
  timeline: HubTimelineEvent[];
  terms: HubTerm[];
  decision: HubDecision;
  misconception: string;
  quizDistractors: [string, string];
}

export interface LearningCourse {
  slug: string;
  title: string;
  shortTitle: string;
  label: string;
  color: string;
  softColor: string;
  description: string;
  units: LearningUnit[];
}

export const learningCourses: LearningCourse[] = [
  {
    slug: 'us-history',
    title: 'US History',
    shortTitle: 'US History',
    label: 'the american story lab',
    color: '#1f2ce6',
    softColor: '#eef0ff',
    description: 'Ten interactive chapters from Reconstruction to the world students live in now.',
    units: [
      {
        slug: 'reconstruction',
        title: 'Reconstruction',
        period: '1865–1877',
        icon: '🧱',
        deck: 'The war ended. The argument over freedom had only begun.',
        essentialQuestion: 'Could the United States rebuild the South and make emancipation real at the same time?',
        overview: [
          'Reconstruction was the national attempt to reunite the country, rebuild the former Confederacy, and define what freedom meant after slavery. Formerly enslaved people searched for family, founded schools and churches, negotiated wages, bought land when they could, and entered politics. Their choices—not just decisions in Washington—drove the era.',
          'The 13th, 14th, and 15th Amendments ended slavery, established birthright citizenship and equal protection, and barred racial discrimination in voting. But federal commitment weakened while white supremacist violence grew. By 1877, “home rule” returned to white Southern governments, opening the way to Jim Crow. Reconstruction changed the Constitution permanently, even as many of its promises went unenforced for generations.',
        ],
        ideas: [
          { heading: 'Freedom had a floor plan', body: 'Legal freedom mattered, but people also needed land, safe labor, family reunification, education, and political power. The Freedmen’s Bureau helped in some places, yet land redistribution mostly failed.' },
          { heading: 'The Constitution was rewritten', body: 'The Reconstruction Amendments expanded federal responsibility for civil rights. Later movements would use their language to challenge segregation and voter suppression.' },
          { heading: 'Retreat was a choice', body: 'Terror groups, court decisions, economic coercion, and declining Northern commitment narrowed Black freedom. The end of Reconstruction was political, not automatic.' },
        ],
        timeline: [
          { date: '1865', label: '13th Amendment', detail: 'Slavery is abolished, except as punishment for a crime.' },
          { date: '1868', label: '14th Amendment', detail: 'Citizenship and equal protection become constitutional guarantees.' },
          { date: '1870', label: '15th Amendment', detail: 'Racial discrimination in voting is barred, though enforcement remains contested.' },
          { date: '1877', label: 'Reconstruction retreats', detail: 'Federal troops leave the South and white “home rule” governments consolidate power.' },
        ],
        terms: [
          { term: 'Freedmen’s Bureau', definition: 'A federal agency that assisted formerly enslaved people and poor Southerners with schools, labor contracts, food, and legal help.' },
          { term: 'sharecropping', definition: 'A labor system in which a farmer paid rent with a share of the crop, often creating cycles of debt.' },
          { term: 'equal protection', definition: 'The 14th Amendment promise that states must apply the law equally to people within their jurisdiction.' },
          { term: 'Jim Crow', definition: 'The system of laws and violence that enforced racial segregation and Black political exclusion after Reconstruction.' },
        ],
        decision: {
          setup: 'It is 1866. You advise Congress while Southern states pass Black Codes restricting movement, labor, and legal rights.',
          prompt: 'Which move gives freedom the strongest foundation?',
          options: [
            { label: 'Protect civil rights with federal law', feedback: 'This attacks the Black Codes directly and makes citizenship a national responsibility. The Civil Rights Act of 1866 moved in this direction.' },
            { label: 'Leave the issue entirely to each state', feedback: 'That restores local control quickly, but it also leaves newly freed people under governments already restricting their freedom.' },
            { label: 'Focus only on rebuilding roads and farms', feedback: 'Economic recovery matters, but infrastructure alone cannot protect voting, contracts, families, or physical safety.' },
          ],
        },
        misconception: 'Reconstruction was only a failed rebuilding program with little lasting impact.',
        quizDistractors: [
          'The Reconstruction Amendments settled civil-rights enforcement permanently, so later federal action was unnecessary.',
          'Reconstruction ended because Southern political violence and resistance had already disappeared by 1877.',
        ],
      },
      {
        slug: 'the-gilded-age',
        title: 'The Gilded Age',
        period: '1870–1900',
        icon: '🚂',
        deck: 'America got richer, faster—and the bill was not divided evenly.',
        essentialQuestion: 'When does rapid economic growth count as progress, and who gets to decide?',
        overview: [
          'Railroads stitched together a national market while steel, oil, finance, and mass production created fortunes on a scale Americans had never seen. Cities swelled with migrants from farms and immigrants from around the world. The same networks that delivered goods and opportunity also concentrated power in a small number of corporations.',
          'Workers organized because long hours, dangerous conditions, low wages, and sudden layoffs were ordinary parts of industrial life. Farmers fought railroad rates and tight money. Native nations faced military conquest and land loss as settlement accelerated in the West. “Gilded” means a thin layer of gold over cheaper metal: the name asks students to examine both the shine and what sat underneath it.',
        ],
        ideas: [
          { heading: 'Scale changed the rules', body: 'National rail and communication networks made giant corporations possible. Their size lowered costs but also made competition and regulation harder.' },
          { heading: 'Labor became a public fight', body: 'The Great Railroad Strike, Haymarket, Homestead, and Pullman showed that wage disputes could become national political crises.' },
          { heading: 'Growth had borders', body: 'Expansion created new markets and farms while dispossessing Native peoples. Immigration powered cities even as nativist laws narrowed who could enter.' },
        ],
        timeline: [
          { date: '1869', label: 'Transcontinental railroad', detail: 'Rail lines meet at Promontory Summit, accelerating a national market and western settlement.' },
          { date: '1877', label: 'Great Railroad Strike', detail: 'A wage dispute spreads across the country and is suppressed by state and federal force.' },
          { date: '1882', label: 'Chinese Exclusion Act', detail: 'Federal law blocks Chinese labor immigration and makes race a gate in national immigration policy.' },
          { date: '1892', label: 'Homestead Strike', detail: 'Steelworkers battle private guards; the union suffers a major defeat.' },
        ],
        terms: [
          { term: 'vertical integration', definition: 'A company controls multiple stages of production, from raw materials through distribution.' },
          { term: 'monopoly', definition: 'A company or group controls nearly all of a market, weakening competition.' },
          { term: 'collective bargaining', definition: 'Workers negotiate pay and conditions as a group, usually through a union.' },
          { term: 'Populism', definition: 'A political movement that organized farmers and workers against concentrated economic and political power.' },
        ],
        decision: {
          setup: 'You are a newspaper editor in a railroad town. A strike has stopped trains, mail, and food shipments. Workers say wage cuts leave them no choice.',
          prompt: 'What should your front-page editorial demand?',
          options: [
            { label: 'Mediation and bargaining', feedback: 'This treats the conflict as a dispute between groups with legitimate interests and seeks a negotiated settlement.' },
            { label: 'Send troops immediately', feedback: 'This may restart traffic quickly, but it uses public power on management’s side and can turn a strike violent.' },
            { label: 'Let the company decide everything', feedback: 'Owners control the property, but their decisions affect an entire town. That is exactly why industrial conflicts became political.' },
          ],
        },
        misconception: 'Industrial growth improved life equally for owners, workers, immigrants, farmers, and Native nations.',
        quizDistractors: [
          'National rail and communication networks kept corporations small and prevented economic power from concentrating.',
          'Industrial labor disputes remained private local matters because government and courts rarely became involved.',
        ],
      },
      {
        slug: 'progressive-era-and-empire',
        title: 'The Progressive Era & Empire',
        period: '1890–1920',
        icon: '🔎',
        deck: 'Reform at home. Expansion abroad. Plenty of contradictions in between.',
        essentialQuestion: 'Who counted in the Progressive promise to make government work for the public?',
        overview: [
          'Progressives believed industrial America’s problems could be studied, exposed, and fixed. Journalists revealed unsafe food, political corruption, and brutal working conditions. Activists pushed direct democracy, conservation, antitrust action, settlement houses, and women’s suffrage. Government gained new tools to regulate the economy and protect consumers.',
          'Reform had sharp limits. Many Progressives accepted segregation, eugenics, or immigration restriction. Abroad, the Spanish-American War brought the United States an overseas empire and a debate over whether ruling other peoples contradicted American self-government. At home, Black leaders built organizations to fight lynching and Jim Crow while the Great Migration began reshaping Northern cities.',
        ],
        ideas: [
          { heading: 'Exposure became a weapon', body: 'Muckrakers connected vivid stories to reform campaigns. Information mattered most when organizations turned it into pressure and law.' },
          { heading: 'Government learned new jobs', body: 'Food inspection, railroad regulation, conservation, and antitrust enforcement expanded what citizens expected public institutions to do.' },
          { heading: 'Reform and exclusion coexisted', body: 'A movement could democratize elections while ignoring or strengthening racial injustice. Progress must be measured by who received it.' },
        ],
        timeline: [
          { date: '1898', label: 'Spanish-American War', detail: 'A short war leaves the United States controlling former Spanish territories.' },
          { date: '1906', label: 'Pure Food and Drug Act', detail: 'Federal law targets mislabeled and unsafe food and medicine.' },
          { date: '1909', label: 'NAACP founded', detail: 'An interracial organization forms to challenge racial violence and discrimination.' },
          { date: '1920', label: '19th Amendment', detail: 'The Constitution bars voting discrimination based on sex, though other barriers remain.' },
        ],
        terms: [
          { term: 'muckraker', definition: 'A journalist who investigated corruption, unsafe conditions, or concentrated power during the Progressive Era.' },
          { term: 'trust-busting', definition: 'Government action to regulate or break up corporate combinations that limit competition.' },
          { term: 'imperialism', definition: 'Extending a nation’s power over other places through political, military, or economic control.' },
          { term: 'suffrage', definition: 'The right to vote.' },
        ],
        decision: {
          setup: 'A reform coalition can spend its limited money on one campaign first: food safety, voting reform, or an anti-lynching law.',
          prompt: 'How do you choose without pretending the other problems do not matter?',
          options: [
            { label: 'Target the harm with the fewest protections', feedback: 'This centers urgency and people most exposed to violence, while requiring a plan to keep the broader coalition together.' },
            { label: 'Pick the easiest win', feedback: 'A quick victory can build momentum, but it may also keep the most politically difficult injustice off the agenda.' },
            { label: 'Refuse to prioritize anything', feedback: 'Treating every problem as equally first can sound fair, but limited time and votes still force choices—often silently.' },
          ],
        },
        misconception: 'Progressive reform automatically expanded rights and opportunity for every American.',
        quizDistractors: [
          'Progressive reform focused only on elections and left food safety, corporations, and working conditions untouched.',
          'American expansion overseas ended the debate over whether empire conflicted with democratic self-government.',
        ],
      },
      {
        slug: 'wwi-and-the-twenties',
        title: 'WWI & the Twenties',
        period: '1914–1929',
        icon: '📻',
        deck: 'A world war remade federal power; mass culture turned up the volume.',
        essentialQuestion: 'Did the 1920s represent a break with the past—or old conflicts in modern packaging?',
        overview: [
          'The United States entered World War I in 1917 after years of neutrality. Mobilization brought federal management of industry, mass propaganda, conscription, and restrictions on dissent. The war ended quickly for Americans, but disputes over the peace treaty and the League of Nations revealed how divided the country remained about its world role.',
          'Cars, radios, movies, advertising, installment credit, and rising productivity created the first national mass culture. Jazz and the Harlem Renaissance transformed American art, while the Great Migration shifted political and cultural power. Prohibition encouraged both reform and organized crime. Immigration quotas and the reborn Ku Klux Klan exposed a fierce backlash against social change.',
        ],
        ideas: [
          { heading: 'War expanded the state', body: 'Mobilization reached factories, farms, speech, and everyday consumption. Civil-liberties cases from the era asked how much dissent a democracy tolerates during war.' },
          { heading: 'Mass culture linked strangers', body: 'Radio, movies, sports, and national brands let millions consume the same stories, sounds, and products at nearly the same time.' },
          { heading: 'Modernity produced backlash', body: 'New freedom for some existed alongside racial terror, immigration restriction, fundamentalist reaction, and revived nativism.' },
        ],
        timeline: [
          { date: '1917', label: 'United States enters WWI', detail: 'Congress declares war on Germany; mobilization reshapes government and society.' },
          { date: '1919', label: 'Red Summer', detail: 'Racial violence erupts in cities across the nation amid labor and migration tensions.' },
          { date: '1920', label: 'Radio boom begins', detail: 'Commercial broadcasting helps create a shared national culture.' },
          { date: '1924', label: 'Immigration quotas', detail: 'Federal law sharply restricts immigration and favors northern and western Europe.' },
        ],
        terms: [
          { term: 'propaganda', definition: 'Communication designed to shape attitudes or behavior, often by selecting emotional facts and symbols.' },
          { term: 'Great Migration', definition: 'The movement of millions of Black Americans from the South to Northern, Midwestern, and Western cities.' },
          { term: 'installment credit', definition: 'Buying now and paying over time in scheduled amounts.' },
          { term: 'nativism', definition: 'The belief that native-born residents should be favored over immigrants, often tied to racial or religious prejudice.' },
        ],
        decision: {
          setup: 'It is 1918. A speaker publicly criticizes the draft while the government argues that antiwar speech harms military recruitment.',
          prompt: 'Where should a democracy draw the line?',
          options: [
            { label: 'Protect criticism unless it directly causes harm', feedback: 'This sets a high bar for censorship and treats debate as a democratic strength, even during war.' },
            { label: 'Ban all antiwar speech until peace', feedback: 'This prioritizes unity and mobilization, but gives government broad power to label disagreement dangerous.' },
            { label: 'Let local officials decide case by case', feedback: 'Flexibility can reflect local conditions, yet it also produces unequal rights and invites political abuse.' },
          ],
        },
        misconception: 'The 1920s roared in the same way for every group and every region.',
        quizDistractors: [
          'World War I reduced federal power over industry, speech, and everyday life once the United States entered the war.',
          'Mass culture eliminated nativism and racial backlash by giving Americans the same entertainment and products.',
        ],
      },
      {
        slug: 'depression-and-the-new-deal',
        title: 'Depression & the New Deal',
        period: '1929–1941',
        icon: '🏗️',
        deck: 'When the economy collapsed, Americans renegotiated what government owed the public.',
        essentialQuestion: 'How much responsibility should the federal government take for economic security?',
        overview: [
          'The stock market crash did not single-handedly cause the Great Depression. Bank failures, weak demand, unequal wealth, debt, international instability, and policy mistakes turned recession into catastrophe. Unemployment and homelessness spread while drought and soil erosion devastated the Great Plains. Families survived through mutual aid, migration, improvisation, and protest.',
          'Franklin Roosevelt’s New Deal used federal power for relief, recovery, and reform. Work programs hired millions; banking rules restored confidence; Social Security created a safety net; labor law strengthened unions. Critics argued the programs went too far or not nearly far enough. The New Deal did not end the Depression by itself, but it permanently changed the relationship between citizens and the federal government.',
        ],
        ideas: [
          { heading: 'The crash was a trigger, not the whole cause', body: 'A fragile financial system and collapsing demand allowed one crisis to spread through banks, businesses, farms, and the world economy.' },
          { heading: 'Relief, recovery, reform', body: 'New Deal agencies tried to meet immediate need, restart economic activity, and change the rules to prevent another collapse.' },
          { heading: 'The safety net had holes', body: 'Domestic and agricultural workers were excluded from key protections at first, disproportionately affecting Black and Mexican American workers.' },
        ],
        timeline: [
          { date: '1929', label: 'Stock market crash', detail: 'The market plunges; a broader economic collapse deepens afterward.' },
          { date: '1933', label: 'First Hundred Days', detail: 'Congress and FDR launch banking, relief, farm, and recovery programs at extraordinary speed.' },
          { date: '1935', label: 'Social Security Act', detail: 'Federal old-age pensions and unemployment insurance create a lasting safety net.' },
          { date: '1937', label: 'Recession within the Depression', detail: 'A sharp downturn shows recovery is still fragile.' },
        ],
        terms: [
          { term: 'bank run', definition: 'Many depositors demand their money at once, which can collapse a bank that has lent much of it out.' },
          { term: 'relief', definition: 'Immediate help for people in need, such as jobs, food, or cash assistance.' },
          { term: 'safety net', definition: 'Public programs designed to protect people from severe economic hardship.' },
          { term: 'collective bargaining', definition: 'Negotiation between workers acting together and an employer over wages and conditions.' },
        ],
        decision: {
          setup: 'In 1933, millions need help now, banks are failing, and Congress has limited time. Every program risks waste, delay, or unintended effects.',
          prompt: 'What should receive the first major push?',
          options: [
            { label: 'Stabilize banks and hire people directly', feedback: 'This combines confidence in the financial system with immediate purchasing power for families.' },
            { label: 'Wait for prices and wages to adjust', feedback: 'This avoids new federal power, but asks families to endure a crisis that has already fed on delay and collapsing demand.' },
            { label: 'Give aid only through private charities', feedback: 'Local knowledge can help, but charities were overwhelmed by the national scale of unemployment.' },
          ],
        },
        misconception: 'The stock market crash alone caused the Depression, and the New Deal alone ended it.',
        quizDistractors: [
          'New Deal programs dealt only with immediate relief and did not create lasting banking, labor, or safety-net reforms.',
          'The Depression affected banks and investors but left farming communities and wage workers largely untouched.',
        ],
      },
      {
        slug: 'world-war-ii',
        title: 'World War II',
        period: '1933–1945',
        icon: '🌍',
        deck: 'A total war mobilized whole societies—and forced choices that still resist easy verdicts.',
        essentialQuestion: 'How should a democracy balance military necessity, rights, and human cost in total war?',
        overview: [
          'The United States debated neutrality while fascist powers expanded across Europe and Asia. Japan’s attack on Pearl Harbor ended that debate. American industry became the “arsenal of democracy,” producing ships, planes, vehicles, and weapons at stunning speed. Women and Black workers entered new jobs, while rationing, migration, and military service transformed daily life.',
          'Allied victory required a global war in Europe, North Africa, the Atlantic, and the Pacific. The conflict also exposed contradictions at home: Japanese Americans were incarcerated without individual trials, and a segregated military fought regimes built on racial hierarchy. The Holocaust revealed industrialized genocide. Atomic bombs ended the Pacific war amid arguments about invasion, surrender, Soviet entry, and civilian death that continue today.',
        ],
        ideas: [
          { heading: 'Production was strategy', body: 'Factories, logistics, science, and labor were as essential as battlefield victories. Michigan’s auto industry became a center of war production.' },
          { heading: 'Rights narrowed under fear', body: 'Executive Order 9066 enabled mass removal and incarceration based on ancestry, showing how wartime claims can overwhelm constitutional protections.' },
          { heading: 'Victory did not simplify morality', body: 'Defeating fascism was necessary; strategic bombing, alliance choices, and atomic weapons still require evidence-based ethical judgment.' },
        ],
        timeline: [
          { date: '1941', label: 'Pearl Harbor', detail: 'Japan attacks the U.S. Pacific Fleet; the United States enters the war.' },
          { date: '1942', label: 'Executive Order 9066', detail: 'The government removes and incarcerates Japanese Americans from the West Coast.' },
          { date: '1944', label: 'D-Day', detail: 'Allied forces land in Normandy and open a major western front in Europe.' },
          { date: '1945', label: 'War ends', detail: 'Germany surrenders in May; Japan surrenders after atomic bombings and Soviet entry into the Pacific war.' },
        ],
        terms: [
          { term: 'total war', definition: 'A conflict that mobilizes civilian economies, information, and populations as well as armed forces.' },
          { term: 'rationing', definition: 'Government limits on civilian consumption so scarce goods can support the war effort.' },
          { term: 'incarceration', definition: 'Confinement; the accurate term for the forced imprisonment of Japanese Americans during WWII.' },
          { term: 'genocide', definition: 'The deliberate attempt to destroy a national, ethnic, racial, or religious group.' },
        ],
        decision: {
          setup: 'You advise the president in summer 1945. Japan is badly weakened but has not accepted unconditional surrender. Invasion, blockade, demonstration, altered terms, and atomic attack all carry risks.',
          prompt: 'What evidence must be weighed before choosing?',
          options: [
            { label: 'Compare every option and its likely human cost', feedback: 'Strong historical judgment compares realistic alternatives, uncertainty, military estimates, diplomacy, and civilian harm—not just the result we know.' },
            { label: 'Use the weapon because it exists', feedback: 'Capability is not the same as necessity. This skips alternatives, surrender terms, and the moral weight of civilian targets.' },
            { label: 'Judge only with information learned after the war', feedback: 'Later evidence matters, but decision-makers must also be evaluated within what they could reasonably know at the time.' },
          ],
        },
        misconception: 'The home front was united and equal because the nation shared one enemy.',
        quizDistractors: [
          'Wartime production expanded without changing women\'s work, migration, or the federal role in the economy.',
          'Military necessity made the incarceration of Japanese Americans an individualized process with full court trials.',
        ],
      },
      {
        slug: 'cold-war-america',
        title: 'Cold War America',
        period: '1945–1964',
        icon: '☢️',
        deck: 'Two superpowers avoided direct war by making nearly everywhere else part of the contest.',
        essentialQuestion: 'Did containment make the United States safer, or trap it in an endless series of risks?',
        overview: [
          'After WWII, the United States and Soviet Union emerged as rival superpowers with opposing political and economic systems. Containment aimed to block further Soviet influence through aid, alliances, military force, and covert action. The Cold War stayed “cold” between the superpowers, but Korea, Vietnam, coups, and proxy wars made it deadly elsewhere.',
          'At home, fear of communism fueled loyalty programs and McCarthyism. Prosperity, suburbanization, the Baby Boom, television, and mass higher education reshaped daily life, though redlining and discrimination distributed those gains unequally. Nuclear weapons made annihilation a daily possibility, while Sputnik and the space race turned science and schools into national-security concerns.',
        ],
        ideas: [
          { heading: 'Containment was many policies', body: 'The Marshall Plan used money, NATO used alliances, and Korea used military force. A simple word produced very different actions.' },
          { heading: 'Fear changed civil life', body: 'Real espionage existed, but accusation often outran evidence. Careers and rights could disappear through association and spectacle.' },
          { heading: 'Prosperity was structured', body: 'Federal loans, highways, and education programs expanded opportunity while discriminatory policy blocked many families from the same benefits.' },
        ],
        timeline: [
          { date: '1947', label: 'Truman Doctrine', detail: 'The president frames aid to Greece and Turkey as part of a global struggle against communism.' },
          { date: '1950', label: 'Korean War begins', detail: 'Containment becomes a major shooting war under United Nations command.' },
          { date: '1957', label: 'Sputnik launched', detail: 'A Soviet satellite intensifies the space race and U.S. investment in science education.' },
          { date: '1962', label: 'Cuban Missile Crisis', detail: 'The superpowers approach nuclear war, then negotiate a withdrawal of missiles.' },
        ],
        terms: [
          { term: 'containment', definition: 'The strategy of preventing the expansion of Soviet influence and communism.' },
          { term: 'proxy war', definition: 'A conflict in which larger powers support different sides instead of fighting each other directly.' },
          { term: 'McCarthyism', definition: 'Accusation and punishment for alleged disloyalty, often with weak evidence and little due process.' },
          { term: 'mutual assured destruction', definition: 'The idea that both nuclear powers could destroy each other even after being attacked, deterring a first strike.' },
        ],
        decision: {
          setup: 'A new nation faces a communist insurgency. Its government is friendly to the United States but corrupt and unpopular.',
          prompt: 'What should containment require?',
          options: [
            { label: 'Tie support to reforms and public legitimacy', feedback: 'This recognizes that military aid cannot permanently substitute for a government people trust.' },
            { label: 'Support any anti-communist government', feedback: 'This may block a rival quickly, but it can attach the United States to repression and deepen the rebellion.' },
            { label: 'Treat every local conflict as controlled by Moscow', feedback: 'Some movements received Soviet support, but local nationalism, poverty, and colonial history had causes of their own.' },
          ],
        },
        misconception: 'Every Cold War conflict was simply the United States fighting the Soviet Union in a different location.',
        quizDistractors: [
          'Nuclear weapons made proxy wars, alliances, propaganda, and domestic anticommunism less important.',
          'Postwar prosperity reached all Americans equally and ended disputes over race, class, and gender at home.',
        ],
      },
      {
        slug: 'the-civil-rights-movement',
        title: 'Civil Rights & the Soundtrack of a Movement',
        period: '1941–1975',
        icon: '✊🏾🎸',
        deck: 'Organized people turned moral claims into political pressure—while music carried, sold, and sometimes obscured the struggle.',
        essentialQuestion: 'How did ordinary people turn constitutional promises into enforceable power—and who controlled the soundtrack?',
        overview: [
          'The modern Civil Rights Movement grew from generations of organizing, litigation, journalism, institution-building, and resistance. Brown v. Board attacked legal segregation in schools, but court decisions needed enforcement. The Montgomery Bus Boycott, sit-ins, Freedom Rides, Birmingham campaign, and voter drives used disciplined nonviolence to expose injustice and disrupt ordinary systems.',
          'Federal laws in 1964 and 1965 were landmark victories, not the end of the story. Activists debated pace, tactics, self-defense, economic justice, Black Power, and the movement’s direction outside the South. Housing segregation, policing, jobs, and unequal schools made clear that changing law and changing lived conditions were connected but different tasks.',
          'Rock and roll grew from overlapping Black and white musical traditions, but authorship, radio access, touring, publishing, promotion, and profit were not distributed equally. Sister Rosetta Tharpe, crossover cover records, Motown, and movement songs let us ask three recurring questions: Who made it? Who made money? Who made history?',
        ],
        ideas: [
          { heading: 'Strategy made courage effective', body: 'Boycotts, lawsuits, direct action, media attention, and voter registration worked together. Events that looked spontaneous were usually organized.' },
          { heading: 'Federal power mattered', body: 'Courts and Congress created legal tools, while presidents sometimes enforced them. Movements forced national institutions to act.' },
          { heading: 'The movement had arguments inside it', body: 'Nonviolence, self-defense, integration, nationalism, and economic justice were serious strategic debates, not a simple split between good and bad actors.' },
          { heading: 'Culture moved through institutions', body: 'A song could cross boundaries while record labels, publishers, radio, television, retail, and segregated venues controlled whose version reached the largest audience.' },
          { heading: 'Detroit connects movement and music', body: 'Motown paired Black ownership and integrated creative work with a deliberate crossover strategy. Detroit 1967 showed that market success did not erase conflict over housing, policing, schools, jobs, or power.' },
        ],
        timeline: [
          { date: '1954', label: 'Brown v. Board', detail: 'The Supreme Court rules segregated public schools unconstitutional.' },
          { date: '1955', label: 'Montgomery Bus Boycott', detail: 'A year-long campaign uses collective economic pressure to challenge segregation.' },
          { date: '1959', label: 'Motown founded', detail: 'Berry Gordy builds a Black-owned Detroit company with an integrated production and artist-development system.' },
          { date: '1964', label: 'Civil Rights Act', detail: 'Federal law attacks segregation and discrimination in public accommodations and employment.' },
          { date: '1965', label: 'Voting Rights Act', detail: 'Federal enforcement targets racial barriers to voting.' },
          { date: '1967', label: 'Detroit uprising', detail: 'A police raid triggers five days of conflict rooted in policing, housing, jobs, and segregation.' },
        ],
        terms: [
          { term: 'direct action', definition: 'Public action—such as a boycott, sit-in, or march—that creates pressure rather than waiting for officials to act.' },
          { term: 'civil disobedience', definition: 'Open, nonviolent violation of an unjust rule, paired with acceptance of legal consequences to expose the injustice.' },
          { term: 'federalism', definition: 'The division of power between national and state governments.' },
          { term: 'Black Power', definition: 'A broad call for Black political, economic, and cultural self-determination.' },
          { term: 'crossover', definition: 'Music reaching an audience or market category from which the artist’s community had often been segregated.' },
          { term: 'appropriation', definition: 'Taking cultural work from a community, especially when credit, control, access, or profit flows elsewhere.' },
        ],
        decision: {
          setup: 'Your class is curating one museum label about rock and civil rights. A hit record crossed racial markets, but the original artist, cover artist, label, publisher, radio stations, venues, and audiences did not have equal power.',
          prompt: 'Which label turns the song into responsible historical evidence?',
          options: [
            { label: 'Connect creator, sound, industry system, audience, money, and civil-rights context', feedback: 'This treats the recording as evidence inside a network. It can explain both cultural exchange and unequal access without pretending either cancels the other.' },
            { label: 'Declare that the most famous version invented the genre', feedback: 'Fame measures reach, not invention. Genres develop through networks of performers, communities, technologies, venues, and earlier recordings.' },
            { label: 'Say the music integrated America, so legal and economic conflict no longer mattered', feedback: 'Integrated audiences could matter, but market crossover did not end segregation, discrimination, or struggles over ownership and power.' },
          ],
        },
        misconception: 'The movement was a single Southern campaign led by a few famous men, while rock and roll naturally erased racial barriers on its own.',
        quizDistractors: [
          'Federal civil-rights laws appeared before sustained local organizing, legal challenges, and direct action created pressure.',
          'A record reaching an integrated audience proves that its creators received equal credit, control, promotion, and profit.',
        ],
      },
      {
        slug: 'vietnam-to-watergate',
        title: 'Vietnam to Watergate',
        period: '1964–1977',
        icon: '📺',
        deck: 'The credibility gap widened until official words could no longer carry their own weight.',
        essentialQuestion: 'What happens to democratic government when leaders repeatedly hide the costs and limits of policy?',
        overview: [
          'U.S. involvement in Vietnam escalated after the Gulf of Tonkin Resolution gave President Johnson broad authority. Officials measured progress through statistics while the war’s political foundations weakened. The draft, mounting casualties, television coverage, and the Tet Offensive intensified public opposition. The Pentagon Papers later showed that administrations had privately doubted claims they made publicly.',
          'Watergate began with a burglary at Democratic Party offices and grew through investigative reporting, congressional hearings, secret tapes, and obstruction of justice. President Nixon resigned when evidence erased his political support. Together, Vietnam and Watergate deepened distrust in government. The 1970s added oil shocks and stagflation, making national confidence harder to recover.',
        ],
        ideas: [
          { heading: 'Metrics can hide strategy', body: 'Body counts and bombing totals measured activity, not whether a stable political outcome was becoming more likely.' },
          { heading: 'A free press needs corroboration', body: 'Documents, multiple sources, public hearings, and tapes transformed allegations into evidence the public could evaluate.' },
          { heading: 'Institutions need people to use them', body: 'Courts, Congress, journalists, officials, and voters all played roles in limiting presidential power during Watergate.' },
        ],
        timeline: [
          { date: '1964', label: 'Gulf of Tonkin Resolution', detail: 'Congress grants broad authority that supports escalation in Vietnam.' },
          { date: '1968', label: 'Tet Offensive', detail: 'A military setback for communist forces becomes a political shock in the United States.' },
          { date: '1971', label: 'Pentagon Papers published', detail: 'A secret government history reveals years of private doubt and public misdirection.' },
          { date: '1974', label: 'Nixon resigns', detail: 'The president leaves office as tape evidence and impeachment pressure close in.' },
        ],
        terms: [
          { term: 'credibility gap', definition: 'The distance between official claims and what evidence shows to be true.' },
          { term: 'escalation', definition: 'A deliberate increase in the scale or intensity of a conflict.' },
          { term: 'whistleblower', definition: 'A person who reveals wrongdoing or hidden danger inside an organization.' },
          { term: 'obstruction of justice', definition: 'Interfering with an investigation or legal process.' },
        ],
        decision: {
          setup: 'You are a member of Congress. A source offers classified documents showing officials misled the public, but publication could reveal sensitive information.',
          prompt: 'What standard should guide disclosure?',
          options: [
            { label: 'Verify, redact concrete risks, then expose the deception', feedback: 'This balances public accountability with specific—not merely asserted—security harms.' },
            { label: 'Publish everything immediately', feedback: 'Speed may prevent suppression, but it can expose people or operations unrelated to the wrongdoing.' },
            { label: 'Keep everything secret because it is classified', feedback: 'Classification can protect real secrets, but it can also shield embarrassment or misconduct. The label cannot end the inquiry.' },
          ],
        },
        misconception: 'Television by itself turned Americans against the Vietnam War and forced Nixon from office.',
        quizDistractors: [
          'The Vietnam conflict and Watergate followed one simple chain in which public opinion changed for a single reason.',
          'Because Nixon resigned, every accusation made during Watergate was automatically proven by the same evidence.',
        ],
      },
      {
        slug: 'reagan-to-right-now',
        title: 'Reagan to Right Now',
        period: '1980–present',
        icon: '💻',
        deck: 'The recent past is still history—it just has more witnesses and noisier evidence.',
        essentialQuestion: 'Which changes since 1980 most reshaped Americans’ relationship with government, markets, and one another?',
        overview: [
          'Ronald Reagan’s election marked a durable conservative turn toward lower taxes, deregulation, military strength, and skepticism of federal social programs. The Cold War ended unexpectedly as reform inside the Soviet Union, pressure from below, economic strain, and international diplomacy converged. Globalization and deindustrialization then shifted work and community life, especially across the industrial Midwest.',
          'The September 11 attacks transformed foreign policy, surveillance, immigration, and war. The Great Recession exposed financial risk and widened arguments over bailouts and inequality. Digital networks changed commerce, news, identity, and political organizing while making misinformation faster and more personalized. Because this history touches living memory, students must separate strong recollection from representative evidence.',
        ],
        ideas: [
          { heading: 'The conservative turn outlasted one president', body: 'Tax, regulation, courts, unions, and the role of government shifted over decades, even when political control changed parties.' },
          { heading: 'Global systems became local history', body: 'Trade, automation, finance, migration, and war altered factories, neighborhoods, schools, and family choices.' },
          { heading: 'More information did not end gatekeeping', body: 'The internet lowered publishing barriers but gave platforms, algorithms, and networks new power over attention.' },
        ],
        timeline: [
          { date: '1980', label: 'Reagan elected', detail: 'A conservative coalition wins the presidency and reshapes national policy.' },
          { date: '1989', label: 'Berlin Wall opens', detail: 'Communist governments in Eastern Europe collapse; the Cold War approaches its end.' },
          { date: '2001', label: 'September 11 attacks', detail: 'Terrorist attacks kill nearly 3,000 people and launch a new era of war and security policy.' },
          { date: '2008', label: 'Financial crisis', detail: 'Housing and credit collapse trigger the deepest downturn since the Great Depression.' },
        ],
        terms: [
          { term: 'deregulation', definition: 'Reducing or changing government rules that shape business activity.' },
          { term: 'globalization', definition: 'The growing movement of goods, money, information, and work across national borders.' },
          { term: 'deindustrialization', definition: 'The decline of manufacturing employment and industrial capacity in a region.' },
          { term: 'algorithm', definition: 'A set of rules a computer follows; platforms use algorithms to rank what users see.' },
        ],
        decision: {
          setup: 'A viral post about a recent event includes a dramatic video, thousands of shares, and no original source. People you trust disagree about it.',
          prompt: 'What is the historian’s first move?',
          options: [
            { label: 'Trace the video to its earliest verifiable source', feedback: 'Origin, date, location, and missing context come before interpretation. Popularity is not provenance.' },
            { label: 'Believe the version shared by your side', feedback: 'Identity can guide attention, but it cannot authenticate a clip or establish what happened outside the frame.' },
            { label: 'Assume every version is equally uncertain', feedback: 'Healthy skepticism is not permanent suspension. Some claims earn stronger support through evidence.' },
          ],
        },
        misconception: 'Because recent events have video and many witnesses, they are easier to interpret than older history.',
        quizDistractors: [
          'Digital media gives every source the same reach and credibility, so gatekeepers no longer shape public memory.',
          'A recent event needs less sourcing because students can remember it or find many posts about it online.',
        ],
      },
    ],
  },
  {
    slug: 'beyond-the-scoreboard',
    title: 'Beyond the Scoreboard',
    shortTitle: 'Scoreboard',
    label: 'the sports history arena',
    color: '#00895c',
    softColor: '#e8f8f1',
    description: 'Six seasons where sports reveal the business, media, law, and access fights shaping America.',
    units: [
      {
        slug: 'inventing-american-sport',
        title: 'Inventing American Sport',
        period: '1860s–1900',
        icon: '⚾',
        deck: 'Industrial cities did not just host modern sports. They built the conditions that made them possible.',
        essentialQuestion: 'Why did organized professional sports emerge when American cities, factories, and railroads did?',
        overview: [
          'Industrialization concentrated workers and spectators in cities, standardized schedules, and created mass leisure. Railroads let teams travel, telegraphs spread scores, newspapers created heroes, and enclosed grounds turned attention into ticket revenue. Baseball clubs shifted from social organizations to wage-paying businesses, creating new conflicts over player mobility and owner control.',
          'Modern sport also built exclusion into its institutions. Black players competed on integrated teams in the 1880s before white owners and players enforced a color line. Women athletes and competitors in boxing, cycling, and other sports faced rules about respectability as well as access. The unit’s four threads—business, media, law, and who gets to play—begin together.',
        ],
        ideas: [
          { heading: 'Cities created audiences', body: 'Dense populations, set work schedules, transit, and disposable income made regular ticket-buying crowds possible.' },
          { heading: 'Media made games travel', body: 'Newspapers and telegraphs turned local contests into shared stories, statistics, and celebrity reputations.' },
          { heading: 'Rules distributed power', body: 'League membership, contracts, and unwritten racial barriers decided who could earn, move, compete, and belong.' },
        ],
        timeline: [
          { date: '1869', label: 'Cincinnati Red Stockings', detail: 'The club fields a fully paid professional baseball team and tours nationally.' },
          { date: '1876', label: 'National League founded', detail: 'Owners create a more stable business structure for major professional baseball.' },
          { date: '1884', label: 'Walker plays in a major league', detail: 'Moses Fleetwood Walker competes before organized baseball hardens segregation.' },
          { date: '1887', label: 'Color line formalizes', detail: 'White baseball leaders and players move to exclude Black athletes from organized leagues.' },
        ],
        terms: [
          { term: 'professionalism', definition: 'Competing in sport for pay rather than only recreation or status.' },
          { term: 'barnstorming', definition: 'Traveling from town to town to play exhibitions outside a fixed league schedule.' },
          { term: 'color line', definition: 'The written and unwritten system excluding Black athletes from white organized sports.' },
          { term: 'reserve rule', definition: 'A contract rule that let a team keep rights to a player and restrict movement to another club.' },
        ],
        decision: {
          setup: 'You own a baseball club in 1887. Some owners threaten to cancel games if your Black star remains on the roster; fans come to see him play.',
          prompt: 'What does your choice reveal about how a color line gets built?',
          options: [
            { label: 'Keep the player and organize allies', feedback: 'Resistance requires more than private disagreement—it needs collective pressure strong enough to challenge other owners.' },
            { label: 'Release him and call it “business”', feedback: 'Economic pressure is real, but describing the choice as neutral hides how business decisions create racial institutions.' },
            { label: 'Say the league has no written rule', feedback: 'Unwritten rules can be enforced through schedules, contracts, threats, and shared expectations.' },
          ],
        },
        misconception: 'Sports naturally became segregated because teams only reflected the customs around them.',
        quizDistractors: [
          'Standard rules and national organizations developed without conflict over class, race, business, or control.',
          'Once organized sport grew, access expanded automatically because competition rewarded talent alone.',
        ],
      },
      {
        slug: 'the-national-stage',
        title: 'The National Stage',
        period: '1900–1945',
        icon: '📻',
        deck: 'Radio and mass newspapers turned athletes into symbols for arguments much larger than sport.',
        essentialQuestion: 'What happens when a game becomes a national story about race, honor, and belonging?',
        overview: [
          'Jack Johnson’s heavyweight championship provoked a racist search for a “Great White Hope,” showing how a Black athlete’s victory could be treated as a challenge to the social order. After the 1919 Black Sox scandal, baseball owners created a powerful commissioner to restore public trust. The Negro Leagues built major institutions, audiences, and stars behind baseball’s color line.',
          'Radio carried live sport into homes and helped nationalize fan culture. International competition became political theater: Jesse Owens’s success at the Berlin Olympics challenged Nazi racial propaganda, while Joe Louis’s rematch with German boxer Max Schmeling became a symbolic contest on the eve of war. Detroit’s Hank Greenberg also faced antisemitism while becoming an American star.',
        ],
        ideas: [
          { heading: 'Athletes became symbols', body: 'Media assigned racial, national, and political meaning to bodies in competition, often regardless of what athletes wanted to represent.' },
          { heading: 'Scandal expanded league power', body: 'The commissioner’s “best interests of the game” authority grew from the claim that public trust required central control.' },
          { heading: 'Exclusion produced institutions', body: 'The Negro Leagues were not a lesser waiting room; they were businesses, cultural centers, and elite competition built when the front door was locked.' },
        ],
        timeline: [
          { date: '1908', label: 'Jack Johnson wins title', detail: 'Johnson becomes the first Black world heavyweight champion.' },
          { date: '1919', label: 'Black Sox scandal', detail: 'Eight Chicago players are accused of conspiring to fix the World Series.' },
          { date: '1920', label: 'Negro National League', detail: 'Rube Foster organizes a stable league structure for Black baseball.' },
          { date: '1936', label: 'Owens wins in Berlin', detail: 'Jesse Owens earns four gold medals at the Nazi-hosted Olympics.' },
        ],
        terms: [
          { term: 'commissioner', definition: 'A league executive given broad authority to protect and govern a sport.' },
          { term: 'parallel institution', definition: 'An organization an excluded group builds to provide access, power, and community outside the dominant system.' },
          { term: 'broadcast', definition: 'Sending audio or video to a large public audience through radio, television, or digital networks.' },
          { term: 'symbolic politics', definition: 'Using a person or event to represent wider values, identities, or conflicts.' },
        ],
        decision: {
          setup: 'You produce a national radio broadcast for a Louis–Schmeling fight. Sponsors want a simple “America vs. Germany” story, but race and Nazi politics complicate it.',
          prompt: 'How should the broadcast frame the event?',
          options: [
            { label: 'Explain both the contest and the political stakes', feedback: 'This gives listeners the drama without erasing why different audiences invested the bout with different meanings.' },
            { label: 'Pretend politics have nothing to do with it', feedback: 'The punches are athletic, but governments, newspapers, and audiences already made the event political.' },
            { label: 'Turn both athletes into stereotypes', feedback: 'Simple symbols sell, but they erase individual agency and reinforce the same racial nationalism the story should examine.' },
          ],
        },
        misconception: 'When athletes become national symbols, the meaning comes only from their performance.',
        quizDistractors: [
          'Radio and mass newspapers widened sports audiences without changing how athletes, leagues, or scandals were understood.',
          'A criminal acquittal and a league ban answer the same question because courts and sports organizations use the same authority.',
        ],
      },
      {
        slug: 'integration-and-the-cold-war',
        title: 'Integration and the Cold War',
        period: '1945–1963',
        icon: '📺',
        deck: 'Integration was planned, contested, uneven, and watched by a world the United States hoped to lead.',
        essentialQuestion: 'Did sports integration drive social change, reflect it, or do both at different speeds?',
        overview: [
          'When Jackie Robinson joined the Brooklyn Dodgers in 1947, the moment was the result of planning by Black journalists, activists, fans, Negro League institutions, and Dodgers executive Branch Rickey. Robinson faced abuse while being asked to respond strategically. Other teams integrated at different speeds, proving that one breakthrough did not erase the color line everywhere.',
          'Television changed schedules, revenue, celebrity, and the geography of fandom. During the Cold War, Olympic medals became evidence in a propaganda contest between political systems. American racial discrimination weakened U.S. claims to lead the “free world,” while Black athletes’ success could be celebrated abroad even when equality at home remained incomplete.',
        ],
        ideas: [
          { heading: 'Breakthroughs require systems', body: 'Robinson’s talent mattered, but contracts, reporters, organizers, teammates, security, and audience pressure made a durable breakthrough possible.' },
          { heading: 'Integration had a scoreboard', body: 'Count who was hired, where they played, who managed, and how opportunities spread. Symbolic firsts are the beginning of measurement.' },
          { heading: 'Media changed the product', body: 'Television did not simply show the game. It changed start times, sponsorship, presentation, and which sports could become national.' },
        ],
        timeline: [
          { date: '1947', label: 'Robinson debuts', detail: 'Jackie Robinson breaks modern Major League Baseball’s color line.' },
          { date: '1950', label: 'NBA integrates', detail: 'The league’s first Black players enter during the 1950–51 season.' },
          { date: '1951', label: 'Coast-to-coast sports television', detail: 'New networks make live national sports audiences increasingly possible.' },
          { date: '1960', label: 'Cold War Olympics', detail: 'Rome’s global broadcast audience watches athletes carry national prestige.' },
        ],
        terms: [
          { term: 'integration', definition: 'Ending formal racial exclusion and opening an institution to participants previously barred.' },
          { term: 'tokenism', definition: 'Using a small number of individuals to create the appearance of inclusion without changing broader power or access.' },
          { term: 'broadcast rights', definition: 'The permission to show games, sold by leagues or teams to media companies.' },
          { term: 'soft power', definition: 'Influence gained through culture, values, and reputation rather than military force.' },
        ],
        decision: {
          setup: 'Your team signs one Black star but keeps its scouting, housing, and promotion systems unchanged. Executives call the integration complete.',
          prompt: 'Which evidence would test that claim?',
          options: [
            { label: 'Track opportunity across the whole organization over time', feedback: 'Roster spots, playing time, positions, leadership, pay, and advancement show whether access became structural.' },
            { label: 'Point only to the first player’s success', feedback: 'A first matters, but one exceptional career cannot measure the system facing everyone who followed.' },
            { label: 'Count positive newspaper stories', feedback: 'Coverage shapes perception, but praise does not prove equal opportunity inside the organization.' },
          ],
        },
        misconception: 'Once one major star crossed a color line, the institution was integrated in practice.',
        quizDistractors: [
          'Major-league integration strengthened Black-owned baseball institutions by preserving their talent and bargaining power.',
          'Television and Cold War competition changed audiences but did not redistribute money, prestige, or institutional power.',
        ],
      },
      {
        slug: 'the-athlete-revolt',
        title: 'The Athlete Revolt',
        period: '1967–1980',
        icon: '✊',
        deck: 'Athletes challenged war, owners, gender barriers, and the demand to stay silent.',
        essentialQuestion: 'When athletes use the platform sport gives them, do they violate the game—or reveal what it already represents?',
        overview: [
          'Muhammad Ali’s refusal of military induction cost him his heavyweight title and years of his prime before the Supreme Court overturned his conviction. At the 1968 Olympics, Tommie Smith and John Carlos used the medal stand to protest racial injustice and paid for it with punishment and public abuse. Their actions made athletic celebrity a form of political leverage.',
          'Curt Flood challenged baseball’s reserve clause, losing at the Supreme Court but helping open the path to free agency. Title IX barred sex discrimination in federally funded education and drove enormous growth in girls’ and women’s sports. Billie Jean King turned a made-for-television match into an argument about equality, prize money, and respect.',
        ],
        ideas: [
          { heading: 'A platform creates leverage and risk', body: 'Visibility lets athletes reach audiences institutions cannot ignore, but leagues and sponsors can threaten careers in response.' },
          { heading: 'Labor rights changed the scoreboard', body: 'Player unions, lawsuits, and contract challenges redistributed money and control from owners toward athletes.' },
          { heading: 'Law changed participation', body: 'Title IX did not mention sports, yet its equality rule forced schools to reconsider access, budgets, and opportunity.' },
        ],
        timeline: [
          { date: '1967', label: 'Ali refuses induction', detail: 'Muhammad Ali cites religious conviction and opposition to the Vietnam War.' },
          { date: '1968', label: 'Mexico City protest', detail: 'Tommie Smith and John Carlos raise gloved fists on the Olympic medal stand.' },
          { date: '1969', label: 'Flood challenges reserve clause', detail: 'Curt Flood refuses a trade and attacks baseball’s control over player movement.' },
          { date: '1972', label: 'Title IX becomes law', detail: 'Federal law bars sex discrimination in education receiving federal funds.' },
        ],
        terms: [
          { term: 'conscientious objector', definition: 'A person who refuses military service because of deeply held moral or religious beliefs.' },
          { term: 'free agency', definition: 'A player’s ability to negotiate with other teams after a contract or control period ends.' },
          { term: 'Title IX', definition: 'The federal law prohibiting sex discrimination in federally funded education.' },
          { term: 'athlete activism', definition: 'Using athletic visibility, labor, or participation to press a social or political claim.' },
        ],
        decision: {
          setup: 'A league rule bans all political expression during ceremonies. An athlete plans a silent protest about unequal treatment.',
          prompt: 'How should the league respond?',
          options: [
            { label: 'Protect peaceful expression with clear, narrow rules', feedback: 'This respects athlete voice while allowing neutral limits needed to run an event.' },
            { label: 'Punish any message that makes fans uncomfortable', feedback: 'Comfort is subjective and gives popular opinion control over whose speech is acceptable.' },
            { label: 'Allow only messages the league supports', feedback: 'That turns “neutrality” into branding and grants the institution speech rights athletes do not share.' },
          ],
        },
        misconception: 'Athlete protest introduced politics into a space that had previously been neutral.',
        quizDistractors: [
          'Ali, Smith, Carlos, Flood, and women athletes all confronted the same institution through the same legal mechanism.',
          'A later court victory erases the career costs imposed before the final judgment and returns the lost time.',
        ],
      },
      {
        slug: 'the-money-game',
        title: 'The Money Game',
        period: '1979–2005',
        icon: '💸',
        deck: 'Cable, sneakers, sponsorship, and scandal turned attention into a twenty-four-hour industry.',
        essentialQuestion: 'Who captures the value when athletes, media, leagues, and brands build a sports spectacle together?',
        overview: [
          'ESPN helped turn sports from scheduled events into continuous programming. Highlights, debate shows, advertising, and live rights made attention itself a product. Michael Jordan’s partnership with Nike showed how an athlete could become a global brand, while leagues and sponsors learned to sell personality, clothing, and aspiration far beyond the game.',
          'The steroid era raised questions about incentives: leagues benefited from dramatic performance while testing and enforcement lagged. College sports generated large revenues under rules that restricted player compensation. The 2004 Malice at the Palace became a case study in how repeated video, racial framing, fan behavior, and league punishment shape public memory of a chaotic event.',
        ],
        ideas: [
          { heading: 'Attention became inventory', body: 'More hours of programming created more advertising, debate, highlights, and demand for live rights.' },
          { heading: 'The athlete became a brand', body: 'Endorsements tied identity and storytelling to products, giving stars new income and companies new cultural reach.' },
          { heading: 'Incentives shape scandal', body: 'When owners, networks, players, and fans benefit from extraordinary performance, enforcement can remain weak until credibility collapses.' },
        ],
        timeline: [
          { date: '1979', label: 'ESPN launches', detail: 'A cable network begins building a round-the-clock sports audience.' },
          { date: '1984', label: 'Jordan signs with Nike', detail: 'A landmark partnership helps redefine athlete marketing and sneaker culture.' },
          { date: '1998', label: 'Home-run chase', detail: 'McGwire and Sosa revive baseball excitement during the steroid era.' },
          { date: '2004', label: 'Malice at the Palace', detail: 'A Detroit-area brawl produces suspensions and a lasting media argument over blame.' },
        ],
        terms: [
          { term: 'rights fee', definition: 'Money a media company pays for permission to broadcast games.' },
          { term: 'endorsement', definition: 'A paid relationship in which a public figure promotes or represents a product.' },
          { term: 'amateurism', definition: 'The idea that athletes compete without direct pay, historically used to govern college sports.' },
          { term: 'framing', definition: 'The choices that emphasize certain facts, images, and explanations in telling a story.' },
        ],
        decision: {
          setup: 'A league suspects performance-enhancing drug use but fears strict testing will remove stars and reduce ratings.',
          prompt: 'Which policy protects the sport’s long-term value?',
          options: [
            { label: 'Independent testing with transparent rules', feedback: 'Credible enforcement may create short-term pain but reduces conflicts of interest and protects records and health.' },
            { label: 'Test only unpopular players', feedback: 'Selective enforcement protects stars but destroys fairness and makes the scandal larger when exposed.' },
            { label: 'Ignore it while ratings rise', feedback: 'This treats short-term attention as value while borrowing against future trust.' },
          ],
        },
        misconception: 'Sports media only reports on the industry; it does not change the product, incentives, or public memory.',
        quizDistractors: [
          'A reported organizing-committee surplus proves that every host-city resident and public agency made money.',
          'The steroid-era record can be judged accurately without separating testimony dates, sample dates, and later admissions.',
        ],
      },
      {
        slug: 'the-modern-arena',
        title: 'The Modern Arena',
        period: '2005–today',
        icon: '📱',
        deck: 'Athletes gained their own microphones while data, betting, health, and ownership created new fights.',
        essentialQuestion: 'Who should control an athlete’s body, identity, voice, and economic value in the modern sports system?',
        overview: [
          'Social media reduced athletes’ dependence on reporters and teams to speak publicly, while exposing them to constant scrutiny and direct harassment. Concussion research and CTE evidence forced football and other sports to confront long-term health costs. The central question shifted from whether injuries occurred to what leagues knew, what they disclosed, and what risks participants could truly consent to.',
          'In 2021, college athletes gained the ability to earn from their name, image, and likeness. Legalized sports betting tied leagues and broadcasts more tightly to gambling markets. Women’s sports drew growing audiences and investment while compensation and facilities remained contested. Flint’s Claressa Shields illustrates how place, gender, media attention, and individual excellence meet in a modern sports career.',
        ],
        ideas: [
          { heading: 'Athletes became publishers', body: 'Direct communication can bypass traditional gatekeepers, but platforms still rank, monetize, and moderate attention.' },
          { heading: 'Risk needs informed power', body: 'Consent is incomplete when medical information is hidden, contracts are unequal, or the cost of refusing is a career.' },
          { heading: 'New revenue reopens old questions', body: 'NIL, betting, streaming, and women’s sports growth all ask who creates value and who controls the terms.' },
        ],
        timeline: [
          { date: '2005', label: 'CTE evidence reaches the NFL debate', detail: 'Research linking football trauma to brain disease intensifies scrutiny of league knowledge and safety.' },
          { date: '2016', label: 'Kaepernick protests', detail: 'A quarterback’s anthem protest spreads a national debate about race, policing, and athlete voice.' },
          { date: '2018', label: 'Sports betting landscape changes', detail: 'A Supreme Court decision allows states to legalize sports wagering.' },
          { date: '2021', label: 'NIL era begins', detail: 'College athletes begin earning money from their name, image, and likeness under new rules.' },
        ],
        terms: [
          { term: 'CTE', definition: 'Chronic traumatic encephalopathy, a degenerative brain disease associated with repeated head impacts.' },
          { term: 'NIL', definition: 'Name, image, and likeness—the commercial value of an athlete’s identity.' },
          { term: 'gatekeeper', definition: 'A person or institution that controls access to audiences, opportunities, or information.' },
          { term: 'informed risk', definition: 'A danger someone understands through honest, complete information before choosing whether to accept it.' },
        ],
        decision: {
          setup: 'A star is medically cleared under current rules but independent research suggests repeated impacts may carry long-term risk the league has not explained clearly.',
          prompt: 'What does informed choice require?',
          options: [
            { label: 'Independent evidence, plain-language risk, and freedom to pause', feedback: 'Consent needs understandable information and a real option to step away without hidden punishment.' },
            { label: 'Let the player decide with no new information', feedback: 'Choice matters, but it is not informed if the institution controls or minimizes the evidence.' },
            { label: 'Let the league decide privately', feedback: 'League expertise is useful, but financial conflicts make independent review essential.' },
          ],
        },
        misconception: 'Giving athletes direct access to audiences eliminates media gatekeepers and power imbalances.',
        quizDistractors: [
          'The Supreme Court\'s Alston decision abolished every NCAA compensation rule and declared all college athletes employees.',
          'Modern betting, health, and media systems affect revenue but do not alter consent, trust, or athlete risk.',
        ],
      },
    ],
  },
  {
    slug: 'hidden-history',
    title: 'Hidden History',
    shortTitle: 'Hidden History',
    label: 'the evidence lab',
    color: '#8b2be2',
    softColor: '#f5edff',
    description: 'Six case files for learning how to question, research, analyze, evaluate, debate, and reach a verdict.',
    units: [
      {
        slug: 'official-story-vs-rumor',
        title: 'The Official Story vs. The Rumor',
        period: 'Case File 01',
        icon: '🛸',
        deck: 'Roswell is the hook. Evidence is the actual subject.',
        essentialQuestion: 'How can we tell the difference between a changing explanation and proof of a conspiracy?',
        overview: [
          'In July 1947, the Roswell Army Air Field announced it had recovered a “flying disc,” then quickly said the debris came from a weather balloon. Decades later, former personnel and writers revived the story as evidence of an alien crash. A secret Cold War balloon program called Project Mogul later offered a documented reason for military secrecy and unusual debris.',
          'This case introduces the course’s Four Verdicts: confirmed, debunked, misleading, and unproven. An official statement is not automatically true, but a rumor is not automatically brave or independent. Each claim has to earn a verdict through source quality, corroboration, physical evidence, and honest treatment of uncertainty. The goal is not to “believe nothing.” It is to believe in proportion to the evidence.',
        ],
        ideas: [
          { heading: 'Claims have parts', body: 'Separate what happened, what someone inferred, and what they concluded. “The military changed its story” is not identical to “the military recovered aliens.”' },
          { heading: 'Sources carry weight, not magic', body: 'A source gains strength through proximity, independence, expertise, consistency, and corroboration. Official and unofficial sources both require testing.' },
          { heading: 'Unproven is a real verdict', body: 'Lack of proof does not automatically debunk a claim, but it also does not justify treating possibility as fact.' },
        ],
        timeline: [
          { date: '1947', label: 'Roswell headlines', detail: 'A military press release says “flying disc,” then officials describe balloon debris.' },
          { date: '1955', label: 'Area 51 begins testing', detail: 'The secret Nevada site supports classified aircraft programs, providing a real basis for secrecy.' },
          { date: '1978', label: 'Roswell story revived', detail: 'Interviews with former intelligence officer Jesse Marcel renew public attention.' },
          { date: '1994', label: 'Air Force report', detail: 'A report identifies Project Mogul as the likely source of the 1947 debris.' },
        ],
        terms: [
          { term: 'claim', definition: 'A statement that can be supported, challenged, or qualified with evidence.' },
          { term: 'corroboration', definition: 'Independent evidence that supports the same important detail.' },
          { term: 'provenance', definition: 'Where a document, image, object, or quotation came from and how it reached us.' },
          { term: 'unproven', definition: 'A verdict for a claim that lacks enough reliable evidence to confirm or debunk.' },
        ],
        decision: {
          setup: 'A witness tells a vivid story thirty years after the event. The story conflicts with a document made at the time but includes details the public did not know.',
          prompt: 'What should an investigator do next?',
          options: [
            { label: 'Test each distinctive detail against independent records', feedback: 'This uses the testimony as a lead without treating memory or paperwork as automatically decisive.' },
            { label: 'Accept it because the witness was there', feedback: 'Proximity matters, but memory changes and status does not replace corroboration.' },
            { label: 'Reject it because it came later', feedback: 'Delay weakens memory evidence, but later testimony can still contain checkable and important information.' },
          ],
        },
        misconception: 'If an official explanation changes, the most dramatic alternative must be true.',
        quizDistractors: [
          'A sincere memory recorded decades later should automatically outweigh a document created at the time.',
          'Calling an event unexplained is a final verdict that confirms whichever explanation attracts the most attention.',
        ],
      },
      {
        slug: 'follow-the-evidence',
        title: 'Follow the Evidence',
        period: 'Case File 02',
        icon: '🧵',
        deck: 'Watergate and “Paul is dead” begin with clues. Only one builds a chain of proof.',
        essentialQuestion: 'What separates a real investigation from a pile of interesting coincidences?',
        overview: [
          'The Watergate burglary looked small until reporters, investigators, judges, and Congress followed money, testimony, records, and attempts to obstruct the case. Anonymous source “Deep Throat” helped guide reporting, but the published case did not rest on his authority alone. Court filings, public testimony, financial records, and finally White House tapes corroborated the core story.',
          'The “Paul is dead” rumor also invited people to collect clues: reversed sounds, album art, license plates, and ambiguous lyrics. The more fans searched, the more patterns they found, but the theory never developed reliable evidence for its central claim. Comparing the cases reveals the difference between a chain—where evidence connects and independently confirms—and a collage, where clues accumulate without becoming proof.',
        ],
        ideas: [
          { heading: 'Follow the chain', body: 'Strong investigations document how one fact leads to the next. Weak ones leap from suggestive details to a predetermined conclusion.' },
          { heading: 'Anonymous does not mean uncheckable', body: 'Responsible reporters verify access, seek documents, use multiple sources, and publish what can be supported rather than asking readers to trust a secret name.' },
          { heading: 'Patterns are invitations, not verdicts', body: 'Humans are excellent at finding meaning. A pattern matters only when it predicts or explains evidence better than coincidence does.' },
        ],
        timeline: [
          { date: '1969', label: '“Paul is dead” rumor spreads', detail: 'College newspapers and radio amplify a fan theory built from supposed clues.' },
          { date: '1972', label: 'Watergate burglary', detail: 'Five men are arrested inside Democratic Party offices in Washington.' },
          { date: '1973', label: 'Senate hearings and tapes', detail: 'Public testimony reveals a White House recording system and a wider cover-up.' },
          { date: '1974', label: 'Nixon resigns', detail: 'Tape evidence destroys remaining support and the president leaves office.' },
        ],
        terms: [
          { term: 'lead', definition: 'Information that points an investigation toward something that can be checked.' },
          { term: 'anonymous source', definition: 'A source whose identity is withheld from the audience, though responsible reporters still know and evaluate it.' },
          { term: 'confirmation bias', definition: 'The tendency to notice and favor information that fits what we already believe.' },
          { term: 'chain of evidence', definition: 'Connected facts whose origins and relationships can be traced and tested.' },
        ],
        decision: {
          setup: 'A confidential source makes a serious accusation against a powerful official but provides no document you can publish yet.',
          prompt: 'When is the story ready?',
          options: [
            { label: 'After independent confirmation of the core facts', feedback: 'The source can guide the work, but corroboration makes the public case stronger than trust in one person.' },
            { label: 'Immediately, because secrecy proves danger', feedback: 'Secrecy may reflect real risk, but it can also hide error, motive, or distance from the facts.' },
            { label: 'Never use confidential sources', feedback: 'That avoids one risk but can make well-protected wrongdoing impossible to uncover. The solution is stricter verification.' },
          ],
        },
        misconception: 'A large number of clues is the same thing as a strong chain of evidence.',
        quizDistractors: [
          'Ten reports that repeat one anonymous origin provide ten independent confirmations of the same claim.',
          'If a theory explains both the presence and absence of evidence as proof, it has passed a fair test.',
        ],
      },
      {
        slug: 'reading-the-record',
        title: 'Reading the Record',
        period: 'Case File 03',
        icon: '📄',
        deck: 'A real document can still be used to tell a false story.',
        essentialQuestion: 'How do context, selection, and hindsight change what a historical record appears to prove?',
        overview: [
          'The Pentagon Papers were a classified government study of U.S. decision-making in Vietnam. When Daniel Ellsberg provided copies to newspapers, the documents showed that several administrations had privately recognized risks and weaknesses they did not share honestly with the public. The Supreme Court rejected the government’s attempt to stop publication in advance.',
          'Pearl Harbor advance-knowledge claims often use authentic warnings, intercepted messages, or intelligence fragments. The hard question is not whether warnings existed; many did. It is whether decision-makers received a clear, specific, credible warning in time and knowingly allowed the attack. Reading the record means checking dates, authors, audiences, redactions, distribution, and what other information competed for attention at the moment.',
        ],
        ideas: [
          { heading: 'Documents have situations', body: 'Ask who created a record, for whom, when, and for what purpose. A private memo, public speech, and later recollection answer different questions.' },
          { heading: 'True pieces can build a false whole', body: 'Cherry-picking removes contrary evidence and context so selected facts appear to prove more than they do.' },
          { heading: 'Hindsight turns whispers into alarms', body: 'After an event, relevant warnings stand out. Before it, they competed with false leads, uncertainty, and limited attention.' },
        ],
        timeline: [
          { date: '1941', label: 'Pearl Harbor attacked', detail: 'Japan’s surprise attack brings the United States into WWII.' },
          { date: '1967', label: 'Pentagon study ordered', detail: 'Defense Secretary Robert McNamara commissions a secret history of Vietnam decision-making.' },
          { date: '1971', label: 'Papers published', detail: 'The New York Times and other newspapers print excerpts despite government opposition.' },
          { date: '1973', label: 'Ellsberg case dismissed', detail: 'Government misconduct leads a judge to dismiss charges against the leaker.' },
        ],
        terms: [
          { term: 'primary source', definition: 'Evidence created during the time being studied or by someone directly involved.' },
          { term: 'redaction', definition: 'Information deliberately removed or hidden from a released record.' },
          { term: 'cherry-picking', definition: 'Selecting only evidence that supports a conclusion while ignoring relevant contrary evidence.' },
          { term: 'hindsight bias', definition: 'Seeing an outcome as more predictable after we already know it happened.' },
        ],
        decision: {
          setup: 'A declassified memo includes one alarming sentence, but the pages before and after it remain redacted. Online posts call it “smoking-gun proof.”',
          prompt: 'What verdict is justified right now?',
          options: [
            { label: 'Important evidence, but context still limits the claim', feedback: 'This preserves the document’s value without pretending the missing context is known.' },
            { label: 'Confirmed, because the sentence is authentic', feedback: 'Authenticity proves the words are real, not that the strongest interpretation is correct.' },
            { label: 'Debunked, because anything is redacted', feedback: 'Missing information creates uncertainty; it does not erase the visible evidence.' },
          ],
        },
        misconception: 'An authentic document automatically proves the interpretation attached to it.',
        quizDistractors: [
          'A classified source is automatically complete and candid because officials did not intend the public to read it.',
          'After an event, the warning that resembles the outcome proves decision-makers recognized it as decisive beforehand.',
        ],
      },
      {
        slug: 'trust-and-verify',
        title: 'Trust and Verify',
        period: 'Case File 04',
        icon: '🧠',
        deck: 'MKUltra is documented. The myths that borrow its name still need receipts.',
        essentialQuestion: 'How do we acknowledge real government wrongdoing without using it as a blank check for unrelated claims?',
        overview: [
          'MKUltra was a secret CIA program that funded research into drugs, interrogation, and behavior modification. Some experiments involved LSD and other methods without informed consent. The program violated rights and medical ethics. Many files were deliberately destroyed in 1973, but surviving financial records, investigations, and sworn testimony document important parts of what occurred.',
          'The destroyed files create real uncertainty, but uncertainty has boundaries. Evidence that a program existed does not confirm every modern claim involving “mind control.” This unit adds lateral reading: leave a suspicious page, investigate the source, trace media to its origin, and compare independent reporting. Verification is a method for both shocking claims and comforting ones.',
        ],
        ideas: [
          { heading: 'Documented wrongdoing sets a floor', body: 'MKUltra’s existence, secrecy, and ethical violations are confirmed. Investigation should begin there, not minimize it.' },
          { heading: 'Missing records do not have infinite content', body: 'Destroyed files justify questions and cautious language, not any desired conclusion about what they contained.' },
          { heading: 'Read laterally', body: 'Do not let one page define its own credibility. Open new sources to check ownership, expertise, reputation, and the original evidence.' },
        ],
        timeline: [
          { date: '1953', label: 'MKUltra approved', detail: 'The CIA begins a broad secret program of behavioral and drug research.' },
          { date: '1973', label: 'Files destroyed', detail: 'CIA director Richard Helms orders many program records destroyed.' },
          { date: '1975', label: 'Investigations expose abuses', detail: 'The Rockefeller Commission and Church Committee bring intelligence misconduct into public view.' },
          { date: '1977', label: 'Senate hearing', detail: 'Newly found financial files support public testimony about the program’s scope.' },
        ],
        terms: [
          { term: 'informed consent', definition: 'A person voluntarily agrees after understanding a procedure’s purpose, risks, and alternatives.' },
          { term: 'lateral reading', definition: 'Leaving a source to investigate who is behind it and what other reliable sources say.' },
          { term: 'burden of proof', definition: 'The responsibility to provide evidence for a claim, especially an extraordinary one.' },
          { term: 'scope', definition: 'The boundaries of what evidence or a conclusion actually covers.' },
        ],
        decision: {
          setup: 'A post uses a real MKUltra document to claim that a current celebrity’s behavior is controlled by the same program.',
          prompt: 'How should the post be evaluated?',
          options: [
            { label: 'Separate the confirmed program from the new unsupported link', feedback: 'This protects the truth about MKUltra while placing the burden of proof on the celebrity claim.' },
            { label: 'Accept the link because MKUltra was real', feedback: 'One documented program does not automatically authenticate a different claim decades later.' },
            { label: 'Deny MKUltra to weaken the post', feedback: 'Erasing real misconduct is inaccurate and makes responsible fact-checking less credible.' },
          ],
        },
        misconception: 'Because records were destroyed, any claim about what the missing files contained is equally possible.',
        quizDistractors: [
          'One documented secret program supplies evidence for later claims that involve different actors and mechanisms.',
          'A dramatic witness statement becomes an official finding as soon as it is delivered at a government hearing.',
        ],
      },
      {
        slug: 'watching-the-watchers',
        title: 'Watching the Watchers',
        period: 'Case File 05',
        icon: '👁️',
        deck: 'Real surveillance programs make evidence standards more important, not less.',
        essentialQuestion: 'How can a democracy investigate threats without turning dissent into evidence of guilt?',
        overview: [
          'COINTELPRO was an FBI program that monitored, infiltrated, disrupted, and discredited political organizations. Targets included civil rights groups, Black activists, antiwar organizations, and others. Tactics went beyond intelligence gathering to anonymous letters, planted conflict, pressure on employers, and efforts to damage reputations. A 1971 burglary of an FBI office exposed records to the press.',
          'The Church Committee documented intelligence abuses and helped inspire new oversight rules. This history supports a serious civil-liberties debate: governments face real security threats, but secrecy and weak oversight can make legal political activity a target. The strongest argument distinguishes documented surveillance from vague “shadow government” claims and then debates policy with evidence about power, necessity, and safeguards.',
        ],
        ideas: [
          { heading: 'Surveillance and disruption are different', body: 'Collecting information is not the same as secretly damaging organizations or relationships. The distinction matters for law and accountability.' },
          { heading: 'Secrecy removes ordinary checks', body: 'Programs hidden from courts, Congress, and the public can expand beyond their original purpose.' },
          { heading: 'Oversight must have tools', body: 'Rules matter only if reviewers can access records, question officials, protect whistleblowers, and impose consequences.' },
        ],
        timeline: [
          { date: '1956', label: 'COINTELPRO begins', detail: 'The FBI launches covert action against the Communist Party and later expands targets.' },
          { date: '1963', label: 'King surveillance intensifies', detail: 'The FBI targets Martin Luther King Jr. with wiretaps and a campaign to discredit him.' },
          { date: '1971', label: 'Citizens expose FBI files', detail: 'Burglars take documents from an FBI office and send them to journalists.' },
          { date: '1975', label: 'Church Committee hearings', detail: 'The Senate publicly investigates intelligence abuses across agencies.' },
        ],
        terms: [
          { term: 'surveillance', definition: 'Systematic observation or collection of information about people, groups, or activity.' },
          { term: 'dissent', definition: 'Public disagreement with government or prevailing opinion.' },
          { term: 'oversight', definition: 'Independent review designed to keep powerful institutions lawful and accountable.' },
          { term: 'civil liberties', definition: 'Basic freedoms protected from government interference, including speech, assembly, privacy, and due process.' },
        ],
        decision: {
          setup: 'An agency wants to monitor a political group because one member praised violence online. The group itself organizes lawful protests.',
          prompt: 'What safeguard matters most?',
          options: [
            { label: 'Require specific evidence, narrow scope, and outside review', feedback: 'This focuses on a credible threat without treating association or dissent as guilt.' },
            { label: 'Monitor every member indefinitely', feedback: 'Broad collection may feel safer, but it chills lawful activity and makes error and abuse more likely.' },
            { label: 'Ban all investigation of political groups', feedback: 'That protects dissent but could prevent investigation of a specific, evidence-based threat. Narrow authority is the harder balance.' },
          ],
        },
        misconception: 'If government surveillance is sometimes necessary, more surveillance is always safer.',
        quizDistractors: [
          'Surveillance and covert disruption are the same activity because both can begin with a security concern.',
          'Oversight can restrain secret power even when reviewers cannot see records, question officials, or impose consequences.',
        ],
      },
      {
        slug: 'the-verdict',
        title: 'The Verdict',
        period: 'Case File 06',
        icon: '⚖️',
        deck: 'A verdict is not a vibe. It is a claim sized to the evidence.',
        essentialQuestion: 'What does an intellectually honest verdict sound like when the evidence is incomplete or contested?',
        overview: [
          'Iran-Contra involved secret arms sales to Iran and the diversion of proceeds to support the Contras in Nicaragua despite congressional restrictions. Hearings, testimony, memos, and financial trails documented the operation, while destroyed records and disputes over presidential knowledge left some questions unresolved. The case demonstrates that confirmed wrongdoing and genuine uncertainty can coexist.',
          'JFK records and moon-landing claims let students practice two opposite risks: treating every new document as a bombshell or treating a settled question as permanently open. The capstone demands a precise claim, transparent source trail, serious treatment of the best counterevidence, and one of the Four Verdicts. Strong investigators state what would change their minds.',
        ],
        ideas: [
          { heading: 'Verdicts have boundaries', body: 'Confirm the part the evidence supports. Do not stretch a documented operation into unrelated claims or shrink uncertainty into certainty.' },
          { heading: 'Counterevidence is part of your case', body: 'A trustworthy verdict presents the strongest challenge and explains why it does or does not change the conclusion.' },
          { heading: 'Confidence should be visible', body: 'Words such as likely, strongly supported, unclear, and not established help the audience understand the evidence’s strength.' },
        ],
        timeline: [
          { date: '1963', label: 'JFK assassinated', detail: 'The murder produces investigations, records, and a lasting ecosystem of competing claims.' },
          { date: '1969', label: 'Apollo 11 lands', detail: 'Independent tracking, samples, images, instruments, and later missions build a dense evidence record.' },
          { date: '1986', label: 'Iran-Contra exposed', detail: 'A secret foreign-policy operation becomes public and triggers investigations.' },
          { date: '1992', label: 'JFK Records Act', detail: 'Congress creates a process to collect and release assassination records.' },
        ],
        terms: [
          { term: 'verdict', definition: 'A reasoned conclusion that matches the quality and amount of available evidence.' },
          { term: 'counterevidence', definition: 'Relevant evidence that challenges or weakens a claim.' },
          { term: 'confidence level', definition: 'How certain a conclusion is, based on the strength and limits of the evidence.' },
          { term: 'falsifiable', definition: 'Capable of being tested in a way that could show the claim is wrong.' },
        ],
        decision: {
          setup: 'Your capstone evidence strongly supports part of a popular claim, disproves another part, and leaves one detail unresolved.',
          prompt: 'What is the strongest final verdict?',
          options: [
            { label: 'Split the claim and give each part the verdict it earns', feedback: 'Precision is a strength. Real conclusions often combine confirmed, debunked, and unresolved pieces.' },
            { label: 'Choose one dramatic label for the entire story', feedback: 'Simple verdicts are memorable, but they can hide differences in evidence quality.' },
            { label: 'Say “we can never know anything”', feedback: 'Uncertainty in one detail does not erase what multiple reliable sources establish.' },
          ],
        },
        misconception: 'A strong verdict must be completely certain and fit the entire story into one label.',
        quizDistractors: [
          'Institutional secrecy in one part of a case proves the strongest allegation attached to every other part.',
          'Once a source supports a preferred conclusion, counterevidence no longer belongs in the final case file.',
        ],
      },
    ],
  },
];

export const learningHubs = learningCourses.flatMap((course) =>
  course.units.map((unit, index) => ({
    ...unit,
    unitNumber: index + 1,
    courseSlug: course.slug,
    courseTitle: course.title,
    courseLabel: course.label,
    courseColor: course.color,
    courseSoftColor: course.softColor,
  })),
);

export type LearningHub = (typeof learningHubs)[number];
