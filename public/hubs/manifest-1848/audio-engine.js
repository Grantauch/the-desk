/**
 * ManifestAudio — Zero-Dependency Web Audio API Sound & Procedural Loop Engine
 * Designed for "Manifest: 1848" (1848 Saloon Cowboy Card Table + Modernized Americana)
 *
 * Usage:
 *   ManifestAudio.play('dealerShuffle');
 *   ManifestAudio.play('dealerDealHand');
 *   ManifestAudio.play('cardSlamPlay');
 *   ManifestAudio.play('tableKnock');
 *   ManifestAudio.play('anteChipClink');
 *   ManifestAudio.startLoop('saloonTable'); // 'saloonTable' | 'camp' | 'river'
 */
window.ManifestAudio = (() => {
  let ctx = null;
  let masterGain = null;
  let analyser = null;
  let isMuted = false;
  let currentVolume = 0.8;
  let noiseBuffer = null;

  const activeLoops = {
    saloonTable: null,
    camp: null,
    river: null
  };

  function ensureContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : currentVolume;

      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      masterGain.connect(analyser);
      analyser.connect(ctx.destination);

      // 3 seconds of white noise for linen cardstock, oak friction, wind, water & fire
      const bufferSize = ctx.sampleRate * 3;
      noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function createNoiseSource() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  // Optional stereo panner helper (gracefully falls back if StereoPannerNode unavailable)
  function connectWithPan(node, panValue = 0, destination = masterGain) {
    if (ctx.createStereoPanner && panValue !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, panValue));
      node.connect(panner);
      panner.connect(destination);
    } else {
      node.connect(destination);
    }
  }

  // Helper: Solid 1848 saloon oak table knock/thud resonance
  function oakThud(time, pitch = 135, volume = 0.4, pan = 0) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, time);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.42, time + 0.075);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.085);

    osc.connect(gain);
    connectWithPan(gain, pan);
    osc.start(time);
    osc.stop(time + 0.09);

    // Woody transient bark
    const bark = createNoiseSource();
    const bp = ctx.createBiquadFilter();
    const bGain = ctx.createGain();
    bp.type = 'bandpass';
    bp.frequency.value = pitch * 5.2;
    bp.Q.value = 3.0;
    bGain.gain.setValueAtTime(volume * 0.55, time);
    bGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    bark.connect(bp);
    bp.connect(bGain);
    connectWithPan(bGain, pan);
    bark.start(time);
    bark.stop(time + 0.035);
  }

  // Helper: Single heavy linen-embossed card flick + worn oak table slide
  function flickAndSlideCard(time, pan = 0, intensity = 1.0) {
    // 1. Crisp thumb-flick snap off the deck
    const flick = createNoiseSource();
    const fFilter = ctx.createBiquadFilter();
    const fGain = ctx.createGain();
    fFilter.type = 'bandpass';
    fFilter.frequency.setValueAtTime(2400 + (Math.random() - 0.5) * 350, time);
    fFilter.Q.value = 2.4;

    fGain.gain.setValueAtTime(0.34 * intensity, time);
    fGain.gain.exponentialRampToValueAtTime(0.001, time + 0.032);

    flick.connect(fFilter);
    fFilter.connect(fGain);
    connectWithPan(fGain, pan * 0.4);
    flick.start(time);
    flick.stop(time + 0.036);

    // 2. Air-whip & dry linen slide across the oak table
    const slideStart = time + 0.022;
    const slide = createNoiseSource();
    const sFilter = ctx.createBiquadFilter();
    const sGain = ctx.createGain();
    sFilter.type = 'bandpass';
    sFilter.frequency.setValueAtTime(1650, slideStart);
    sFilter.frequency.exponentialRampToValueAtTime(920, slideStart + 0.085);
    sFilter.Q.value = 1.5;

    sGain.gain.setValueAtTime(0.001, slideStart);
    sGain.gain.linearRampToValueAtTime(0.22 * intensity, slideStart + 0.015);
    sGain.gain.exponentialRampToValueAtTime(0.001, slideStart + 0.095);

    slide.connect(sFilter);
    sFilter.connect(sGain);
    connectWithPan(sGain, pan);
    slide.start(slideStart);
    slide.stop(slideStart + 0.1);
  }

  // Helper: Plucked 1848 dobro/banjo string harmonic
  function pluckString(freq, startTime, duration = 1.4, volume = 0.25) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);
    osc2.frequency.setValueAtTime(freq * 2, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 7.5, startTime);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.15, startTime + duration * 0.7);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
  }

  const sfxLibrary = {
    // =========================================================================
    // 1. COWBOY CARD TABLE & LIVE DEALER SFX
    // =========================================================================

    // Faro/bridge rifle shuffle of thick waxed linen cards + oak square-up tap
    dealerShuffle(now) {
      const cardCount = 16;
      for (let i = 0; i < cardCount; i++) {
        // Accelerating rifle curve like two halves cascading together
        const progress = i / cardCount;
        const t = now + Math.pow(progress, 0.85) * 0.34;
        const pan = (i % 2 === 0 ? -0.22 : 0.22) * (1 - progress * 0.6);

        const snap = createNoiseSource();
        const bp = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        bp.type = 'bandpass';
        bp.frequency.value = 1850 + (i % 4) * 240 + Math.random() * 180;
        bp.Q.value = 2.8;

        gain.gain.setValueAtTime(0.26, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.024);

        snap.connect(bp);
        bp.connect(gain);
        connectWithPan(gain, pan);
        snap.start(t);
        snap.stop(t + 0.028);
      }

      // Bridge push-together whoosh
      const bridgeTime = now + 0.36;
      const bridge = createNoiseSource();
      const bFilter = ctx.createBiquadFilter();
      const bGain = ctx.createGain();
      bFilter.type = 'bandpass';
      bFilter.frequency.setValueAtTime(1100, bridgeTime);
      bFilter.frequency.linearRampToValueAtTime(2100, bridgeTime + 0.09);
      bGain.gain.setValueAtTime(0.001, bridgeTime);
      bGain.gain.linearRampToValueAtTime(0.22, bridgeTime + 0.03);
      bGain.gain.exponentialRampToValueAtTime(0.001, bridgeTime + 0.11);
      bridge.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(masterGain);
      bridge.start(bridgeTime);
      bridge.stop(bridgeTime + 0.12);

      // Dealer double-tap on oak to square the deck
      oakThud(now + 0.50, 145, 0.34, 0);
      oakThud(now + 0.61, 152, 0.38, 0);
    },

    // Heavy two-part deck cut and solid oak table slap
    dealerCut(now) {
      // Lift & shear friction between heavy waxed packets
      const shear = createNoiseSource();
      const sFilter = ctx.createBiquadFilter();
      const sGain = ctx.createGain();
      sFilter.type = 'bandpass';
      sFilter.frequency.setValueAtTime(1350, now);
      sFilter.frequency.linearRampToValueAtTime(1950, now + 0.08);
      sGain.gain.setValueAtTime(0.25, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      shear.connect(sFilter);
      sFilter.connect(sGain);
      connectWithPan(sGain, -0.25);
      shear.start(now);
      shear.stop(now + 0.095);

      // Bottom half set down on oak
      oakThud(now + 0.09, 130, 0.38, -0.25);

      // Top half slapped firmly onto bottom packet
      oakThud(now + 0.24, 155, 0.48, 0.1);
      const slap = createNoiseSource();
      const hp = ctx.createBiquadFilter();
      const slapGain = ctx.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 1700;
      slapGain.gain.setValueAtTime(0.32, now + 0.24);
      slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
      slap.connect(hp);
      hp.connect(slapGain);
      slapGain.connect(masterGain);
      slap.start(now + 0.24);
      slap.stop(now + 0.3);
    },

    // Fast, snappy thumb-flick off top of deck + light oak slide
    dealerDealSingle(now) {
      flickAndSlideCard(now, 0.15, 1.0);
    },

    // Rapid 5-card dealer pitch with human timing micro-jitter & L-to-R stereo pan
    dealerDealHand(now) {
      const pans = [-0.55, -0.28, 0.0, 0.28, 0.55];
      let cursor = now;
      pans.forEach((pan, idx) => {
        flickAndSlideCard(cursor, pan, 0.95 + (idx === 4 ? 0.12 : 0));
        // Subtle light tap as each card settles into the player's hand zone
        oakThud(cursor + 0.075, 195 + idx * 6, 0.14, pan);
        // Human dealer rhythm (~115ms + micro-jitter)
        cursor += 0.112 + (Math.random() - 0.5) * 0.018;
      });
    },

    // Tactile dry cardstock edge-brush / thumb-peek
    cardHover(now) {
      const brush = createNoiseSource();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, now);
      bp.frequency.linearRampToValueAtTime(2550, now + 0.055);
      bp.Q.value = 2.2;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      brush.connect(bp);
      bp.connect(gain);
      gain.connect(masterGain);
      brush.start(now);
      brush.stop(now + 0.07);
    },

    // Crisp snap of lifting a heavy waxed card off worn oak
    cardPickUp(now) {
      // Micro suction release click
      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.025);
      oGain.gain.setValueAtTime(0.18, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(oGain);
      oGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.035);

      // Linen flex snap
      const flex = createNoiseSource();
      const bp = ctx.createBiquadFilter();
      const fGain = ctx.createGain();
      bp.type = 'bandpass';
      bp.frequency.value = 2300;
      bp.Q.value = 2.0;
      fGain.gain.setValueAtTime(0.28, now + 0.008);
      fGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      flex.connect(bp);
      bp.connect(fGain);
      fGain.connect(masterGain);
      flex.start(now + 0.008);
      flex.stop(now + 0.06);
    },

    // Authoritative saloon table slap: heavy card snap + oak thud + modern sub-bass punch
    cardSlamPlay(now) {
      // 1. Modern punchy sub-bass drop for contemporary weight
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(145, now);
      sub.frequency.exponentialRampToValueAtTime(40, now + 0.19);
      subGain.gain.setValueAtTime(0.62, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      sub.connect(subGain);
      subGain.connect(masterGain);
      sub.start(now);
      sub.stop(now + 0.22);

      // 2. Solid saloon oak table thud
      oakThud(now, 165, 0.55, 0);

      // 3. Sharp cardstock slap transient
      const slap = createNoiseSource();
      const hp = ctx.createBiquadFilter();
      const sGain = ctx.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 1550;
      sGain.gain.setValueAtTime(0.45, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      slap.connect(hp);
      hp.connect(sGain);
      sGain.connect(masterGain);
      slap.start(now);
      slap.stop(now + 0.07);
    },

    // Quick angled flick-slide into the muck / discard pile
    cardFoldDiscard(now) {
      flickAndSlideCard(now, -0.45, 0.85);
      // Soft landing brush into discard stack
      const land = createNoiseSource();
      const lp = ctx.createBiquadFilter();
      const lGain = ctx.createGain();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      lGain.gain.setValueAtTime(0.18, now + 0.09);
      lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      land.connect(lp);
      lp.connect(lGain);
      connectWithPan(lGain, -0.5);
      land.start(now + 0.09);
      land.stop(now + 0.17);
    },

    // Single dry card flicked face-down into burn stack with muffled oak tap
    cardBurn(now) {
      flickAndSlideCard(now, 0.42, 0.72);
      oakThud(now + 0.07, 118, 0.22, 0.45);
    },

    // Cowboy "check" / pass: two crisp knuckle knocks on solid oak wood
    tableKnock(now) {
      oakThud(now, 175, 0.52, 0);
      oakThud(now + 0.145, 188, 0.58, 0);
    },

    // Heavy 1848 brass/silver dollar & clay poker chip clink onto the pot
    anteChipClink(now) {
      // Clay poker chip click
      oakThud(now, 310, 0.3, 0.1);

      // High-Q metallic silver/brass ring partials (inharmonic coin resonance)
      const partials = [2180, 3490, 5120, 6840];
      partials.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + 0.015);
        gain.gain.setValueAtTime(0.16 / (idx + 1), now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.48 - idx * 0.05);
        osc.connect(gain);
        connectWithPan(gain, 0.1);
        osc.start(now + 0.015);
        osc.stop(now + 0.5);
      });

      // Secondary coin settle clink
      [2240, 3610].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + 0.09);
        gain.gain.setValueAtTime(0.09, now + 0.09);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.35);
        osc.connect(gain);
        connectWithPan(gain, 0.12);
        osc.start(now + 0.09);
        osc.stop(now + 0.36);
      });
    },

    // =========================================================================
    // 2. TRAIL UI, POSITIVE & NEGATIVE CUES
    // =========================================================================

    // Mechanical brass-latch / wooden saloon click with subtle sub-thump
    buttonPress(now) {
      oakThud(now, 195, 0.38, 0);
      const latch = ctx.createOscillator();
      const lGain = ctx.createGain();
      latch.type = 'sine';
      latch.frequency.setValueAtTime(1650, now);
      latch.frequency.exponentialRampToValueAtTime(920, now + 0.025);
      lGain.gain.setValueAtTime(0.16, now);
      lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      latch.connect(lGain);
      lGain.connect(masterGain);
      latch.start(now);
      latch.stop(now + 0.035);
    },

    // Crisp brass telegraph key tap with warm canyon room tail
    telegraph(now) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(790, now);
      osc.frequency.setValueAtTime(775, now + 0.022);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.065);

      // Subtle mechanical armature click
      oakThud(now, 420, 0.15, 0);
    },

    // Bright dobro/banjo harmonic pluck + silver coin ring + warm modern synth chime
    positive(now) {
      const notes = [293.66, 369.99, 440.00, 659.25]; // D major 9th
      notes.forEach((freq, idx) => {
        const t = now + idx * 0.062;
        pluckString(freq, t, 1.35, 0.22);

        const chime = ctx.createOscillator();
        const cGain = ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(freq * 2, t);
        cGain.gain.setValueAtTime(0.001, t);
        cGain.gain.linearRampToValueAtTime(0.11, t + 0.015);
        cGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.9);
        chime.connect(cGain);
        cGain.connect(masterGain);
        chime.start(t);
        chime.stop(t + 0.95);
      });
    },

    // Canvas sack drop + iron/brass clink
    supplyGained(now) {
      const rustle = createNoiseSource();
      const rFilter = ctx.createBiquadFilter();
      const rGain = ctx.createGain();
      rFilter.type = 'bandpass';
      rFilter.frequency.value = 920;
      rGain.gain.setValueAtTime(0.001, now);
      rGain.gain.linearRampToValueAtTime(0.3, now + 0.04);
      rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      rustle.connect(rFilter);
      rFilter.connect(rGain);
      rGain.connect(masterGain);
      rustle.start(now);
      rustle.stop(now + 0.23);

      [1480, 2340, 3890].forEach((freq, idx) => {
        const t = now + 0.07 + idx * 0.045;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.35);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.36);
      });
    },

    // Modernized 1848 frontier brass + acoustic guitar + sub-bass victory fanfare
    milestoneFanfare(now) {
      const stomp = ctx.createOscillator();
      const sGain = ctx.createGain();
      stomp.type = 'sine';
      stomp.frequency.setValueAtTime(112, now);
      stomp.frequency.exponentialRampToValueAtTime(36, now + 0.36);
      sGain.gain.setValueAtTime(0.65, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      stomp.connect(sGain);
      sGain.connect(masterGain);
      stomp.start(now);
      stomp.stop(now + 0.44);

      const chord = [146.83, 220.00, 293.66, 369.99, 440.00];
      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + 0.05);
        osc.detune.setValueAtTime((i - 2) * 6, now + 0.05);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(420, now + 0.05);
        filter.frequency.exponentialRampToValueAtTime(2850, now + 0.65);
        filter.frequency.exponentialRampToValueAtTime(900, now + 2.2);

        gain.gain.setValueAtTime(0.001, now + 0.05);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(now + 0.05);
        osc.stop(now + 2.35);
      });

      pluckString(587.33, now + 0.35, 1.8, 0.22);
      pluckString(880.00, now + 0.50, 1.8, 0.18);
    },

    // Dissonant low resonator twang + splintering oak crack + gritty sub-bass drop
    negative(now) {
      // Dissonant resonator twang (D2 + G#2 tritone bend)
      pluckString(73.42, now, 0.9, 0.28);
      pluckString(103.83, now + 0.02, 0.85, 0.24);

      // Gritty sub-bass drop
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(98, now);
      sub.frequency.exponentialRampToValueAtTime(31, now + 0.55);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(340, now);
      lp.frequency.exponentialRampToValueAtTime(70, now + 0.55);

      subGain.gain.setValueAtTime(0.55, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      sub.connect(lp);
      lp.connect(subGain);
      subGain.connect(masterGain);
      sub.start(now);
      sub.stop(now + 0.62);

      // Splintering oak crack transient
      [0, 0.035, 0.07].forEach((offset) => {
        const crack = createNoiseSource();
        const bp = ctx.createBiquadFilter();
        const cGain = ctx.createGain();
        bp.type = 'bandpass';
        bp.frequency.value = 1250 + Math.random() * 900;
        cGain.gain.setValueAtTime(0.34, now + offset);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
        crack.connect(bp);
        bp.connect(cGain);
        cGain.connect(masterGain);
        crack.start(now + offset);
        crack.stop(now + offset + 0.055);
      });
    },

    // Low ominous sub rumble + rushing water surge
    riverWarning(now) {
      const water = createNoiseSource();
      const filter = ctx.createBiquadFilter();
      const wGain = ctx.createGain();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.linearRampToValueAtTime(780, now + 0.45);
      filter.frequency.linearRampToValueAtTime(280, now + 1.1);
      filter.Q.value = 1.2;

      wGain.gain.setValueAtTime(0.001, now);
      wGain.gain.linearRampToValueAtTime(0.38, now + 0.35);
      wGain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

      water.connect(filter);
      filter.connect(wGain);
      wGain.connect(masterGain);
      water.start(now);
      water.stop(now + 1.2);

      [73.42, 103.83].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.28);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 260;

        gain.gain.setValueAtTime(0.001, now + i * 0.28);
        gain.gain.linearRampToValueAtTime(0.32, now + i * 0.28 + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.28 + 0.55);

        osc.connect(lp);
        lp.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.28);
        osc.stop(now + i * 0.28 + 0.6);
      });
    }
  };

  // ===========================================================================
  // 3. PROCEDURAL AMBIENT LOOPS
  // ===========================================================================

  // 1848 Saloon Card Table Room Bed (Hearth crackle, distant upright piano & glass clinks)
  function buildSaloonTableLoop() {
    const now = ctx.currentTime;
    const loopGain = ctx.createGain();
    loopGain.gain.setValueAtTime(0.001, now);
    loopGain.gain.linearRampToValueAtTime(0.5, now + 1.2);
    loopGain.connect(masterGain);

    // Warm low saloon room murmur (filtered brownian-like noise)
    const room = createNoiseSource();
    const lp = ctx.createBiquadFilter();
    const rGain = ctx.createGain();
    lp.type = 'lowpass';
    lp.frequency.value = 210;
    rGain.gain.value = 0.22;
    room.connect(lp);
    lp.connect(rGain);
    rGain.connect(loopGain);
    room.start(now);

    // Subtle hearth/lantern ember pops
    const hearthTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      if (Math.random() > 0.45) {
        const t = ctx.currentTime;
        const pop = createNoiseSource();
        const hp = ctx.createBiquadFilter();
        const pGain = ctx.createGain();
        hp.type = 'highpass';
        hp.frequency.value = 2400 + Math.random() * 2200;
        pGain.gain.setValueAtTime(0.05 + Math.random() * 0.08, t);
        pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        pop.connect(hp);
        hp.connect(pGain);
        connectWithPan(pGain, -0.65, loopGain);
        pop.start(t);
        pop.stop(t + 0.03);
      }
    }, 240);

    // Distant muffled upright saloon piano chords & occasional whiskey glass clink
    const saloonChords = [
      [146.83, 220.00, 293.66], // Dm
      [174.61, 220.00, 261.63], // F
      [130.81, 196.00, 261.63], // C
      [110.00, 164.81, 220.00]  // Am
    ];
    let chordIdx = 0;

    const pianoTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const chord = saloonChords[chordIdx % saloonChords.length];
      chordIdx++;

      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'triangle';
        // Slight honky-tonk detune for 1848 upright character
        osc.frequency.setValueAtTime(freq, t + i * 0.08);
        osc.detune.setValueAtTime((i % 2 === 0 ? 9 : -7), t + i * 0.08);

        filter.type = 'lowpass';
        filter.frequency.value = 520; // Muffled through saloon room

        g.gain.setValueAtTime(0.001, t + i * 0.08);
        g.gain.linearRampToValueAtTime(0.075, t + i * 0.08 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0005, t + i * 0.08 + 1.8);

        osc.connect(filter);
        filter.connect(g);
        connectWithPan(g, 0.55, loopGain);
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 1.85);
      });

      // Occasional distant whiskey glass clink
      if (Math.random() > 0.55) {
        const gt = t + 0.9;
        const glass = ctx.createOscillator();
        const gg = ctx.createGain();
        glass.type = 'sine';
        glass.frequency.value = 2850 + Math.random() * 450;
        gg.gain.setValueAtTime(0.035, gt);
        gg.gain.exponentialRampToValueAtTime(0.0005, gt + 0.28);
        glass.connect(gg);
        connectWithPan(gg, -0.45, loopGain);
        glass.start(gt);
        glass.stop(gt + 0.3);
      }
    }, 2600);

    return {
      stop() {
        clearInterval(hearthTimer);
        clearInterval(pianoTimer);
        const t = ctx.currentTime;
        loopGain.gain.setValueAtTime(loopGain.gain.value, t);
        loopGain.gain.linearRampToValueAtTime(0.0001, t + 0.6);
        setTimeout(() => {
          try { room.stop(); } catch (e) {}
        }, 650);
      }
    };
  }

  function buildCampLoop() {
    const now = ctx.currentTime;
    const loopGain = ctx.createGain();
    loopGain.gain.setValueAtTime(0.001, now);
    loopGain.gain.linearRampToValueAtTime(0.55, now + 1.2);
    loopGain.connect(masterGain);

    const padOscs = [73.42, 110.00, 174.61].map((freq, idx) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (idx - 1) * 5;
      lp.type = 'lowpass';
      lp.frequency.value = 340;
      g.gain.value = idx === 0 ? 0.28 : 0.12;
      osc.connect(lp);
      lp.connect(g);
      g.connect(loopGain);
      osc.start(now);
      return osc;
    });

    const wind = createNoiseSource();
    const windFilter = ctx.createBiquadFilter();
    const windGain = ctx.createGain();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 380;
    windFilter.Q.value = 2.2;
    windGain.gain.value = 0.09;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.14;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(loopGain);
    wind.start(now);
    lfo.start(now);

    const crackleTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      if (Math.random() > 0.35) {
        const t = ctx.currentTime;
        const pop = createNoiseSource();
        const bp = ctx.createBiquadFilter();
        const pGain = ctx.createGain();
        bp.type = 'highpass';
        bp.frequency.value = 2200 + Math.random() * 2500;
        pGain.gain.setValueAtTime(0.08 + Math.random() * 0.12, t);
        pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02 + Math.random() * 0.025);
        pop.connect(bp);
        bp.connect(pGain);
        pGain.connect(loopGain);
        pop.start(t);
        pop.stop(t + 0.05);
      }
    }, 180);

    return {
      stop() {
        clearInterval(crackleTimer);
        const t = ctx.currentTime;
        loopGain.gain.setValueAtTime(loopGain.gain.value, t);
        loopGain.gain.linearRampToValueAtTime(0.0001, t + 0.6);
        setTimeout(() => {
          padOscs.forEach(o => { try { o.stop(); } catch (e) {} });
          try { wind.stop(); lfo.stop(); } catch (e) {}
        }, 650);
      }
    };
  }

  function buildRiverLoop() {
    const now = ctx.currentTime;
    const loopGain = ctx.createGain();
    loopGain.gain.setValueAtTime(0.001, now);
    loopGain.gain.linearRampToValueAtTime(0.55, now + 0.8);
    loopGain.connect(masterGain);

    const water = createNoiseSource();
    const wFilter = ctx.createBiquadFilter();
    const wGain = ctx.createGain();
    wFilter.type = 'bandpass';
    wFilter.frequency.value = 460;
    wFilter.Q.value = 0.9;
    wGain.gain.value = 0.22;
    water.connect(wFilter);
    wFilter.connect(wGain);
    wGain.connect(loopGain);
    water.start(now);

    const bassNotes = [36.71, 36.71, 43.65, 36.71, 49.00, 49.00, 51.91, 43.65];
    let step = 0;
    const pulseTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const freq = bassNotes[step % bassNotes.length];
      step++;

      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(360, t);
      lp.frequency.exponentialRampToValueAtTime(95, t + 0.19);

      g.gain.setValueAtTime(0.42, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.21);

      osc.connect(lp);
      lp.connect(g);
      g.connect(loopGain);
      osc.start(t);
      osc.stop(t + 0.22);
    }, 234);

    return {
      stop() {
        clearInterval(pulseTimer);
        const t = ctx.currentTime;
        loopGain.gain.setValueAtTime(loopGain.gain.value, t);
        loopGain.gain.linearRampToValueAtTime(0.0001, t + 0.5);
        setTimeout(() => {
          try { water.stop(); } catch (e) {}
        }, 550);
      }
    };
  }

  return {
    play(soundName) {
      ensureContext();
      if (sfxLibrary[soundName]) {
        sfxLibrary[soundName](ctx.currentTime);
        return true;
      }
      return false;
    },
    startLoop(loopName) {
      ensureContext();
      if (activeLoops[loopName]) return;
      if (loopName === 'saloonTable') activeLoops.saloonTable = buildSaloonTableLoop();
      if (loopName === 'camp') activeLoops.camp = buildCampLoop();
      if (loopName === 'river') activeLoops.river = buildRiverLoop();
    },
    stopLoop(loopName) {
      if (activeLoops[loopName]) {
        activeLoops[loopName].stop();
        activeLoops[loopName] = null;
      }
    },
    toggleLoop(loopName) {
      if (activeLoops[loopName]) {
        this.stopLoop(loopName);
        return false;
      } else {
        this.startLoop(loopName);
        return true;
      }
    },
    stopAllLoops() {
      Object.keys(activeLoops).forEach((k) => this.stopLoop(k));
    },
    setVolume(val) {
      currentVolume = Number.isFinite(Number(val)) ? Math.max(0, Math.min(1, Number(val))) : currentVolume;
      if (masterGain && !isMuted) {
        masterGain.gain.setValueAtTime(currentVolume, ctx.currentTime);
      }
    },
    setMuted(muted) {
      isMuted = Boolean(muted);
      if (masterGain) {
        masterGain.gain.setValueAtTime(isMuted ? 0 : currentVolume, ctx.currentTime);
      }
      return isMuted;
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    getAnalyser() {
      return analyser;
    }
  };
})();