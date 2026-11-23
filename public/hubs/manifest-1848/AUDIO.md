# Manifest: 1848 audio

Grant supplied and authorized these tracks for integration on November 22, 2026:

- `Copper_and_Talon.mp4` → `audio/copper-and-talon.m4a`: recurring main theme.
- `Copper_Sky_Over_the_Plains.mp3` → `audio/copper-sky.m4a`: camp interlude.
- `West_of_the_Divide.mp4` → `audio/west-of-the-divide.m4a`: full-game successful ending only.
- Supplied ManifestAudio JavaScript → `audio-engine.js`: procedural effects and ambience, with saloon fade routing, finite volume validation, and suspension fixes.

Audio derivatives are stereo AAC at 160 kbps with 5 dB attenuation for mixing headroom. The original video artwork is not loaded during gameplay. Songs stream after interaction; gameplay works if media or Web Audio is unavailable. Master Sound preferences use the existing preference key. Hidden tabs pause audio. No game saves or gameplay rules were changed.

`endScreen(true)` is the only game call that enables the ending song. Ordinary encounters use procedural fanfares. Full victory follows the final boss rewards; neither the Columbia phase transition nor defeat enables the song. Leaving the ending returns to the main theme.

Run `node scripts/test-manifest-audio.cjs` for audio-state regressions. Canonical verification and protected CI are separate requirements. Physical-device listening and exact musical loop seams remain manual acceptance checks.
