// Low-resolution Natural Earth polygons. Each ring uses longitude, latitude.
function insideRing(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i], [previousX, previousY] = ring[j];
    if ((y > lat) !== (previousY > lat) && lon < (previousX - x) * (lat - y) / (previousY - y) + x) {
      inside = !inside;
    }
  }
  return inside;
}

export function countryAt(countries, lon, lat) {
  return countries.find(([, polygons]) => polygons.some(([outline, ...holes]) =>
    insideRing(outline, lon, lat) && !holes.some(ring => insideRing(ring, lon, lat))));
}

export function drawCountryLines(countries) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  for (const [, polygons] of countries) {
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const [index, [lon, lat]] of ring.entries()) {
          const x = (lon + 180) * canvas.width / 360;
          const y = (90 - lat) * canvas.height / 180;
          if (index === 0 || Math.abs(lon - ring[index - 1][0]) > 180) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
    }
  }
  ctx.strokeStyle = 'white';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  return canvas;
}
