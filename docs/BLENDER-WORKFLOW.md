# Blender Varlik Uretimi

Oyun modelleri `public/models/` altinda hazirdir. Oyunu calistirmak icin Blender gerekmez. Duzenlenebilir Vesper, esya ve organik silah kaynaklari `assets/blender/` altindadir.

## Vesper Aktarimi

`assets/blender/vesper.blend` dosyasini Blender'da duzenle. `vesper_body`, `vesper_hinge`, `vesper_hammers` adlarini ve pivotlarini koru. Blender'in Z yukari ekseni glTF aktariminda oyunun Y yukari eksenine donusur.

Blender komutu sistem yolundayken:

```sh
blender --background assets/blender/vesper.blend --python scripts/export-vesper.py
```

`scripts/build-vesper.py` baslangic modelini yeniden uretir ve kaynak dosyanin uzerine yazar. Elle duzenlenmis model icin `export-vesper.py` kullan.

## Dusman Kaynaklarini Uretme

Eski dusman `.blend` dosyalari kisisel yol metadatasi nedeniyle yayin paketine dahil degildir. Hazir GLB modelleri degistirilmemistir. Yerel kaynaklari olusturmak icin:

```sh
blender --background --python scripts/build-enemies.py
```

Uretim araci olusan model kaynaklarinin uzerine yazabilir; elle duzenledigin dosyalari once yedekle. Urettigin ve duzenledigin bir kaynagi aktarmak icin:

```sh
blender --background assets/blender/cultist.blend --python scripts/export-models.py
```

Karakterler oyundaki eklem animasyonu ve ragdoll sistemiyle surulur. Eklem adlarini, yerel eksenleri ve anchor konumlarini koru.
