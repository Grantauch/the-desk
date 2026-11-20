/* Medal of Honor exhibit imagery. The linked records identify each source and its credit. */
(function () {
  'use strict';

  var records = {
  "freddie-stowers": {
    "caption": "U.S. Army forensic reconstruction from family photographs",
    "credit": "National Park Service",
    "url": "https://www.nps.gov/people/freddie-stowers.htm",
    "alt": "Reconstructed likeness of Freddie Stowers in uniform",
    "label": "Reconstructed portrait"
  },
  "henry-johnson": {
    "caption": "Johnson wearing the French Croix de Guerre",
    "credit": "U.S. Army",
    "url": "https://www.army.mil/medalofhonor/johnson/",
    "alt": "Henry Johnson smiling in uniform, wearing the French Croix de Guerre"
  },
  "william-shemin": {
    "caption": "William Shemin, circa 1918",
    "credit": "U.S. Army via Wikimedia Commons",
    "url": "https://commons.wikimedia.org/wiki/File:William_Shemin_c1918.jpg",
    "alt": "William Shemin wearing his campaign hat"
  },
  "alvin-york": {
    "caption": "Alvin York, 1919",
    "credit": "Underwood & Underwood via Wikimedia Commons",
    "url": "https://commons.wikimedia.org/wiki/File:Alvin_C._York_1919.jpg",
    "alt": "Alvin York in uniform"
  },
  "nelson-holderman": {
    "caption": "Nelson Holderman at camp in 1917, cropped from a group photograph",
    "credit": "Santa Ana Public Library",
    "url": "https://en.wikipedia.org/wiki/File:Holderman_%28San_Luis_Obispo_CA%29.jpg",
    "alt": "Nelson Holderman standing outside a tent in his campaign hat"
  },
  "frank-luke": {
    "caption": "Frank Luke Jr., 1917–18",
    "credit": "Library of Congress",
    "url": "https://commons.wikimedia.org/wiki/File:Frank_Luke_cph.3a45244.jpg",
    "alt": "Frank Luke Jr. in uniform with pilot wings"
  },
  "eddie-rickenbacker": {
    "caption": "Eddie Rickenbacker wearing the Medal of Honor",
    "credit": "U.S. Air Force",
    "url": "https://commons.wikimedia.org/wiki/File:RickenbackerUSAF.jpg",
    "alt": "Eddie Rickenbacker smiling in uniform with the Medal of Honor"
  },
  "samuel-woodfill": {
    "caption": "Lieutenant Samuel Woodfill, 1921",
    "credit": "Library of Congress",
    "url": "https://commons.wikimedia.org/wiki/File:Lieut._Samuel_Woodfill,_10-31-21_LCCN2016845771.jpg",
    "alt": "Samuel Woodfill in military uniform"
  },
  "david-barkley": {
    "caption": "David Bennes Barkley in uniform",
    "credit": "U.S. Army via Wikimedia Commons",
    "url": "https://commons.wikimedia.org/wiki/File:David_Barkley.jpg",
    "alt": "David Barkley in uniform and cap"
  },
  "harold-furlong": {
    "caption": "Harold Furlong at his medal ceremony, 1919, cropped from a press photograph",
    "credit": "The M. A. C. Record, Michigan State University Archives",
    "url": "https://onthebanks.msu.edu/recordFiles/162-565-5893/19190307sm.pdf",
    "alt": "Harold Furlong in profile among other soldiers after receiving the Medal of Honor"
  },
  "william-donovan": {
    "caption": "William J. Donovan in France, September 1918",
    "credit": "U.S. National Archives",
    "url": "https://catalog.archives.gov/id/55209863",
    "alt": "William Donovan in uniform and steel helmet"
  },
  "jake-allex": {
    "caption": "Jake Allex in uniform, published 1921",
    "credit": "Illinois in the World War via Wikimedia Commons",
    "url": "https://commons.wikimedia.org/wiki/File:Corporal_Jake_Allex.jpg",
    "alt": "Jake Allex in uniform wearing his service medals"
  },
  "louis-cukela": {
    "caption": "Captain Louis Cukela, 1920s",
    "credit": "Naval History and Heritage Command, NH 79333",
    "url": "https://commons.wikimedia.org/wiki/File:Cukela_Capt_Louis_USMC_h79333.jpg",
    "alt": "Louis Cukela in dress uniform with his medals"
  },
  "matej-kocak": {
    "caption": "Matej Kocak, photograph reproduced in a U.S. Navy publication",
    "credit": "Naval History and Heritage Command, NH 79442",
    "url": "https://commons.wikimedia.org/wiki/File:Matej_kocak.jpg",
    "alt": "Matej Kocak in his Marine Corps uniform"
  },
  "ernest-janson": {
    "caption": "Ernest Janson at the dedication of the Tomb of the Unknown Soldier, 1921",
    "credit": "U.S. Navy via Wikimedia Commons",
    "url": "https://commons.wikimedia.org/wiki/File:Ernest_Jansen_at_Dedication_of_Tomb_of_Unknown_Soldier%2C_Washington_DC_Nov_11%2C_1921.jpg",
    "alt": "Ernest Janson in dress uniform at the dedication ceremony"
  },
  "weedon-osborne": {
    "caption": "Weedon Osborne, circa 1917–18",
    "credit": "Naval History and Heritage Command, NH 47548",
    "url": "https://commons.wikimedia.org/wiki/File:Weedon_Osborne.jpg",
    "alt": "Weedon Osborne in his Navy uniform"
  },
  "edouard-izac": {
    "caption": "Edouard Izac, photographed under the surname Isaacs, circa 1920",
    "credit": "Harris & Ewing / Naval History and Heritage Command, NH 48836",
    "url": "https://commons.wikimedia.org/wiki/File:Edouard_Izac_Washington_DC.jpg",
    "alt": "Edouard Izac in his Navy uniform"
  },
  "harold-roberts": {
    "caption": "Harold Roberts in a framed photograph. Cropped and resized.",
    "credit": "Camp Roberts Military Museum · CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Corporal_Harold_W._Roberts.jpg",
    "alt": "Framed photograph of Harold Roberts in uniform"
  },
  "sidney-manning": {
    "caption": "Sidney Manning, published 1919",
    "credit": "Alabama’s Own in France via Wikimedia Commons",
    "url": "https://commons.wikimedia.org/wiki/File:Sidney_E._Manning.jpg",
    "alt": "Sidney Manning seated in military uniform"
  },
  "fred-stockham": {
    "caption": "The Army Medal of Honor awarded to Fred Stockham",
    "credit": "U.S. Naval Historical Center, NH 82603",
    "url": "https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/images/h82000/h82603c.htm",
    "alt": "Archival photograph of Fred Stockham’s Medal of Honor",
    "label": "His Medal of Honor"
  },
  "george-robb": {
    "caption": "George S. Robb, published 1919",
    "credit": "Mid-Week Pictorial via Wikimedia Commons",
    "url": "https://commons.wikimedia.org/wiki/File:Robb-George-S-1919.jpg",
    "alt": "George Robb in military uniform"
  }
};

  function image(slug, usage) {
    var record = records[slug];
    var img = document.createElement('img');
    var base = '/hubs/moh/archive/' + slug;
    img.width = 300;
    img.height = 360;
    img.alt = usage === 'profile' ? record.alt : '';
    img.decoding = 'async';
    img.src = base + '-small.webp';
    if (usage === 'thumb') {
      img.loading = 'lazy';
    } else {
      img.srcset = base + '-small.webp 300w, ' + base + '.webp 600w';
      if (usage === 'profile') {
        img.sizes = '(max-width: 650px) min(90vw, 336px), (max-width: 1050px) 33vw, 384px';
        img.fetchPriority = 'high';
      } else {
        img.sizes = '(max-width: 650px) 46vw, (max-width: 950px) 30vw, (max-width: 1350px) 22vw, 300px';
        img.loading = 'lazy';
      }
    }
    return img;
  }

  window.MOH_PORTRAITS = { records: records, image: image };
})();
