let game;
let commandController;
let canvasElement;
let hostResizeObserver;
let gameAudio;
let fullscreenWasActive = false;
let lastFullscreenExitAt = 0;

function setup() {
  const host = document.getElementById('canvasHost');
  canvasElement = createCanvas(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
  canvasElement.parent(host);
  canvasElement.elt.setAttribute('aria-label', 'Carte tactique jouable. Clic pour déplacer le commandant, D plus clic pour donner un ordre.');
  canvasElement.elt.setAttribute('role', 'application');
  canvasElement.elt.setAttribute('tabindex', '0');
  if (typeof describe === 'function') {
    describe('Carte tactique SQUAD COMMAND. Recrutez des soldats, dirigez-les avec les commandes visibles et évitez les obstacles.');
  }
  frameRate(60);
  gameAudio = new SquadAudioManager();
  game = new SquadCommandGame();
  commandController = new CommandController(game);
  bindInterface();
  hostResizeObserver = new ResizeObserver(resizeCanvasToHost);
  hostResizeObserver.observe(host);
}

function draw() {
  if (!game) return;
  document.getElementById('startOverlay').hidden = game.phase !== 'menu';
  game.update();
  game.render();
  updateRoster();
}

function windowResized() {
  resizeCanvasToHost();
}

function resizeCanvasToHost() {
  const host = document.getElementById('canvasHost');
  if (host && host.clientWidth > 0 && host.clientHeight > 0) {
    const oldWidth = width;
    const oldHeight = height;
    if (Math.round(oldWidth) === host.clientWidth && Math.round(oldHeight) === host.clientHeight) return;
    resizeCanvas(host.clientWidth, host.clientHeight);
    if (game) game.resizeWorld(oldWidth, oldHeight, width, height);
  }
}

function mousePressed(event) {
  if (!game || mouseButton !== LEFT) return;
  // p5 exposes global callbacks for the whole page. Ignore controls and overlays,
  // even when a fixed panel visually overlaps the canvas.
  if (!canvasElement || !commandController.acceptsCanvasEvent(event, canvasElement.elt)) return;
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  const outcome = commandController.click(mouseX, mouseY, keyIsDown(68), document.getElementById('mapSelect').value, Boolean(event.shiftKey));
  if (outcome === 'started') syncMissionState();
  return false;
}

function mouseMoved(event) {
  if (!game || !canvasElement || !commandController.acceptsCanvasEvent(event, canvasElement.elt)) return;
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  game.followCommander(mouseX, mouseY);
}

function keyPressed() {
  const active = document.activeElement;
  const type = active?.type?.toLowerCase();
  const typing = active?.isContentEditable || active?.tagName === 'TEXTAREA' ||
    (active?.tagName === 'INPUT' && !['button','checkbox','radio','range','submit','reset'].includes(type));
  if (!game || typing) return;
  if (keyCode === ESCAPE && (document.fullscreenElement || Date.now() - lastFullscreenExitAt < 500)) return;
  const pressed = keyCode === ENTER ? 'enter' : key;
  const outcome = commandController.keydown(pressed, document.getElementById('mapSelect').value);
  if (outcome === 'paused' || outcome === 'resumed') syncPauseButton();
  if (outcome === 'started' || outcome === 'restarted' || outcome === 'menu') syncMissionState();
  if (outcome === 'flee') updateRoster();
  if (outcome === 'tactical-mode') {
    syncTacticalHint(true);
  }
  if (outcome !== 'ignored') return false;
}

function keyReleased() {
  if (game && keyCode === 68 && commandController.keyup('d')) {
    syncTacticalHint(false);
  }
}

function bindInterface() {
  const byId = id => document.getElementById(id);
  document.addEventListener('pointerdown', () => gameAudio.unlock(), { once: true });
  document.addEventListener('keydown', () => gameAudio.unlock(), { once: true });
  byId('musicToggle').addEventListener('click', event => {
    gameAudio.setMusicEnabled(!gameAudio.musicEnabled);
    syncAudioControls();
  });
  byId('effectsToggle').addEventListener('click', event => {
    gameAudio.setEffectsEnabled(!gameAudio.effectsEnabled);
    syncAudioControls();
  });
  byId('musicVolume').addEventListener('input', event => {
    gameAudio.setMusicVolume(Number(event.currentTarget.value) / 100);
    byId('musicVolumeOut').textContent = event.currentTarget.value + '%';
  });
  byId('effectsVolume').addEventListener('input', event => {
    gameAudio.setEffectsVolume(Number(event.currentTarget.value) / 100);
    byId('effectsVolumeOut').textContent = event.currentTarget.value + '%';
  });
  syncAudioControls();
  byId('settingsToggle').addEventListener('click', () => setSettings(byId('settingsPanel').hidden));
  byId('panelToggleButton').addEventListener('click', () => setBattlePanelHidden(byId('sidePanel').hidden === false));
  byId('fullscreenButton').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      game.showMessage('Le mode plein écran n’est pas disponible dans ce navigateur.', 130);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    if (fullscreenWasActive && !active) lastFullscreenExitAt = Date.now();
    fullscreenWasActive = active;
    syncFullscreenButton();
    requestAnimationFrame(resizeCanvasToHost);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !document.fullscreenElement) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    document.exitFullscreen();
  }, true);
  byId('startButton').addEventListener('click', () => {
    game.start(byId('mapSelect').value);
    commandController.tacticalMode = false;
    syncMissionState();
  });
  document.querySelectorAll('.map-choice').forEach(button => button.addEventListener('click', () => {
    byId('mapSelect').value = button.dataset.level;
    syncMapPicker();
  }));
  byId('settingsClose').addEventListener('click', () => setSettings(false));
  byId('mapSelect').addEventListener('change', () => {
    syncMapPicker();
    commandController.tacticalMode = false;
    syncTacticalHint(false);
    if (game.phase !== 'menu') game.start(byId('mapSelect').value);
    else { game.levelKey = byId('mapSelect').value; game.level = LEVELS[game.levelKey]; }
    syncMissionState();
  });
  byId('controlMode').addEventListener('change', event => {
    game.controlMode = event.target.value;
    game.showMessage(game.controlMode === 'follow' ? 'Suivi souris actif' : 'Contrôle par clic actif', 90);
    syncControlHint();
  });
  byId('debugToggle').addEventListener('click', event => {
    game.debug = !game.debug;
    event.currentTarget.setAttribute('aria-pressed', String(game.debug));
    event.currentTarget.classList.toggle('active', game.debug);
    event.currentTarget.textContent = game.debug ? 'DÉSACTIVER LE MODE DEBUG' : 'ACTIVER LE MODE DEBUG';
  });
  byId('pauseButton').addEventListener('click', () => { game.paused = !game.paused; syncPauseButton(); });
  byId('restartButton').addEventListener('click', () => restartMission());
  byId('settingsRestart').addEventListener('click', () => { restartMission(); setSettings(false); });
  byId('engageButton').addEventListener('click', () => game.engage());
  byId('disperseButton').addEventListener('click', () => game.disperse());
  byId('regroupButton').addEventListener('click', () => game.regroup());
  byId('helpToggle').addEventListener('click', event => {
    const panel = byId('helpPanel'); panel.hidden = !panel.hidden;
    event.currentTarget.firstChild.textContent = panel.hidden ? 'Voir toutes les commandes ' : 'Masquer les commandes ';
  });
  byId('rosterList').addEventListener('click', event => {
    const row = event.target.closest('[data-soldier-id]');
    if (!row) return;
    const soldier = game.soldiers.find(unit => String(unit.id) === row.dataset.soldierId);
    if (soldier) {
      if (!event.shiftKey) game.soldiers.forEach(unit => { unit.selected = unit === soldier; });
      else soldier.selected = !soldier.selected;
    }
    updateRoster();
  });
  byId('battlefield').addEventListener('pointerdown', event => {
    if (event.target === canvasElement?.elt) canvasElement.elt.focus({ preventScroll: true });
  });
  syncMissionState();
  syncControlHint();
  syncMapPicker();
}

function syncAudioControls() {
  if (!gameAudio) return;
  const music = document.getElementById('musicToggle');
  const effects = document.getElementById('effectsToggle');
  music.setAttribute('aria-pressed', String(gameAudio.musicEnabled));
  music.textContent = gameAudio.musicEnabled ? '♫ Musique · activée' : '♫ Musique · coupée';
  effects.setAttribute('aria-pressed', String(gameAudio.effectsEnabled));
  effects.textContent = gameAudio.effectsEnabled ? '◖ Effets · activés' : '◖ Effets · coupés';
}

function syncControlHint() {
  const mode = document.getElementById('controlMode')?.value || 'follow';
  const hint = document.querySelector('.command-hint');
  if (hint) hint.innerHTML = mode === 'follow'
    ? '<kbd>Souris</kbd> Suivre <kbd>F</kbd> Fuir <kbd>D + clic ennemi</kbd> 1 renfort <kbd>T</kbd> Tir (fusil requis) <kbd>E</kbd> Fouiller <kbd>P</kbd> Chasser <kbd>R</kbd> Regrouper'
    : '<kbd>Clic</kbd> Déplacer <kbd>F</kbd> Fuir <kbd>D + clic ennemi</kbd> 1 renfort <kbd>T</kbd> Tir (fusil requis) <kbd>E</kbd> Fouiller <kbd>P</kbd> Chasser <kbd>R</kbd> Regrouper';
}

function syncMapPicker() {
  const selected = document.getElementById('mapSelect')?.value;
  document.querySelectorAll('.map-choice').forEach(button => {
    const active = button.dataset.level === selected;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function syncTacticalHint(active) {
  const note = document.getElementById('modeNote');
  note.classList.toggle('tactical', active);
  note.lastChild.textContent = active
    ? 'Mode tactique · cliquez une zone ou une cible'
    : 'Mode formation · D maintenu pour commander';
}

function setSettings(open) {
  const panel = document.getElementById('settingsPanel');
  panel.hidden = !open;
  document.getElementById('settingsToggle').setAttribute('aria-expanded', String(open));
}

function setBattlePanelHidden(hidden) {
  const panel = document.getElementById('sidePanel');
  const layout = document.querySelector('.layout');
  const button = document.getElementById('panelToggleButton');
  panel.hidden = hidden;
  layout.classList.toggle('panel-hidden', hidden);
  button.setAttribute('aria-expanded', String(!hidden));
  button.setAttribute('aria-label', hidden ? 'Afficher le panneau de configuration' : 'Masquer le panneau de configuration');
  button.title = hidden ? 'Afficher le panneau' : 'Masquer le panneau';
  button.textContent = hidden ? '▤' : '×';
  requestAnimationFrame(resizeCanvasToHost);
}

function syncFullscreenButton() {
  const button = document.getElementById('fullscreenButton');
  if (!button) return;
  const active = Boolean(document.fullscreenElement);
  button.textContent = active ? '×' : '⛶';
  button.title = active ? 'Quitter le plein écran' : 'Plein écran';
  button.setAttribute('aria-label', active ? 'Quitter le plein écran' : 'Passer en plein écran');
  button.setAttribute('aria-pressed', String(active));
}

function restartMission() {
  commandController.tacticalMode = false;
  game.start(document.getElementById('mapSelect').value);
  syncPauseButton();
  syncMissionState();
}

function syncPauseButton() {
  const button = document.getElementById('pauseButton');
  button.textContent = game.paused ? '▶' : 'Ⅱ';
  button.setAttribute('aria-label', game.paused ? 'Reprendre' : 'Mettre en pause');
}

function syncMissionState() {
  const state = document.getElementById('missionState');
  state.textContent = game.phase === 'victory' ? 'MISSION ACCOMPLIE' : game.phase === 'defeat' ? 'MISSION ÉCHOUÉE' : game.phase === 'playing' ? (game.wave ? 'CONTACT HOSTILE' : 'MISSION EN COURS') : 'PRÊT AU DÉPLOIEMENT';
  updateRoster();
}

function updateRoster() {
  if (!game) return;
  const signature = game.soldiers.map(soldier => `${soldier.id}:${soldier.orderLabel}:${soldier.target?.id || 0}:${soldier.selected}:${soldier.health}:${soldier.eliminated}`).join('|');
  if (signature === updateRoster.lastSignature) return;
  updateRoster.lastSignature = signature;
  const roster = document.getElementById('rosterList');
  roster.innerHTML = game.soldiers.map(soldier =>
    `<button class="unit-row roster-unit${soldier.selected ? ' selected' : ''}${soldier.eliminated ? ' eliminated' : ''}" data-soldier-id="${soldier.id}" type="button" ${soldier.eliminated ? 'disabled' : ''}><span class="unit-avatar soldier-avatar">${String(soldier.id).padStart(2,'0')}</span><span><strong>Fusilier ${String(soldier.id).padStart(2,'0')}</strong><small>${soldier.eliminated ? 'Neutralisé' : 'PV ' + soldier.health + '/' + soldier.maxHealth + ' · ' + (soldier.target && !soldier.target.eliminated ? 'Ennemi ' + soldier.target.id : soldier.orderLabel === 'FORMATION' ? 'Formation' : soldier.orderLabel.toLowerCase())}</small></span><span class="unit-status">${soldier.eliminated ? 'PERDU' : soldier.selected ? 'SÉLECT.' : 'ACTIF'}</span></button>`
  ).join('');
  document.getElementById('rosterCount').textContent = String(game.soldiers.length + 1).padStart(2, '0');
  document.getElementById('recruitCount').textContent = Math.min(game.soldiers.length, 3) + ' / 3';
  document.getElementById('recruitProgress').style.width = Math.min(100, game.soldiers.length / 3 * 100) + '%';
}
