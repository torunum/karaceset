import "./style.css";
import "@fontsource/barlow/latin-ext-400.css";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-ext-600.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow-condensed/latin-ext-500.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-ext-700.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-ext-800.css";
import "@fontsource/barlow-condensed/latin-800.css";
import { Game } from "./game";
import { WEAPONS, type WeaponId } from "./weapons";
import type { Difficulty } from "./campaign-balance";
const icon = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 3v34M8 9q12 9 24 0M7 16q13 10 26 0M9 24q11 8 22 0M13 31q7 5 14 0" stroke="currentColor" stroke-width="2"/><path d="M16 4l4 4 4-4" stroke="currentColor" stroke-width="2"/></svg>`;
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<canvas id="game" aria-label="Kara Ceset üç boyutlu oyun alanı"></canvas>
<div id="vignette"></div><div id="damage"></div><div class="grain"></div>
<header id="top"><a class="brand" href="/">${icon}<span>KARA CESET</span></a><div class="chapter">01 <span>/</span> BAĞIRSAK GEÇİDİ</div><button id="pause" aria-label="Oyunu duraklat">II <span>ESC</span></button></header>
<div id="hud" hidden><div class="mission"><span class="eyebrow" id="zone">UYANIŞ</span><p id="objective"></p></div><div id="crosshair"><i></i><i></i><i></i><i></i></div><div id="notice"></div><div id="interaction"></div>
<footer class="status"><div class="vital"><span class="eyebrow">YAŞAM BELİRTİSİ</span><div class="readout"><span class="heart">✚</span><strong id="health">100</strong><span class="unit">/ 100</span></div><div class="health-track"><i id="healthbar"></i></div></div>
<div class="weapon-label"><div class="weapon-slots"><span data-weapon="femur"><b>1</b> KEMİK</span><span data-weapon="shotgun"><b>2</b> ÇİFTE</span><span data-weapon="acid"><b>3</b> SAFRA</span></div><strong id="weapon-name">UYLUK KEMİĞİ FIRLATICISI</strong><span id="reload">TENDONLAR HAZIR</span></div>
<div class="ammo"><span class="eyebrow" id="ammo-type">KEMİK REZERVİ</span><div class="readout"><strong id="ammo">28</strong><span class="unit" id="ammo-max">/ 80</span></div><div class="ammo-marks" id="kick-hint">F / Q · TEKME</div></div></footer><div class="stats-mini"><span id="kills">0 / 28</span> TEMİZLENEN <b>·</b> <span id="pins">0</span> ÇİVİLENEN <b>·</b> <span id="severed">0</span> KOPAN UZUV</div></div>
<section id="overlay"><div class="menu-copy"><div class="overline"><i></i> KÜL AYİNİ <span>•</span> BÖLÜM 01</div><h1>KARA<br><em>CESET</em><span class="title-rule"></span></h1><div class="subtitle"><span>BAĞIRSAK GEÇİDİ</span><small>YERYÜZÜ ET OLDU. ÖLÜLER GERİ DÖNDÜ.</small></div><p id="description">Kül Tarikatı, yeryüzünü şeytanına sundu.<br>Taş ete, insanlar aç cesetlere dönüştü.<br>Aşağı in. Müritleri sustur. Ayini parçala.</p><button id="start" class="primary"><span>İÇERİ GİR</span><b>↗</b></button><div class="menu-meta"><span><i></i> KÜL AYİNİ SÜRÜMÜ</span><span>5 DÜŞMAN / 3 SİLAH</span></div></div>
<aside class="field-note"><span class="eyebrow">KÜL TARİKATI / ELE GEÇEN NOT</span><div class="bone-mark">╱</div><h2>“Toprak artık aç.”</h2><p>Çizmenle bedenleri savur.<br>Fıçıları ve ayin kaplarını parçala.<br>Kemiğinle sağ kalanları duvara as.</p><div class="note-line"></div><span class="eyebrow">F / Q TEKME · 1 / 2 / 3 SİLAH</span></aside>
<div class="menu-bottom"><div class="controls"><span><kbd>W A S D</kbd> HAREKET</span><span><kbd>SOL TIK</kbd> ATEŞ</span><span><kbd>1 2 3</kbd> SİLAH</span><span><kbd>F / Q</kbd> TEKME</span><span><kbd>E</kbd> ETKİLEŞİM</span><span><kbd>ESC</kbd> DURAKLAT</span></div><button id="settings-toggle">AYARLAR <span>↗</span></button></div>
<div id="settings" hidden><h2>Ayarlar</h2><label>Ses <input id="volume" type="range" min="0" max="1" step=".05" value=".45"></label><label>Silah sesleri <input id="volume-weapons" type="range" min="0" max="1" step=".05" value="1"></label><label>Düşman sesleri <input id="volume-creatures" type="range" min="0" max="1" step=".05" value="1"></label><label>Çevre ve darbeler <input id="volume-world" type="range" min="0" max="1" step=".05" value="1"></label><label>Fare hassasiyeti <input id="sensitivity" type="range" min=".0005" max=".005" step=".0001" value=".002"></label><label>Görüntü kalitesi <select id="quality"><option value="1">Yüksek</option><option value=".75">Dengeli</option><option value=".55">Performans</option></select></label><p>Fare kilidi desteklenmezse sağ tuşu basılı tutarak veya ok tuşlarıyla bakabilirsin.</p><button id="settings-close">KAPAT</button></div></section><div id="loading">DOKULAR UYANIYOR…</div>`;
const $ = (id: string) => document.getElementById(id)!;
let game: Game;
try {
  game = new Game($("game") as HTMLCanvasElement);
  $("loading").remove();
} catch (error) {
  $("loading").innerHTML =
    `WebGL başlatılamadı. Donanım hızlandırması açık bir masaüstü tarayıcı kullan.<br>${String(error)}`;
  throw error;
}
if (game.chapel) {
  document.querySelector(".chapter")!.textContent = "KÜL ŞAPELİ";
  document.querySelector(".subtitle > span")!.textContent = "KÜL ŞAPELİ";
  $("description").innerHTML =
    "Müritler şapeli mühürledi.<br>Ayini sustur. Altardaki mührü kır.<br>Demir kapıdan geri çık.";
  document.querySelector(".menu-meta")!.innerHTML =
    "<span>KÜL ŞAPELİ</span><span>4 DÜŞMAN / 3 SİLAH</span>";
}
$("start").insertAdjacentHTML(
  "afterend",
  `<a class="chapter-link" href="${game.chapel ? "/" : "?chapel=1"}">${game.chapel ? "BAĞIRSAK GEÇİDİNE DÖN" : "YENİ: KÜL ŞAPELİNE GİR"} ↗</a>`,
);
const controls = $("overlay");
$("start").insertAdjacentHTML('beforebegin', '<div id="difficulty-control"><label for="difficulty">AYİNİN ŞİDDETİ</label><select id="difficulty" aria-describedby="difficulty-note"><option value="easy">Kolay · Daha fazla kaynak</option><option value="normal" selected>Normal · Kül ayini</option><option value="hard">Zor · Daha hızlı tepki</option></select><small id="difficulty-note">Yeni oyunun zorluğunu seç.</small></div>');
$("difficulty-control").hidden = game.testroom;
document.querySelector('.vital .unit')!.id = 'health-max';
document.querySelector('.stats-mini')!.insertAdjacentHTML('beforeend',' <b>·</b> <span id="secrets-found">0</span> SIR <b>·</b> <span id="fps-value">60</span> FPS');
$("notice").insertAdjacentHTML('afterend','<div id="power-status"></div>');
let lastMode = "";
game.onChange = () => {
  const playing = game.mode === "playing";
  $("hud").hidden = !playing;
  controls.hidden = playing;
  $("pause").hidden = !playing;
  $("health").textContent = String(Math.ceil(game.health)).padStart(2, "0");
  $("ammo").textContent = String(game.ammo).padStart(2, "0");
  const def = WEAPONS[game.weaponId];
  $("weapon-name").textContent = def.name.toLocaleUpperCase("tr");
  $("ammo-type").textContent = def.ammoName + " REZERVİ";
  $("ammo-max").textContent = "/ " + def.maxAmmo;
  $("severed").textContent = String(game.gore.severed);
  document
    .querySelectorAll<HTMLElement>("[data-weapon]")
    .forEach((e) => {
      const weapon = e.dataset.weapon as WeaponId;
      const unlocked = game.unlockedWeapons.has(weapon);
      e.classList.toggle("active", unlocked && weapon === game.weaponId);
      e.classList.toggle("locked", !unlocked);
      e.title = unlocked ? WEAPONS[weapon].name : `${WEAPONS[weapon].name} · Bölümde bul`;
      e.setAttribute('aria-label', e.title);
    });
  $("kick-hint").textContent =
    game.kickCooldown > 0 ? "TEKME · HAZIRLANIYOR" : "F / Q · TEKME";
  $("healthbar").style.width = `${Math.max(0, Math.min(100, game.health))}%`;
  $("healthbar").style.background = game.health > 100 ? '#b9c584' : game.health < 30 ? "#e04455" : "#ae665e";
  $("health-max").textContent = game.health > 100 ? '/ 200' : '/ 100';
  const difficulty = $("difficulty") as HTMLSelectElement;
  difficulty.value = game.difficulty;
  difficulty.disabled = game.mode === 'playing' || game.mode === 'paused';
  $("difficulty-note").textContent = difficulty.disabled ? 'Bu ayin bitene kadar zorluk sabit.' : 'Yeni oyunun zorluğunu seç.';
  $("damage").style.opacity = String(game.hurtFlash * 0.65);
  $("crosshair").classList.toggle("hit", game.hitFlash > 0);
  $("crosshair").classList.toggle("reloading", game.shotCooldown > 0.1);
  $("zone").textContent = game.zone();
  $("objective").textContent = game.objective();
  $("kills").textContent = `${game.kills} / ${game.enemies.length}`;
  $("pins").textContent = String(game.pins);
  $("notice").textContent = game.noticeTimer > 0 ? game.notice : '';
  $("power-status").textContent=game.powerStatus();
  $("secrets-found").textContent=game.testroom?String(game.secrets):`${game.secrets} / ${game.totalSecrets}`;
  $("fps-value").textContent=String(game.fps);
  $("interaction").textContent = game.prompt();
  $("reload").textContent =
    game.switchTimer > 0
      ? "SİLAH DEĞİŞTİRİLİYOR"
      : game.shotCooldown > 0.12
        ? game.weaponId === "shotgun"
          ? "FİŞEK SÜRÜLÜYOR"
          : game.weaponId === "acid"
            ? "BEZ KASILIYOR"
            : "YENİ KEMİK SÜRÜLÜYOR"
        : "ATEŞE HAZIR";
  if (lastMode !== game.mode) {
    lastMode = game.mode;
    const title = $("start").querySelector("span")!;
    if (game.mode === "paused") {
      title.textContent = "DEVAM ET";
      $("description").innerHTML =
        "Organizma bekliyor.<br>Hazır olduğunda kaldığın yerden devam et.";
    } else if (game.mode === "dead") {
      title.textContent = "YENİDEN UYAN";
      $("description").innerHTML =
        `Organizma seni geri aldı.<br>${game.kills} yaratık temizlendi. ${game.pins} beden çivilendi.`;
    } else if (game.mode === "won") {
      title.textContent = "YENİDEN OYNA";
      $("description").innerHTML =
        `GEÇİT TEMİZLENDİ · ${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed % 60)).padStart(2, "0")}<br>${game.kills} yaratık · ${game.pins} çivileme · ${game.secrets} gizli kaynak`;
    } else title.textContent = "İÇERİ GİR";
  }
};
const startButton = $("start") as HTMLButtonElement;
const updateGameHud = game.onChange;
game.onChange = () => {
  updateGameHud();
  startButton.disabled = !game.assetsReady;
  if (!game.assetsReady)
    startButton.querySelector("span")!.textContent = "YÜKLENİYOR…";
  else if (startButton.querySelector("span")!.textContent === "YÜKLENİYOR…")
    startButton.querySelector("span")!.textContent = "İÇERİ GİR";
};
$("start").addEventListener("click", () => void game.start());
$("pause").addEventListener("click", () => game.pause());
$("settings-toggle").addEventListener(
  "click",
  () => ($("settings").hidden = !$("settings").hidden),
);
$("settings-close").addEventListener(
  "click",
  () => ($("settings").hidden = true),
);
$("volume").addEventListener("input", (e) =>
  game.audio.setVolume(Number((e.target as HTMLInputElement).value)),
);
for (const channel of ["weapons", "creatures", "world"] as const) {
  $("volume-" + channel).addEventListener("input", (e) =>
    game.audio.setChannelVolume(
      channel,
      Number((e.target as HTMLInputElement).value),
    ),
  );
}
$("sensitivity").addEventListener(
  "input",
  (e) => (game.sensitivity = Number((e.target as HTMLInputElement).value)),
);
$("quality").addEventListener("change", (e) => {
  game.renderScale = Number((e.target as HTMLSelectElement).value);
  game.resize();
});
$("difficulty").addEventListener('change', e => {
  game.setDifficulty((e.target as HTMLSelectElement).value as Difficulty);
  game.onChange();
});
game.onChange();
// Development-only observability for deterministic browser regression checks.
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
