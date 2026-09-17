# Audio sources

The game uses local, decoded sample recordings instead of live oscillator/noise synthesis. All shipped audio is CC0 1.0 (public-domain dedication); no Doom, Blood, or other commercial-game sound files are included. Sources and their license declarations were checked on 2026-09-05.

| Shipped files under `public/audio/` | Creator / collection | Source and license |
| --- | --- | --- |
| `shotgun-0..2.ogg`, `cult-shot.ogg` | Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney — The Free Firearm Sound Library | [Source](https://opengameart.org/content/the-free-firearm-sound-library), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The source page explicitly reproduces the library team's CC0 declaration. |
| `reload.ogg`, `shell.ogg` | zer0_sol — Shotgun Reload Sound effects | [Creator's upload](https://opengameart.org/content/shotgun-reload-sound-effects), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `step-0..3.ogg`, `punch-0..2.ogg`, `wood-0..2.ogg`, `metal-0..2.ogg`, `stone-0..2.ogg`, `bone.ogg`, `cloth.ogg` | Kenney — Impact Sounds | [Creator's source](https://kenney.nl/assets/impact-sounds), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Original bundled license retained as `public/audio/KENNEY-LICENSE.txt`. |
| `slime-0..2.ogg`, `wet-room.ogg` | rubberduck — 40 CC0 water / splash / slime SFX | [Creator's upload](https://opengameart.org/content/40-cc0-water-splash-slime-sfx), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `monster-0..5.ogg` | AbNormalHumanBeing — Enemy sounds | [Creator's upload](https://opengameart.org/content/enemy-sounds), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Selected first and third groups: edited camel recordings by AntumDeluge and zombie recordings by Proxy Games, credited in the source upload. |

## Processing and integration

`public/audio/manifest.json` records each exact original archive path, trim offset, duration limit and FFmpeg filters. Firearm source: `Prepared SFX Library/Mossberg/N_26P.wav` (three distinct shots) and `Prepared SFX Library/1911/A_34P.wav`. Mechanical source: `ShotgunSounds/Rack.mp3` and `First Shell.mp3`.

34 compact mono 44.1 kHz Vorbis samples occupy approximately 346 KiB. Processing applies a 40 Hz high-pass and mono conversion followed by a peak limiter at 0.75 (headroom for Vorbis reconstruction), with fade-outs on edited excerpts. The original transient attacks are preserved. Material impacts, gun mechanisms and wet Foley are mixed as separate layers. Modest playback variation prevents repeated identical footsteps and impacts. The ambience is a quiet filtered recording of bubbling liquid.

The browser decodes samples once, caches buffers, limits short-effect polyphony to 24 voices, throttles repeated pellet/gore events, and preserves player weapon priority. Pausing stops existing one-shots and the ambience. Loading failures stay silent instead of falling back to synthetic buzzing. `AudioSystem.ready` and `failedSamples` expose loading status for QA. Volume is clamped to 0–1 and smoothly changed; a master compressor limits simultaneous attacks.

This is a sample-based foundation, not a claim of subjective parity with Doom or Blood. Professionally directed original enemy performances, an authored music score, and headphone/speaker mix review remain the route to a distinctive final sound identity. No listening claim is made by automated decoding tests.


## Verification

Chromium/Web Audio loaded and decoded all 34 samples with zero failed requests. Every event was played programmatically; simultaneous voices stayed at the 24-voice limit. Volume input 4 clamped to 1. Pause produced a suspended context; restart returned it to running. A separate full FFmpeg PCM decode measured all sample peaks: maximum 0.96148, no silent files, no decoded values above 1. TypeScript compilation passed.


## Mekânsal filtre ve miks grupları

Ses kaynağından dinleyiciye mevcut oyun duvarlarıyla yapılan tek ışın kontrolü engel bulduğunda kazanç 0.38 katsayısıyla çarpılır; alçak geçiren filtre üst sınırı 1050 Hz olur. Açık görüşte kaynak katmanının mevcut filtresi korunur. Bu yalnız çalma anında hesaplanır, duvar çevresinden ses yayılımı hesaplanmaz.

Silah, yaratık ve dünya sesleri ayrı GainNode gruplarından master/kompresöre gider. Ortam kaydı dünya grubundadır. Yeni woodHit/metalHit/stoneHit olayları mevcut CC0 örneklerini daha düşük kazançla kullanır; yeni dış ses dosyası eklenmedi.
