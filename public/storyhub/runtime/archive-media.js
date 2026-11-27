// Do not call an illustration or a blank panel archival evidence.
// Keep the archive record link in the markup; change only the media's label.
(() => {
  for (const media of document.querySelectorAll("[data-archive-media]")) {
    const image = media.querySelector("[data-archive-image]");
    const label = media.querySelector("[data-archive-label]");
    if (!image || !label) continue;

    let usingFallback = false;
    const unavailable = label.textContent;
    const fallbackLabel = "MODERN ILLUSTRATION · NOT ARCHIVAL · ";
    const setState = (state, alt, caption) => {
      media.dataset.archiveState = state;
      image.alt = alt;
      if (state === "unavailable") image.style.visibility = "hidden";
      else image.style.removeProperty("visibility");
      label.textContent = caption;
    };
    const verify = () => {
      if (!image.complete) return;
      if (image.naturalWidth > 0) {
        if (usingFallback) setState("illustration", image.dataset.archiveFallbackAlt || "Modern editorial illustration; not archival.", fallbackLabel);
        else setState("archival", image.dataset.archiveAlt || "", label.dataset.archiveLoadedLabel || "");
      } else {
        setState("unavailable", "", unavailable);
        const fallback = image.dataset.archiveFallback;
        if (usingFallback || !fallback) return;
        usingFallback = true;
        image.src = fallback;
        // The second resource can already be in the device cache.
        if (image.complete && image.naturalWidth > 0) verify();
      }
    };
    image.addEventListener("load", verify);
    image.addEventListener("error", verify);
    // Handle both success and failure that preceded script startup.
    verify();
  }
})();
