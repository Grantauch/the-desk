/*!
 * StoryHub runtime — shared behaviour primitives for GrantDesk StoryHubs.
 *
 * This file is deliberately invisible. It ships no CSS, no markup, no layout and
 * no house look. Every StoryHub supplies its own elements, its own classes and
 * its own art direction, and opts in only to the behaviours it needs.
 *
 * StoryHub has a house level of craft, not a house look.
 *
 * Provides: reduced-motion awareness, scroll progress, section spy, reveal-on-enter,
 * a scroll-driven callback channel, an accessible off-canvas panel, a lightbox with
 * keyboard-operable triggers, and mutually-exclusive choice groups.
 */
(function (global) {
  'use strict';

  var motionQuery = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = motionQuery ? motionQuery.matches : false;
  var motionListeners = [];

  if (motionQuery) {
    var onMotionChange = function (event) {
      reduced = event.matches;
      motionListeners.forEach(function (fn) { try { fn(reduced); } catch (e) { /* keep other listeners alive */ } });
    };
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
    else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);
  }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /** Run a callback on scroll and resize, coalesced into animation frames. */
  function onScroll(callback) {
    var ticking = false;
    var run = function () {
      ticking = false;
      callback();
    };
    var request = function () {
      if (ticking) return;
      ticking = true;
      (global.requestAnimationFrame || setTimeout)(run);
    };
    document.addEventListener('scroll', request, { passive: true });
    global.addEventListener('resize', request, { passive: true });
    callback();
    return request;
  }

  /** Width-based reading progress for the whole document. */
  function scrollProgress(bar) {
    if (!bar) return;
    var doc = document.documentElement;
    onScroll(function () {
      var max = doc.scrollHeight - doc.clientHeight;
      bar.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
    });
  }

  /** Report the most visible labelled section as the reader moves through the story. */
  function sectionSpy(options) {
    var nodes = $$(options.selector);
    if (!nodes.length || !('IntersectionObserver' in global)) return;
    var observer = new IntersectionObserver(function (entries) {
      var best = entries
        .filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; })[0];
      if (best) options.onChange(best.target.dataset[options.dataKey || 'label'] || options.fallback || '', best.target);
    }, { rootMargin: options.rootMargin || '-18% 0px -64% 0px', threshold: [0, 0.1, 0.3] });
    nodes.forEach(function (node) { observer.observe(node); });
  }

  /** Add a class the first time an element enters the viewport. Falls back to always-on. */
  function revealOnEnter(selector, activeClass) {
    var nodes = $$(selector);
    var cls = activeClass || 'on';
    if (!('IntersectionObserver' in global)) {
      nodes.forEach(function (node) { node.classList.add(cls); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add(cls);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.07 });
    nodes.forEach(function (node) { observer.observe(node); });
  }

  /**
   * Scroll-driven motion, skipped entirely when the reader asks for reduced motion
   * or when the viewport is below `minWidth`. `reset` restores the static state.
   */
  function scrollMotion(options) {
    var active = false;
    var apply = function () {
      var allowed = !reduced && global.innerWidth > (options.minWidth || 0);
      if (!allowed) {
        if (active && options.reset) options.reset();
        active = false;
        return;
      }
      active = true;
      options.update();
    };
    onMotionPreferenceChange(apply);
    return onScroll(apply);
  }

  /** Accessible off-canvas panel: inert while closed, focus moved in and restored out. */
  function panel(options) {
    var node = options.panel;
    var shade = options.shade;
    var opener = options.openButton;
    var closer = options.closeButton;
    if (!node || !opener) return null;
    var lastFocus = null;

    var setClosed = function () {
      node.classList.remove(options.openClass || 'on');
      if (shade) shade.classList.remove(options.openClass || 'on');
      node.setAttribute('aria-hidden', 'true');
      node.inert = true;
      opener.setAttribute('aria-expanded', 'false');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    };
    var setOpen = function () {
      lastFocus = document.activeElement;
      node.classList.add(options.openClass || 'on');
      if (shade) shade.classList.add(options.openClass || 'on');
      node.setAttribute('aria-hidden', 'false');
      node.inert = false;
      opener.setAttribute('aria-expanded', 'true');
      if (closer && closer.focus) closer.focus();
    };

    node.setAttribute('aria-hidden', 'true');
    node.inert = true;
    opener.setAttribute('aria-expanded', 'false');
    opener.addEventListener('click', setOpen);
    if (closer) closer.addEventListener('click', setClosed);
    if (shade) shade.addEventListener('click', setClosed);
    $$('a', node).forEach(function (link) { link.addEventListener('click', setClosed); });
    return { open: setOpen, close: setClosed, isOpen: function () { return !node.inert; } };
  }

  /**
   * Lightbox over a native <dialog>, which supplies the focus trap, Escape handling
   * and focus restoration. Triggers become real keyboard-operable controls.
   */
  function lightbox(options) {
    var dialog = options.dialog;
    if (!dialog || !dialog.showModal) return null;
    var image = options.image;
    var label = options.label;

    var show = function (src, alt, caption) {
      if (image) { image.src = src; image.alt = alt || ''; }
      if (label) label.textContent = caption || alt || 'Image';
      dialog.showModal();
    };

    $$(options.triggerSelector || '[data-lightbox]').forEach(function (node) {
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-haspopup', 'dialog');
      var open = function () { show(node.currentSrc || node.src, node.alt, node.dataset.caption || node.alt); };
      node.addEventListener('click', open);
      node.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
        event.preventDefault();
        open();
      });
    });

    if (options.closeButton) options.closeButton.addEventListener('click', function () { dialog.close(); });
    return { show: show, close: function () { dialog.close(); } };
  }

  /**
   * A set of buttons where exactly one is chosen. Keeps `aria-pressed` truthful and
   * every option reachable by Tab, so no roving-tabindex trap is introduced.
   */
  function choiceGroup(options) {
    var buttons = $$(options.selector);
    if (!buttons.length) return null;
    var activeClass = options.activeClass || 'active';
    var select = function (button) {
      buttons.forEach(function (other) {
        var on = other === button;
        other.classList.toggle(activeClass, on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      options.onSelect(button);
    };
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains(activeClass) ? 'true' : 'false');
      button.addEventListener('click', function () { select(button); });
    });
    var initial = buttons.filter(function (b) { return b.classList.contains(activeClass); })[0] || buttons[0];
    select(initial);
    return { select: select, buttons: buttons };
  }

  function onMotionPreferenceChange(fn) { motionListeners.push(fn); }

  global.StoryHub = {
    get reducedMotion() { return reduced; },
    onMotionPreferenceChange: onMotionPreferenceChange,
    onScroll: onScroll,
    scrollProgress: scrollProgress,
    sectionSpy: sectionSpy,
    revealOnEnter: revealOnEnter,
    scrollMotion: scrollMotion,
    panel: panel,
    lightbox: lightbox,
    choiceGroup: choiceGroup,
    $: $,
    $$: $$,
  };
})(window);
