(() => {
  const root = '/storyhub/subday-20260908';
  const reconstruction = 'Generated visual reconstruction — not archival evidence.';

  const stories = {
    'ush9-s01-the-margin': {
      folder: 'margin',
      hero: ['13-the-road.webp', 'The lowered crest carried a road across the South Fork dam.'],
      scenes: [
        ['01-the-specification.webp', 'The original dam specification and its discharge culvert.'],
        ['02-the-economies.webp', 'An engineered reservoir becomes a private recreational lake.'],
        ['03-the-members.webp', 'The private club and its lake above the Conemaugh Valley.'],
        ['04-the-warnings.webp', 'The altered crest and the warnings attached to it.'],
        ['05-the-rain.webp', 'An extreme storm fills the watershed.'],
        ['06-the-morning.webp', 'Emergency work begins after the margin is nearly gone.'],
        ['07-3-10-pm.webp', 'At roughly 3:10 p.m., the embankment fails.'],
        ['08-fourteen-miles.webp', 'The flood follows the narrow valley toward Johnstown.'],
        ['09-the-stone-bridge.webp', 'Debris stops against the railroad bridge below town.'],
        ['10-the-count.webp', 'The accepted death toll is 2,209.'],
        ['11-the-verdict.webp', 'Survivors seek accountability and the suits fail.'],
        ['13-the-road.webp', 'A road across the crest made an invisible safety margin spendable.'],
      ],
    },
    'hh-s01-the-desk-it-stopped-at': {
      folder: 'desk',
      hero: ['05-the-desk-it-stopped-at.webp', 'A proposal reaches the Secretary of Defense; the released record stops there.'],
      scenes: [
        ['01-the-page.webp', 'A real memorandum dated March 13, 1962.'],
        ['02-where-it-came-from.webp', 'Cold War planning after the Bay of Pigs.'],
        ['03-what-it-proposed.webp', 'The enclosure gathers proposed pretexts for intervention.'],
        ['04-who-signed-it.webp', 'The Chairman of the Joint Chiefs transmits the proposal.'],
        ['05-the-desk-it-stopped-at.webp', 'The paper moves; the proposed operation does not.'],
        ['06-thirty-five-years.webp', 'The record remains inside classified files until 1997.'],
        ['07-what-happened-to-it-online.webp', 'Online retellings detach the document from its status.'],
        ['08-what-it-does-establish.webp', 'A real document can establish what senior officials considered.'],
        ['09-what-it-does-not-carry.webp', 'One document cannot carry every later allegation.'],
        ['11-what-the-document-is.webp', 'The strongest conclusion keeps both halves of the record.'],
      ],
      extra: [
        '10-two-shapes-of-secrecy.webp',
        'Secrecy can hide both genuine records and unsupported claims.',
        'How far can this document carry you?',
      ],
    },
    'bts-s01-the-death-harvest': {
      folder: 'harvest',
      hero: ['01-the-tally.webp', 'A newspaper tally turns football deaths into a national crisis.'],
      scenes: [
        ['01-the-tally.webp', 'Conflicting newspaper counts enter the national argument.'],
        ['02-the-game-they-were-playing.webp', 'Mass play made sense under the old down-and-distance rules.'],
        ['03-what-the-counts-said-killed-them.webp', 'The tallies mixed college, school, amateur, and neighborhood football.'],
        ['04-october-9-1905.webp', 'Roosevelt brings football leaders to the White House.'],
        ['05-november-25-1905.webp', 'The season ends under public pressure and disputed totals.'],
        ['06-the-new-rules.webp', 'The 1906 rule book opens the game but does not finish the repair.'],
        ['07-what-happened-next.webp', 'The crisis persists after the first reform pass.'],
        ['08-1909.webp', 'A second death crisis returns national attention to the sport.'],
        ['09-1910.webp', 'New rules attack mass momentum more directly.'],
        ['10-who-was-actually-dying.webp', 'Many victims were outside elite college football.'],
        ['11-what-the-organization-became.webp', 'The reform organization becomes the NCAA.'],
        ['12-six.webp', 'Six years of pressure changed more than one famous rule.'],
      ],
    },
  };

  function makeFigure(src, title, options = {}) {
    const figure = document.createElement('figure');
    figure.className = `story-art${options.hero ? ' story-art--hero' : ''}${options.wide ? ' story-art--wide' : ''}`;

    const image = document.createElement('img');
    image.src = src;
    image.alt = title;
    image.width = 1279;
    image.height = 720;
    image.decoding = 'async';
    image.loading = options.hero ? 'eager' : 'lazy';
    if (options.hero) image.fetchPriority = 'high';

    const caption = document.createElement('figcaption');
    const sceneLabel = document.createElement('span');
    sceneLabel.textContent = title;
    const evidenceLabel = document.createElement('span');
    evidenceLabel.textContent = reconstruction;
    caption.append(sceneLabel, evidenceLabel);
    figure.append(image, caption);
    return figure;
  }

  function installStory(config) {
    const base = `${root}/${config.folder}`;
    const heroGrid = document.querySelector('.heroGrid');
    if (heroGrid) {
      const oldVisual = heroGrid.lastElementChild;
      if (oldVisual && oldVisual !== heroGrid.firstElementChild) {
        oldVisual.replaceWith(makeFigure(`${base}/${config.hero[0]}`, config.hero[1], { hero: true }));
      }
    }

    document.querySelectorAll('section.story').forEach((section, index) => {
      const scene = config.scenes[index];
      if (!scene) return;
      const art = makeFigure(`${base}/${scene[0]}`, scene[1], {
        wide: !section.querySelector('.sectionGrid'),
      });
      const plate = section.querySelector('.plate');
      if (plate) {
        plate.replaceWith(art);
        return;
      }
      const heading = section.querySelector('.wrap h2');
      if (heading) heading.insertAdjacentElement('afterend', art);
    });

    if (config.extra) {
      const [file, caption, headingText] = config.extra;
      const heading = [...document.querySelectorAll('.instrument h3')]
        .find(node => node.textContent.trim() === headingText);
      if (heading) heading.insertAdjacentElement('afterend', makeFigure(`${base}/${file}`, caption, { wide: true }));
    }
  }

  const story = document.body.dataset.story;
  if (story && stories[story]) {
    installStory(stories[story]);
    return;
  }

  if (location.pathname.endsWith('/hubs/substitute-day-2026-09-08.html')) {
    const covers = {
      m: `${root}/margin/13-the-road.webp`,
      h: `${root}/desk/05-the-desk-it-stopped-at.webp`,
      b: `${root}/harvest/01-the-tally.webp`,
    };
    Object.entries(covers).forEach(([className, url]) => {
      const card = document.querySelector(`.card.${className}`);
      if (card) card.style.setProperty('--story-cover', `url('${url}')`);
    });
  }
})();
