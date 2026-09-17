# Varlik Kaynaklari

Proje sahibi: [torunum](https://github.com/torunum).

## Projeye Ait Varliklar

Oyun geometrisi, organik dekorlar, silahlar ve eklemli karakterler proje icin olusturuldu. Kas ve tas dokulari dahil uretilen gorseller baska bir oyundan alinmadi. Oyun icin gerekli modeller `public/models/`, dokular `public/textures/` altindadir.

Blender uretim ve aktarim araclari `scripts/` altindadir. Vesper, esya ve organik silah kaynaklari `assets/blender/` icindedir. Kisisel dosya yolu metadatasi tasiyan eski dusman `.blend` kaynaklari yayin paketine dahil degildir; hazir oyun modelleri korunur ve dusman kaynaklari `scripts/build-enemies.py` ile yeniden uretilebilir. [Blender calisma akisi](BLENDER-WORKFLOW.md).

## Sesler

Dagitimdaki 34 ses kaydinin kaynaklari, katki sahipleri ve CC0 bildirimleri [AUDIO-SOURCES.md](AUDIO-SOURCES.md) ve `public/audio/manifest.json` icindedir. Kenney lisansi `public/audio/KENNEY-LICENSE.txt` dosyasinda korunur.

## Ucuncu Taraf Bilesenler

| Bilesen | Kullanim | Lisans |
| --- | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | 3D goruntu ve geometri | MIT |
| [polygon-clipping](https://github.com/mfogel/polygon-clipping) | Harita poligon birlestirme | MIT |
| [Barlow ve Barlow Condensed](https://github.com/jpt/barlow) | Yerel arayuz yazi tipleri | SIL OFL 1.1 |

[Telif ve lisans bildirimleri](promo/THIRD_PARTY_NOTICES.md), bagimliliklarin ve yazi tiplerinin lisans metinlerini icerir. Bu bildirimler proje sahipligi bilgisinden ayri olarak korunur.
