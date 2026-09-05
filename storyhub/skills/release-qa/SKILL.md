# StoryHub Release QA

## Purpose

Gate StoryHub publication without turning QA into a visual template.

## Checks

- Historical claims, dates, scale, named-person identity, and corrections are defensible and sourced.
- Generated/reconstructed imagery is not presented as primary evidence.
- Named-person visual-anchor decisions are explicit.
- Every interaction teaches something and has a static/reduced-motion fallback.
- Interface looks born from the approved assets rather than like generic app chrome placed around them.
- Story DNA is complete and visibly distinct from prior StoryHubs.
- Keyboard, touch, focus states, reduced motion, responsive crop, and small Chromebook windows work.
- Core information does not depend on hover or animation.
- Public assets have reviewed provenance/rights status and no private/local paths leak into manifests.
- StoryHub manifests pass `npm run storyhub:validate` and the repository passes canonical `npm run verify`.

The release question is not 'does this look like L014?' It is 'does this reach the StoryHub craft level while belonging unmistakably to its own story?' 