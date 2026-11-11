// Historical coordinates anchor the reconstruction. Motion is compressed for a classroom view.
export const ORBITAL_EVENTS = [
  { id: 'apollo-11', effect: 1, title: 'Apollo 11 launch', date: 'July 16, 1969', year: 1969,
    place: 'Kennedy Space Center, Florida', lat: 28.61, lon: -80.60, duration: 8,
    summary: 'A Saturn V lifts Apollo 11 toward orbit. Watch its sunlit exhaust trail.',
    source: 'https://www.nasa.gov/history/apollo-11-mission-overview/' },
  { id: 'katrina', effect: 2, title: 'Hurricane Katrina', date: 'August 28, 2005', year: 2005,
    place: 'Gulf of Mexico', lat: 26.3, lon: -88.6, duration: 9,
    summary: 'Rainbands wrap around the eye as Katrina crosses the Gulf.',
    source: 'https://science.nasa.gov/earth/earth-observatory/hurricane-katrina-15395/' },
  { id: 'thunderstorm', effect: 3, title: 'Lightning from orbit', date: 'Illustrative weather', year: null,
    place: 'Tropical Atlantic', lat: 6, lon: -32, duration: 8,
    summary: 'Lightning inside a storm lights its cloud tops in brief pulses.' },
  { id: 'pinatubo', effect: 4, title: 'Mount Pinatubo eruption', date: 'June 15, 1991', year: 1991,
    place: 'Luzon, Philippines', lat: 15.13, lon: 120.35, duration: 8,
    summary: 'Volcanic ash rises and spreads into a broad umbrella above Luzon.',
    source: 'https://www.usgs.gov/publications/cataclysmic-1991-eruption-mount-pinatubo-philippines' },
  { id: 'aurora', effect: 5, title: 'The March geomagnetic storm', date: 'March 13, 1989', year: 1989,
    place: 'North America', lat: 52, lon: -100, duration: 9,
    summary: 'Auroral curtains extend far south during the storm that knocked out power in Québec.',
    source: 'https://science.nasa.gov/wp-content/uploads/2023/03/574865main-spaceweather-math.pdf' },
  { id: 'eclipse', effect: 6, title: 'Total solar eclipse', date: 'August 21, 2017', year: 2017,
    place: 'United States', lat: 39.5, lon: -97, duration: 8,
    summary: 'The Moon’s shadow tracks from the Pacific Northwest toward the Atlantic.',
    source: 'https://science.nasa.gov/resource/what-spacecraft-saw-during-the-2017-solar-eclipse/' },
  { id: 'wildfire-smoke', effect: 7, title: 'Québec wildfire smoke', date: 'June 6, 2023', year: 2023,
    place: 'Québec and eastern United States', lat: 48.5, lon: -73.5, duration: 9,
    summary: 'Winds carry a broad ribbon of smoke south and east from fires in Québec.',
    source: 'https://www.nesdis.noaa.gov/news/noaa-satellites-tracked-historic-levels-of-harmful-smoke-impacting-millions-in-the-eastern-us' },
];

export function eligibleEvents(year) {
  return ORBITAL_EVENTS.filter(event => event.year === null || event.year <= year);
}

export function createOrbitalPlayback(random = Math.random) {
  let scene = null;
  let elapsed = 0;
  let idle = 0;
  let seen = new Set();
  let last;
  let selectedYear;

  function stop() {
    scene = null;
    elapsed = idle = 0;
  }

  return {
    get scene() { return scene; },
    stop,
    replay(event, still) {
      scene = event;
      elapsed = still ? event.duration * .62 : 0;
    },
    tick({ dt, year, auto, blocked, still, visible }) {
      if (year !== selectedYear) {
        selectedYear = year;
        seen = new Set();
        if (scene?.year > year) stop();
      }
      if (blocked) stop();
      if (scene) {
        if (!still) elapsed += dt;
        if (elapsed < scene.duration) return { scene, progress: elapsed / scene.duration, rotate: false };
        stop();
      }
      if (blocked || still || !auto) return { scene: null, rotate: false };
      idle += dt;
      if (idle < 6) return { scene: null, rotate: false };
      const eligible = eligibleEvents(year);
      if (eligible.every(event => seen.has(event.id))) seen.clear();
      let candidates = eligible.filter(event => !seen.has(event.id) && visible(event));
      if (candidates.length > 1) candidates = candidates.filter(event => event.id !== last);
      if (!candidates.length) return { scene: null, rotate: true };
      scene = candidates[Math.floor(random() * candidates.length)];
      last = scene.id;
      seen.add(scene.id);
      elapsed = 0;
      return { scene, progress: 0, rotate: false };
    },
  };
}
