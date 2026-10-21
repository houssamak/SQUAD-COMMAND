class SquadCommandGame {
  constructor() {
    this.levelKey = 'forest';
    this.level = LEVELS[this.levelKey];
    this.commander = null;
    this.soldiers = [];
    this.recruits = [];
    this.goldCoins = [];
    this.gold = 0;
    this.obstacles = [];
    this.enemies = [];
    this.effects = [];
    this.orders = [];
    this.wave = 0;
    this.levelNumber = 1;
    this.waveInLevel = 0;
    this.levelWavesCleared = 0;
    this.currentWaveEnemyCount = 0;
    this.levelTransition = null;
    this.notifications = [];
    this.phase = 'menu';
    this.paused = false;
    this.debug = false;
    this.message = '';
    this.messageUntil = 0;
    this.nextSoldierId = 1;
    this.nextEnemyId = 1;
    this.pendingWaveCountdown = 0;
    this.tacticalMode = false;
    this.selectedEnemy = null;
    this.home = null;
    this.hospital = null;
    this.hospitalUsed = false;
    this.cache = null;
    this.controlMode = 'follow';
    this.cameraShake = 0;
    this.transitionFrames = 0;
  }

  start(levelKey = this.levelKey) {
    this.levelKey = LEVELS[levelKey] ? levelKey : 'forest';
    this.level = LEVELS[this.levelKey];
    this.commander = new Commander(width * 0.5, height * 0.52);
    this.gold = 0;
    this.home = new TacticalHome(width * 0.5, height * 0.82);
    this.hospital = new FieldHospital(width * this.level.hospital.x, height * this.level.hospital.y, this.level.hospital);
    this.hospitalUsed = false;
    this.soldiers = [];
    this.nextSoldierId = 1;
    this.nextEnemyId = 1;
    this.recruits = this.level.recruit.map((point, index) => new Recruit(width * point[0], height * point[1], index + 1));
    this.goldCoins = this.level.gold.map(([x, y], index) => new GoldCoin(width * x, height * y, index + 1));
    this.obstacles = this.level.obstacles.map(([x,y,r,kind]) => new TacticalObstacle(width*x, height*y, r, kind));
    const cacheConfig = this.level.cache;
    const cacheObstacle = this.obstacles[cacheConfig.obstacleIndex];
    const cacheDirection = p5.Vector.fromAngle(cacheConfig.angle);
    const cachePosition = p5.Vector.add(cacheObstacle.pos, cacheDirection.mult(cacheObstacle.r + 2));
    this.cache = new WorldCache(cachePosition.x, cachePosition.y, cacheConfig.item, cacheConfig.label);
    this.enemies = [];
    this.effects = [];
    this.orders = [];
    this.wave = 0;
    this.levelNumber = 1;
    this.waveInLevel = 0;
    this.levelWavesCleared = 0;
    this.currentWaveEnemyCount = 0;
    this.levelTransition = null;
    this.notifications = [];
    this.pendingWaveCountdown = 0;
    document.getElementById('notificationStack')?.replaceChildren?.();
    this.phase = 'playing';
    this.cameraShake = 0;
    this.transitionFrames = 24;
    this.paused = false;
    this.tacticalMode = false;
    this.selectedEnemy = null;
    this.showMessage('Récupérez les balises de recrutement. Trois soldats déclenchent la première vague.', 260);
    this.updateHud();
  }

  resizeWorld(oldWidth, oldHeight, newWidth, newHeight) {
    if (!(oldWidth > 0 && oldHeight > 0 && newWidth > 0 && newHeight > 0)) return;
    const scaleX = newWidth / oldWidth;
    const scaleY = newHeight / oldHeight;
    const scalePosition = point => {
      if (!point) return;
      point.x *= scaleX;
      point.y *= scaleY;
    };
    for (const entity of [this.commander, this.home, this.hospital, this.cache, ...this.goldCoins, ...this.soldiers, ...this.recruits, ...this.obstacles, ...this.enemies]) {
      if (!entity) continue;
      scalePosition(entity.pos);
      if (entity.destination) scalePosition(entity.destination);
      if (entity instanceof GoldCoin) scalePosition(entity.previousPosition);
      if (entity.r && (entity instanceof TacticalObstacle)) entity.r *= Math.min(scaleX, scaleY);
    }
    this.orders.forEach(order => scalePosition(order.pos));
    this.effects.forEach(effect => { scalePosition(effect.pos); scalePosition(effect.from); scalePosition(effect.to); });
  }

  showMessage(text, frames = 150) {
    this.message = text;
    this.messageUntil = frameCount + frames;
    const duration = Math.max(1, frames);
    const existing = this.notifications.find(notification => notification.text === text);
    if (existing) {
      existing.life = duration;
      existing.max = duration;
      existing.node?.classList?.remove('notification-fading');
      return;
    }
    const stack = document.getElementById('notificationStack');
    const notification = { text, life: duration, max: duration, node: null };
    if (stack && document.createElement) {
      notification.node = document.createElement('div');
      notification.node.className = 'notification-card';
      notification.node.textContent = text;
      notification.node.title = text;
      stack.prepend(notification.node);
    }
    this.notifications.unshift(notification);
    while (this.notifications.length > 3) {
      const removed = this.notifications.pop();
      removed.node?.remove();
    }
    const missionState = document.getElementById('missionState');
    if (missionState) {
      missionState.textContent = this.phase === 'victory' ? 'MISSION ACCOMPLIE' :
        this.phase === 'defeat' ? 'MISSION ÉCHOUÉE' :
          (this.wave ? 'CONTACT HOSTILE' : 'MISSION EN COURS');
    }
  }

  formationPoint(index) {
    const col = index % 3;
    const row = Math.floor(index / 3) + 1;
    const heading = this.commander.vel.magSq() > 0.2 ? this.commander.vel.heading() : -Math.PI / 2;
    const local = createVector((col - 1) * 38, row * 43 + (col === 1 ? 0 : 8));
    local.rotate(heading + Math.PI / 2);
    return p5.Vector.add(this.commander.pos, local);
  }

  nearestEnemy(position, range = Infinity) {
    return this.enemies.filter(enemy => !enemy.eliminated && p5.Vector.dist(position, enemy.pos) <= range)
      .sort((a, b) => p5.Vector.dist(position, a.pos) - p5.Vector.dist(position, b.pos))[0] || null;
  }

  nextSearchPoint(soldier, index) {
    const margin = 46;
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = (index * 2.4 + attempt * 2.399) % (Math.PI * 2);
      const radius = 90 + (attempt % 4) * 24;
      const point = createVector(
        constrain(soldier.pos.x + Math.cos(angle) * radius, margin, width - margin),
        constrain(soldier.pos.y + Math.sin(angle) * radius, margin, height - margin)
      );
      const clearOfObstacles = this.obstacles.every(obstacle => p5.Vector.dist(point, obstacle.pos) > obstacle.r + soldier.r + 14);
      const clearOfSquad = this.soldiers.every(other => other === soldier || other.eliminated ||
        p5.Vector.dist(point, other.destination) > soldier.r * 2 + 22);
      if (clearOfObstacles && clearOfSquad) return point;
    }
    return this.formationPoint(this.soldiers.indexOf(soldier));
  }

  fleeCommander() {
    const commander = this.commander;
    if (commander.orderType === 'flee') {
      this.endCommanderFlee();
      this.showMessage('Fuite du commandant interrompue.', 90);
      return false;
    }
    const threat = this.nearestEnemy(commander.pos, 320);
    if (!threat) return false;
    commander.orderBeforeFlee = { type: commander.orderType, label: commander.orderLabel, destination: commander.destination.copy() };
    commander.fleeThreat = threat;
    commander.orderType = 'flee';
    commander.orderLabel = 'FUITE';
    commander.maxSpeed = 5.8;
    commander.maxForce = .32;
    this.showMessage('Fuite du commandant · F ou un nouvel ordre pour arrêter.', 120);
    return true;
  }

  endCommanderFlee() {
    const commander = this.commander;
    const previous = commander.orderBeforeFlee || { type: 'player', label: 'JOUEUR', destination: commander.pos.copy() };
    commander.orderType = previous.type;
    commander.orderLabel = previous.label;
    commander.destination = previous.destination.copy();
    commander.maxSpeed = 4.2;
    commander.maxForce = .24;
    commander.fleeThreat = null;
    commander.orderBeforeFlee = null;
  }

  cancelCommanderFlee() {
    if (!this.commander || this.commander.orderType !== 'flee') return false;
    this.endCommanderFlee();
    return true;
  }

  updateCommanderFlee() {
    // Hysteresis keeps the flee order active until the player is clearly safe.
    const threat = this.nearestEnemy(this.commander.pos, 320);
    if (!threat) {
      this.endCommanderFlee();
      return false;
    }
    this.commander.fleeThreat = threat;
    return this.commander.updateFlee(threat, this.obstacles);
  }

  fleePlayerAndSelected() {
    if (this.commander.orderType === 'flee') {
      this.endCommanderFlee();
      this.showMessage('Fuite du commandant interrompue par F.', 90);
      return true;
    }
    const started = this.fleeCommander();
    const soldiersFled = this.fleeSelected(true);
    if (!started && !soldiersFled && this.commander.orderType !== 'flee') {
      this.showMessage('Aucun ennemi proche : le commandant ne déclenche pas de fuite.', 100);
      return false;
    }
    if (started && soldiersFled) this.showMessage('Commandant et soldats sélectionnés : fuite en cours.', 110);
    else if (!started && soldiersFled) this.showMessage('Fuite des soldats sélectionnés · le commandant reste en place.', 110);
    return started || soldiersFled;
  }

  update() {
    if (this.phase !== 'playing' || this.paused) return;
    if (!this.commander.eliminated) {
      if (this.commander.orderType === 'flee') this.updateCommanderFlee();
      else this.commander.updateAgent(this.obstacles);
    }
    this.commander.weaponCooldown = Math.max(0, this.commander.weaponCooldown - 1);
    this.commander.attackAnimation = Math.max(0, this.commander.attackAnimation - 1);
    this.commander.digAnimation = Math.max(0, this.commander.digAnimation - 1);
    this.soldiers.forEach((soldier, index) => {
      if (soldier.eliminated) return;
      soldier.attackAnimation = Math.max(0, soldier.attackAnimation - 1);
      if (soldier.orderType === 'formation') soldier.commandTo(this.formationPoint(index));
      if (soldier.orderType === 'search') {
        const target = this.nearestEnemy(soldier.pos, 260);
        if (target) {
          soldier.target = target;
          soldier.orderType = 'attack';
          soldier.orderLabel = 'CHASSE';
        } else if (p5.Vector.dist(soldier.pos, soldier.destination) < 38) {
          soldier.commandTo(this.nextSearchPoint(soldier, index));
        }
      }
      if (soldier.orderType === 'attack' && soldier.target && !soldier.target.eliminated) {
        const slot = this.attackPosition(soldier, soldier.target);
        if (p5.Vector.dist(soldier.pos, soldier.target.pos) > 92) soldier.commandTo(slot);
        else soldier.commandTo(soldier.pos);
      }
      if (soldier.orderType === 'flee') {
        const threat = soldier.fleeThreat;
        if (!threat || threat.eliminated || p5.Vector.dist(soldier.pos, threat.pos) >= 240) this.endFlee(soldier);
      }
      if (soldier.orderType === 'flee') soldier.updateFlee(soldier.fleeThreat, this.obstacles);
      else soldier.updateAgent(this.obstacles);
      const firingTarget = soldier.orderType === 'attack' ? soldier.target : soldier.supportTarget;
      if (firingTarget && !firingTarget.eliminated && soldier.hasRifle && soldier.weapon === 'rifle' && soldier.fireCooldown === 0 && p5.Vector.dist(soldier.pos, firingTarget.pos) <= 125) this.fireAt(soldier, firingTarget);
      if (soldier.target?.eliminated) this.clearTargetOrders(soldier.target);
    });
    for (const enemy of this.enemies) {
      if (enemy.eliminated) continue;
      const target = this.enemyTarget(enemy);
      enemy.targetUnit = target;
      const position = target ? target.pos : this.home.pos;
      const distance = p5.Vector.dist(enemy.pos, position);
      if (enemy instanceof BossEnemy) {
        const events = enemy.updateBoss(position, this.obstacles);
        this.resolveBossEvents(enemy, events);
        const allies = [this.commander, ...this.soldiers].filter(unit => unit && !unit.eliminated);
        for (const ally of allies) {
          if (enemy.canHitDuringCharge(ally)) this.bossDamageUnit(enemy, ally, 'charge');
        }
      } else if (distance > (target ? 82 : 48)) enemy.updateToward(position, this.obstacles);
      else enemy.attackCooldown = Math.max(0, enemy.attackCooldown - 1);
      if (distance <= (target ? 110 : 70) && enemy.attackCooldown === 0) this.enemyAttack(enemy, target);
    }
    if (this.home.health <= 0 || this.commander.eliminated) {
      this.phase = 'defeat';
      this.showMessage(this.home.health <= 0 ? 'Relais détruit · mission échouée' : 'Commandant neutralisé · mission échouée', 99999);
      return;
    }
    for (const coin of this.goldCoins) {
      if (coin.collected || !coin.updateToward(this.commander, this.obstacles)) continue;
      coin.collected = true;
      this.gold += 1;
      this.effects.push({ type: 'gold-pickup', pos: coin.pos.copy(), life: 38, max: 38, value: 1 });
      this.showMessage('Pièce récupérée · ' + this.gold + ' or', 75);
      this.updateHud();
    }
    for (let index = this.recruits.length - 1; index >= 0; index--) {
      const recruit = this.recruits[index];
      if (!recruit.collected && p5.Vector.dist(this.commander.pos, recruit.pos) <= this.commander.r + recruit.r + 3) {
        recruit.collected = true;
        this.recruits.splice(index, 1);
        if (this.soldiers.length >= 6) continue;
        this.soldiers.push(new Soldier(this.commander.pos.x, this.commander.pos.y, this.nextSoldierId++));
        this.effects.push({ type: 'recruit', pos: this.commander.pos.copy(), life: 42, max: 42 });
        this.showMessage('Soldat recruté · escouade ' + this.soldiers.length + '/6', 100);
        if (this.soldiers.length === 3 && this.wave === 0) this.spawnWave();
        this.updateHud();
      }
    }
    this.effects.forEach(effect => {
      effect.life--;
      if (effect.vel && effect.pos) { effect.pos.add(effect.vel); effect.vel.mult(.94); }
    });
    this.effects = this.effects.filter(effect => effect.life > 0);
    if (this.levelTransition) {
      this.levelTransition.life--;
      if (this.levelTransition.life <= 0) this.levelTransition = null;
    }
    this.orders.forEach(order => order.life--);
    this.orders = this.orders.filter(order => order.life > 0);
    if (this.pendingWaveCountdown > 0) {
      this.pendingWaveCountdown--;
      if (this.pendingWaveCountdown === 0) this.spawnWave();
    }
    if (this.wave > 0 && this.enemies.length > 0 && this.enemies.every(enemy => enemy.eliminated) && this.pendingWaveCountdown === 0) {
      this.enemies = [];
      this.levelWavesCleared++;
      if (this.waveInLevel < 2) {
        this.showMessage('Vague sécurisée · prochaine vague entrante', 125);
        this.pendingWaveCountdown = 108;
      } else if (this.levelNumber < 5) {
        this.levelNumber++;
        this.waveInLevel = 0;
        this.levelWavesCleared = 0;
        this.levelTransition = { level: this.levelNumber, life: 105, max: 105 };
        this.showMessage('LEVEL ' + this.levelNumber + ' · nouvelles menaces détectées', 180);
        this.pendingWaveCountdown = 145;
      } else {
        this.phase = 'victory';
        this.showMessage('LEVEL 5 terminé · mission accomplie', 99999);
      }
    }
  }

  attackPosition(soldier, target) {
    const attackers = this.soldiers.filter(unit => unit.orderType === 'attack' && unit.target === target && !unit.eliminated);
    const index = Math.max(0, attackers.indexOf(soldier));
    const angle = (index / Math.max(1, attackers.length)) * Math.PI * 2;
    return p5.Vector.add(target.pos, createVector(Math.cos(angle), Math.sin(angle)).mult(78));
  }

  enemyTarget(enemy) {
    if (enemy.targetUnit && !enemy.targetUnit.eliminated && p5.Vector.dist(enemy.pos, enemy.targetUnit.pos) < 270) return enemy.targetUnit;
    const candidates = [this.commander, ...this.soldiers].filter(unit => unit && !unit.eliminated && p5.Vector.dist(enemy.pos, unit.pos) < 185);
    candidates.sort((a, b) => p5.Vector.dist(enemy.pos, a.pos) - p5.Vector.dist(enemy.pos, b.pos));
    return candidates[0] || null;
  }

  enemyAttack(enemy, target) {
    const endpoint = target ? target.pos : this.home.pos;
    if (!this.hasLineOfSight(enemy.pos, endpoint)) return false;
    if (target) target.damage(enemy.attackDamage || 1); else this.home.damage(enemy instanceof BossEnemy ? 4 : 2 + Math.floor((this.levelNumber - 1) / 2));
    this.playAudio('shot-enemy');
    this.cameraShake = Math.max(this.cameraShake, target ? 1.8 : 2.5);
    enemy.attackCooldown = enemy instanceof BossEnemy ? 92 : Math.max(48, 76 - (this.levelNumber - 1) * 4);
    this.effects.push({ type: 'enemy-shot', from: enemy.pos.copy(), to: endpoint.copy(), life: 10, max: 10 });
    this.effects.push({ type: 'impact', pos: endpoint.copy(), life: 16, max: 16 });
    return true;
  }

  hasLineOfSight(start, end) {
    return this.obstacles.every(obstacle => {
      const segment = p5.Vector.sub(end, start);
      const lengthSquared = segment.magSq();
      if (!lengthSquared) return true;
      const t = constrain(p5.Vector.dot(p5.Vector.sub(obstacle.pos, start), segment) / lengthSquared, 0, 1);
      const closest = p5.Vector.add(start, segment.copy().mult(t));
      return p5.Vector.dist(closest, obstacle.pos) > obstacle.r + 5;
    });
  }

  endFlee(soldier) {
    const previous = soldier.orderBeforeFlee || { type: 'formation', label: 'FORMATION', target: null, destination: this.formationPoint(this.soldiers.indexOf(soldier)) };
    const invalidAttack = previous.type === 'attack' && (!previous.target || previous.target.eliminated);
    soldier.orderType = invalidAttack ? 'formation' : previous.type;
    soldier.orderLabel = invalidAttack ? 'FORMATION' : previous.label;
    soldier.target = invalidAttack ? null : previous.target;
    soldier.destination = !invalidAttack && previous.destination ? previous.destination.copy() : soldier.pos.copy();
    soldier.fleeThreat = null;
    soldier.orderBeforeFlee = null;
  }

  fleeSelected(silent = false) {
    const selected = this.soldiers.filter(soldier => soldier.selected && !soldier.eliminated);
    if (!selected.length) { if (!silent) this.showMessage('Sélectionnez au moins un soldat avant F.', 100); return false; }
    let started = false;
    let cancelled = false;
    selected.forEach(soldier => {
      if (soldier.orderType === 'flee') { this.endFlee(soldier); cancelled = true; return; }
      const threats = this.enemies.filter(enemy => !enemy.eliminated && p5.Vector.dist(soldier.pos, enemy.pos) < 190)
        .sort((a, b) => p5.Vector.dist(soldier.pos, a.pos) - p5.Vector.dist(soldier.pos, b.pos));
      if (!threats.length) return;
      soldier.orderBeforeFlee = { type: soldier.orderType, label: soldier.orderLabel, target: soldier.target,
        destination: soldier.destination.copy() };
      soldier.orderType = 'flee'; soldier.orderLabel = 'FUITE'; soldier.fleeThreat = threats[0];
      started = true;
    });
    if (!silent) this.showMessage(started ? 'Fuite active · F pour annuler' : cancelled ? 'Fuite annulée · ordre précédent restauré' : 'Aucune menace assez proche pour fuir.', 100);
    return started || cancelled;
  }

  clearTargetOrders(target) {
    this.soldiers.forEach(soldier => {
      if (soldier.supportTarget === target) soldier.supportTarget = null;
      if (soldier.target !== target) return;
      soldier.target = null;
      if (soldier.orderType === 'attack') { soldier.orderType = 'formation'; soldier.orderLabel = 'FORMATION'; }
    });
    if (this.selectedEnemy === target) this.selectedEnemy = null;
    target.selected = false;
  }

  spawnWave() {
    this.pendingWaveCountdown = 0;
    this.wave++;
    this.waveInLevel++;
    this.cameraShake = Math.max(this.cameraShake, 1.5);
    const bossWave = this.levelNumber >= 3 && this.waveInLevel === 1;
    const count = Math.min(7, 3 + this.levelNumber + Math.floor(this.waveInLevel / 2)) - (bossWave ? 1 : 0);
    this.enemies = Array.from({ length: count }, (_, index) => {
      const [x, y] = this.level.enemies[index % this.level.enemies.length];
      const enemy = new Enemy(width*x, height*y, this.nextEnemyId++);
      enemy.health = Math.min(10, 2 + this.levelNumber + Math.floor((this.waveInLevel - 1) / 2));
      enemy.maxHealth = enemy.health;
      enemy.attackDamage = 1;
      enemy.attackCooldown = Math.max(25, 76 - (this.levelNumber - 1) * 4);
      return enemy;
    });
    if (bossWave) {
      const [x, y] = this.level.enemies[this.level.enemies.length - 1];
      const boss = new BossEnemy(width * x, height * y, this.nextEnemyId++, this.levelNumber);
      this.enemies.push(boss);
      this.effects.push({ type: 'boss-arrival', pos: boss.pos.copy(), life: 78, max: 78 });
      this.cameraShake = Math.max(this.cameraShake, 5);
      this.playAudio('boss-arrival');
      this.showMessage('SIGNATURE TITAN · COLOSSUS en approche · esquivez ses télégraphes', 240);
    } else {
      this.showMessage('Niveau ' + this.levelNumber + ' · vague ' + this.waveInLevel + '/2 · ' + this.enemies.length + ' hostiles · T pour engager', 220);
    }
    this.currentWaveEnemyCount = this.enemies.length;
    this.updateHud();
  }

  resolveBossEvents(boss, events) {
    for (const attack of events) {
      if (attack.type === 'slam') {
        const allies = [this.commander, ...this.soldiers].filter(unit => unit && !unit.eliminated && p5.Vector.dist(unit.pos, attack.position) <= attack.radius);
        allies.forEach(unit => this.bossDamageUnit(boss, unit, 'slam'));
        this.effects.push({ type: 'boss-slam', pos: attack.position, life: 34, max: 34, radius: attack.radius });
        this.cameraShake = Math.max(this.cameraShake, 4.5);
        this.showMessage('Impact du Colosse · sortez du cercle rouge pour esquiver', 100);
      }
    }
  }

  updateNotifications() {
    this.notifications.forEach(notification => {
      notification.life--;
      if (!notification.node) return;
      notification.node.style.opacity = String(Math.min(1, notification.life / 28));
      notification.node.classList.toggle('notification-fading', notification.life <= 28);
    });
    const expired = this.notifications.filter(notification => notification.life <= 0);
    expired.forEach(notification => notification.node?.remove());
    this.notifications = this.notifications.filter(notification => notification.life > 0);
  }

  bossDamageUnit(boss, unit, attack) {
    unit.damage(boss.specialDamage);
    this.effects.push({ type: 'boss-impact', pos: unit.pos.copy(), life: 22, max: 22, radius: attack === 'slam' ? 28 : 20 });
    this.cameraShake = Math.max(this.cameraShake, 2.8);
  }

  orderCommander(x, y) {
    if (this.paused || this.phase !== 'playing') return;
    this.cancelCommanderFlee();
    const destination = createVector(constrain(x, 30, width-30), constrain(y, 30, height-30));
    this.commander.commandTo(destination);
    this.orders.push({ pos: destination, life: 45, max: 45, kind: 'move' });
  }

  followCommander(x, y) {
    if (this.paused || this.phase !== 'playing' || this.controlMode !== 'follow' || !this.commander) return;
    this.cancelCommanderFlee();
    this.commander.commandTo(createVector(constrain(x, 30, width - 30), constrain(y, 30, height - 30)));
  }

  tacticalOrder(x, y) {
    if (this.paused || this.phase !== 'playing') return;
    const selected = this.soldiers.filter(soldier => soldier.selected);
    const group = selected;
    if (!group.length) return this.showMessage('Recrutez des soldats avant de donner un ordre tactique.', 110);
    const destination = createVector(constrain(x, 30, width-30), constrain(y, 30, height-30));
    group.forEach((soldier, index) => {
      const offset = createVector((index - (group.length - 1) / 2) * 27, 0);
      soldier.commandTo(p5.Vector.add(destination, offset));
      soldier.orderLabel = 'TACTIQUE';
      soldier.orderType = 'move';
      soldier.target = null;
    });
    this.orders.push({ pos: destination, life: 75, max: 75, kind: 'tactical' });
    this.tacticalMode = false;
    this.showMessage(selected.length ? selected.length + ' soldat(s) affecté(s)' : 'Ordre tactique transmis à toute l’escouade', 100);
  }

  enemyAt(x, y) {
    return this.enemies.find(enemy => !enemy.eliminated &&
      p5.Vector.dist(createVector(x, y), enemy.pos) <= enemy.r * 1.8) || null;
  }

  selectEnemy(enemy) {
    this.selectedEnemy = this.selectedEnemy === enemy ? null : enemy;
    this.enemies.forEach(candidate => { candidate.selected = candidate === this.selectedEnemy; });
    if (this.selectedEnemy) this.showMessage('Cible sélectionnée · T pour engager', 100);
    return Boolean(this.selectedEnemy);
  }

  assignTarget(enemy) {
    if (!enemy || enemy.eliminated) return false;
    const selected = this.soldiers.filter(soldier => soldier.selected);
    const group = selected;
    if (!group.length) {
      this.showMessage('Recrutez des soldats avant d’assigner une cible.', 100);
      return false;
    }
    group.forEach(soldier => {
      soldier.target = enemy;
      soldier.orderLabel = 'CIBLE';
      soldier.orderType = 'attack';
    });
    this.selectedEnemy = enemy;
    this.enemies.forEach(candidate => { candidate.selected = candidate === enemy; });
    this.showMessage('Cible assignée à ' + group.length + ' soldat(s)', 100);
    return true;
  }

  assignOneSoldier(enemy) {
    if (!enemy || enemy.eliminated) return false;
    const available = this.soldiers.filter(soldier => !soldier.eliminated && soldier.orderType === 'formation')
      .sort((a, b) => p5.Vector.dist(a.pos, enemy.pos) - p5.Vector.dist(b.pos, enemy.pos) || a.id - b.id);
    if (!available.length) {
      this.showMessage('Aucun fusilier en formation disponible · les ordres en cours sont conservés.', 120);
      return false;
    }
    const soldier = available[0];
    soldier.selected = true;
    soldier.target = enemy;
    soldier.orderType = 'attack';
    soldier.orderLabel = 'CIBLE';
    this.selectedEnemy = enemy;
    this.enemies.forEach(candidate => { candidate.selected = candidate === enemy; });
    const count = this.assignedSoldiers(enemy).length;
    this.showMessage('Fusilier ' + String(soldier.id).padStart(2, '0') + ' affecté · ' + count + ' soldat(s) sur cet ennemi.', 110);
    return soldier;
  }

  assignedSoldiers(enemy) {
    return this.soldiers.filter(soldier => !soldier.eliminated && soldier.orderType === 'attack' && soldier.target === enemy);
  }

  digCache() {
    if (!this.cache || this.cache.collected) {
      this.showMessage('Aucun indice à creuser ici.', 90);
      return false;
    }
    const distance = p5.Vector.dist(this.commander.pos, this.cache.pos);
    if (distance > 48) {
      this.notifications.forEach(notification => notification.node?.remove());
      this.notifications = [];
      document.getElementById('notificationStack')?.replaceChildren?.();
      this.showMessage('Rapprochez-vous de l’indice pour obtenir un fusil', 110);
      return false;
    }
    this.cache.collected = true;
    const commander = this.commander;
    commander.digAnimation = 20;
    commander.weapon = 'rifle';
    commander.hasRifle = true;
    if (this.cache.item === 'rifle') {
      this.showMessage('Fusil récupéré · T tire à distance. La hache reste un outil de fouille.', 160);
    } else if (this.cache.item === 'medkit') {
      commander.medkitCharges = 3;
      this.showMessage('Fusil et kit médical récupérés · le kit élargit le rayon des soins près de l’hôpital.', 160);
    } else if (this.cache.item === 'armor') {
      commander.armorCharges = 3;
      this.showMessage('Fusil et blindage récupérés · absorbe les 3 prochains dégâts.', 160);
    } else if (this.cache.item === 'capacitor') {
      commander.shockCharges = 3;
      this.showMessage('Fusil et cellule à impulsion récupérés · les 3 prochains tirs sont renforcés.', 160);
    }
    this.effects.push({ type: 'cache-reveal', pos: this.cache.pos.copy(), life: 34, max: 34 });
    return true;
  }

  useHospital() {
    if (!this.hospital || p5.Vector.dist(this.commander.pos, this.hospital.pos) > this.hospital.r + this.commander.r) {
      this.showMessage('Soins indisponibles : entrez dans la zone de l’hôpital pour utiliser H.', 110);
      return false;
    }
    if (this.hospitalUsed) {
      this.showMessage('Les soins de cet hôpital ont déjà été utilisés pendant cette partie.', 110);
      return false;
    }
    const radius = this.commander.medkitCharges ? 190 : 100;
    const nearby = [this.commander, ...this.soldiers].filter(unit => unit && !unit.eliminated && unit.health < unit.maxHealth &&
      p5.Vector.dist(unit.pos, this.hospital.pos) <= radius);
    if (!nearby.length) {
      this.showMessage('Aucun blessé dans la zone de soin · le traitement reste disponible.', 100);
      return false;
    }
    this.hospitalUsed = true;
    nearby.forEach(unit => { unit.health = unit.maxHealth; });
    if (this.commander.medkitCharges) this.commander.medkitCharges = 0;
    this.effects.push({ type: 'healing', pos: this.hospital.pos.copy(), life: 48, max: 48 });
    nearby.forEach((unit, index) => this.effects.push({ type: 'heal-spark', pos: unit.pos.copy(), vel: createVector(0, -1.5 - index * .05), life: 38, max: 38 }));
    this.playAudio('heal');
    this.showMessage('Soins d’urgence appliqués · l’hôpital est désormais épuisé.', 130);
    return true;
  }

  useMedkit() { return this.useHospital(); }

  commanderAttack() {
    const commander = this.commander;
    if (!commander || commander.eliminated || commander.weaponCooldown > 0) return false;
    const enemies = this.enemies.filter(enemy => !enemy.eliminated);
    if (!enemies.length) return false;
    if (!commander.hasRifle || commander.weapon !== 'rifle') {
      if (!this.soldiers.some(soldier => soldier.selected && !soldier.eliminated)) {
        this.showMessage('Aucun tir possible · trouvez l’indice et creusez avec E pour récupérer le fusil.', 115);
      }
      return false;
    }
    const inRange = enemies.filter(enemy => p5.Vector.dist(commander.pos, enemy.pos) <= 280);
    const target = inRange.includes(this.selectedEnemy) ? this.selectedEnemy :
      inRange.sort((a, b) => p5.Vector.dist(commander.pos, a.pos) - p5.Vector.dist(commander.pos, b.pos))[0];
    if (!target) return false;
    if (!this.hasLineOfSight(commander.pos, target.pos)) { this.sparkAtFirstObstacle(commander.pos, target.pos); commander.weaponCooldown = 8; return false; }
    const empowered = commander.shockCharges > 0;
    if (empowered) commander.shockCharges--;
    commander.attackDirection = p5.Vector.sub(target.pos, commander.pos).heading();
    commander.attackAnimation = 7;
    commander.weaponCooldown = empowered ? 12 : 9;
    target.damage(empowered ? 3 : 1);
    this.playAudio('shot-player');
    const direction = p5.Vector.sub(target.pos, commander.pos).normalize();
    const muzzle = p5.Vector.add(commander.pos, direction.copy().mult(24));
    this.effects.push({ type: 'player-shot', from: muzzle, to: target.pos.copy(), life: 7, max: 7, empowered });
    this.effects.push({ type: 'muzzle', pos: muzzle, life: 5, max: 5, color: empowered ? '#c6a1ff' : '#b8f4df' });
    this.onEnemyHit(target, commander);
    this.commandFormationFire(target);
    return true;
  }

  commandFormationFire(target) {
    if (!target || target.eliminated) return;
    for (const soldier of this.soldiers) {
      if (soldier.eliminated || soldier.orderType !== 'formation' || !soldier.hasRifle || soldier.weapon !== 'rifle') continue;
      soldier.supportTarget = target;
      if (soldier.fireCooldown === 0 && p5.Vector.dist(soldier.pos, target.pos) <= 125) this.fireAt(soldier, target);
      if (target.eliminated) break;
    }
  }

  onEnemyHit(target, attacker) {
    this.effects.push({ type: 'impact', pos: target.pos.copy(), life: 18, max: 18 });
    if (target.eliminated) {
      this.cameraShake = Math.max(this.cameraShake, 3.2);
      this.spawnDeathBurst(target);
      this.clearTargetOrders(target);
      if (target instanceof BossEnemy) {
        const reward = 12 + this.levelNumber * 3;
        this.gold += reward;
        this.levelTransition = { level: 'BOSS VAINCU', life: 100, max: 100 };
        this.effects.push({ type: 'boss-reward', pos: target.pos.copy(), life: 80, max: 80 });
        this.showMessage('COLOSSE vaincu · +' + reward + ' OR · vague sécurisée', 180);
      } else this.showMessage('Hostile neutralisé · ' + this.enemies.filter(enemy => !enemy.eliminated).length + ' restant(s).', 100);
      this.updateHud();
    }
    if (attacker === this.commander) this.updateHud();
  }

  soldierAt(x, y) {
    const point = createVector(x, y);
    return this.soldiers.filter(soldier => !soldier.eliminated)
      .sort((a, b) => p5.Vector.dist(point, a.pos) - p5.Vector.dist(point, b.pos))
      .find(soldier => p5.Vector.dist(point, soldier.pos) <= soldier.r * 2.3) || null;
  }

  autoAssignSoldier(soldier) {
    const alive = this.enemies.filter(enemy => !enemy.eliminated);
    if (!soldier || soldier.eliminated) return false;
    if (!alive.length) { this.showMessage('Aucun ennemi actif : le soldat reste sélectionné.', 100); return false; }
    const counts = new Map(alive.map(enemy => [enemy, this.soldiers.filter(unit =>
      unit !== soldier && !unit.eliminated && unit.orderType === 'attack' && unit.target === enemy).length]));
    const minimum = Math.min(...counts.values());
    const options = alive.filter(enemy => counts.get(enemy) === minimum);
    options.sort((a, b) => p5.Vector.dist(soldier.pos, a.pos) - p5.Vector.dist(soldier.pos, b.pos));
    const target = options[0];
    soldier.target = target;
    soldier.orderType = 'attack';
    soldier.orderLabel = 'CIBLE';
    this.selectedEnemy = target;
    this.enemies.forEach(enemy => { enemy.selected = enemy === target; });
    this.fireAt(soldier, target);
    this.showMessage('Fusilier ' + String(soldier.id).padStart(2, '0') + ' · attaque de la cible ' + target.id, 100);
    return true;
  }

  fireAt(unit, target) {
    if (!target || target.eliminated || unit.eliminated || unit.fireCooldown > 0 || p5.Vector.dist(unit.pos, target.pos) > 125) return false;
    if (!this.hasLineOfSight(unit.pos, target.pos)) { this.sparkAtFirstObstacle(unit.pos, target.pos); unit.fireCooldown = 12; return false; }
    target.damage(1);
    this.playAudio('shot-player');
    unit.fireCooldown = 28;
    const direction = p5.Vector.sub(target.pos, unit.pos).normalize();
    unit.attackDirection = direction.heading();
    unit.attackAnimation = 7;
    const muzzle = p5.Vector.add(unit.pos, direction.copy().mult(unit.r + 8));
    this.effects.push({ type: 'shot', from: muzzle, to: target.pos.copy(), life: 8, max: 8 });
    this.effects.push({ type: 'muzzle', pos: muzzle, life: 5, max: 5, color: '#ffd27c' });
    this.onEnemyHit(target, unit);
    this.updateHud();
    return true;
  }

  disperse() {
    const selected = this.soldiers.filter(soldier => soldier.selected && !soldier.eliminated);
    const units = selected.length ? selected : this.soldiers.filter(soldier => !soldier.eliminated);
    const margin = 46;
    const reserved = [];
    for (const soldier of units) {
      let candidate = null;
      for (let attempt = 0; attempt < 80; attempt++) {
        const point = createVector(random(margin, width-margin), random(margin, height-margin));
        const clear = this.obstacles.every(obstacle => p5.Vector.dist(point, obstacle.pos) > obstacle.r + soldier.r + 15) &&
          reserved.every(other => p5.Vector.dist(point, other) > soldier.r * 2 + 12);
        if (clear) { candidate = point; break; }
      }
      if (!candidate) candidate = this.formationPoint(reserved.length);
      reserved.push(candidate.copy());
      soldier.commandTo(candidate);
      soldier.orderLabel = 'RECHERCHE';
      soldier.orderType = 'search';
      soldier.target = null;
    }
    this.showMessage(units.length + ' soldat(s) dispersés · recherche et attaque automatiques.', 120);
  }

  regroup() {
    const selected = this.soldiers.filter(soldier => soldier.selected && !soldier.eliminated);
    const units = selected.length ? selected : this.soldiers.filter(soldier => !soldier.eliminated);
    units.forEach(soldier => {
      const index = this.soldiers.indexOf(soldier);
      soldier.orderLabel = 'FORMATION';
      soldier.orderType = 'formation';
      soldier.target = null;
      soldier.commandTo(this.formationPoint(index));
    });
    this.showMessage('Escouade regroupée en formation', 90);
  }

  engage() {
    const commanderAttacked = this.commanderAttack();
    const alive = this.enemies.filter(enemy => !enemy.eliminated);
    if (!alive.length) {
      if (!commanderAttacked) this.showMessage('Aucune cible hostile à portée.', 90);
      return commanderAttacked;
    }
    const units = this.soldiers.filter(unit => unit.selected && !unit.eliminated);
    if (!units.length) {
      if (!commanderAttacked) this.showMessage('Sélectionnez des soldats pour les engager. La hache sert uniquement à creuser.', 110);
      return commanderAttacked;
    }
    units.forEach(unit => {
      let target = alive.includes(unit.target) ? unit.target : null;
      if (!target && alive.includes(this.selectedEnemy)) target = this.selectedEnemy;
      if (!target) {
        const available = alive.slice().sort((a, b) => {
          const assignedA = this.soldiers.filter(s => s !== unit && s.orderType === 'attack' && s.target === a && !s.eliminated).length;
          const assignedB = this.soldiers.filter(s => s !== unit && s.orderType === 'attack' && s.target === b && !s.eliminated).length;
          return assignedA - assignedB || p5.Vector.dist(unit.pos, a.pos) - p5.Vector.dist(unit.pos, b.pos);
        });
        target = available[0];
      }
      unit.target = target;
      unit.orderType = 'attack';
      unit.orderLabel = 'CIBLE';
      this.fireAt(unit, target);
    });
    this.updateHud();
  }

  selectAt(x, y, clearWhenMiss = true, additive = false) {
    const closest = this.soldiers.filter(soldier => !soldier.eliminated).sort((a,b) => p5.Vector.dist(createVector(x,y),a.pos)-p5.Vector.dist(createVector(x,y),b.pos))[0];
    if (!closest || p5.Vector.dist(createVector(x,y), closest.pos) > closest.r * 2.3) {
      if (clearWhenMiss && !additive) this.soldiers.forEach(soldier => soldier.selected = false);
      return false;
    }
    if (!additive) this.soldiers.forEach(soldier => { if (soldier !== closest) soldier.selected = false; });
    closest.selected = additive ? !closest.selected : true;
    return true;
  }

  updateHud() {
    const el = id => document.getElementById(id);
    if (!el('hudSquad')) return;
    el('hudSquad').textContent = String(this.soldiers.length);
    el('hudHostiles').textContent = String(this.enemies.filter(enemy => !enemy.eliminated).length);
    el('hudWave').textContent = this.wave ? this.waveInLevel + ' / 2' : '—';
    if (el('hudLevel')) el('hudLevel').textContent = String(this.levelNumber);
    const remaining = this.enemies.filter(enemy => !enemy.eliminated).length;
    if (el('levelProgressTitle')) el('levelProgressTitle').textContent = 'LEVEL ' + this.levelNumber + ' · VAGUE ' + this.waveInLevel + '/2';
    if (el('levelProgressCount')) el('levelProgressCount').textContent = remaining + ' HOSTILE' + (remaining === 1 ? '' : 'S');
    if (el('levelProgressFill')) {
      const clearedInWave = this.enemies.length ? Math.max(0, this.currentWaveEnemyCount - remaining) : 0;
      const waveFraction = this.currentWaveEnemyCount ? clearedInWave / this.currentWaveEnemyCount : 0;
      const levelFraction = Math.min(1, (this.levelWavesCleared + waveFraction) / 2);
      el('levelProgressFill').style.width = (levelFraction * 100) + '%';
    }
    const boss = this.enemies.find(enemy => enemy instanceof BossEnemy && !enemy.eliminated);
    const bossPanel = el('bossHealthPanel');
    if (bossPanel) {
      bossPanel.hidden = !boss;
      if (boss) {
        el('bossHealthText').textContent = boss.health + ' / ' + boss.maxHealth;
        el('bossHealthFill').style.width = (boss.health / boss.maxHealth * 100) + '%';
      }
    }
    el('hudMap').textContent = this.level.label;
    if (el('hudHome')) el('hudHome').textContent = Math.ceil((this.home?.health ?? 150) / (this.home?.maxHealth ?? 150) * 100) + '%';
    const hospitalStatus = el('hudHospital');
    if (hospitalStatus) {
      const nearby = this.hospital && this.commander && p5.Vector.dist(this.commander.pos, this.hospital.pos) <= this.hospital.r + this.commander.r;
      hospitalStatus.textContent = this.hospitalUsed ? 'UTILISÉ' : nearby ? 'H · SOIGNER' : 'DISPONIBLE';
      hospitalStatus.parentElement?.classList?.toggle('used', this.hospitalUsed);
    }
    if (el('hudWeapon')) el('hudWeapon').textContent = this.commander?.hasRifle ? 'FUSIL · T TIRER' : 'HACHE · E FOUILLER';
    if (el('hudGold')) el('hudGold').textContent = String(this.gold);
  }

  render() {
    this.updateNotifications();
    this.drawWorld();
    if (this.phase === 'victory' || this.phase === 'defeat') this.drawEndCard(this.phase === 'victory');
    this.updateHud();
  }

  playAudio(eventName) {
    if (typeof gameAudio !== 'undefined' && gameAudio) gameAudio.play(eventName);
  }

  drawWorld() {
    push();
    if (this.cameraShake > .12) {
      translate(Math.sin(frameCount * 1.7) * this.cameraShake, Math.cos(frameCount * 1.3) * this.cameraShake);
      this.cameraShake *= .84;
    } else this.cameraShake = 0;
    if (this.transitionFrames > 0) this.transitionFrames--;
    const theme = this.level;
    this.drawEnvironment(theme);
    if (this.hospital) this.hospital.render(this.hospitalUsed);
    if (this.cache) this.cache.renderClue();
    this.obstacles.forEach(obstacle => obstacle.render(theme));
    if (this.cache) this.cache.renderPrompt();
    this.goldCoins.forEach(coin => coin.render());
    this.recruits.forEach(recruit => recruit.render());
    if (this.home) this.home.render();
    this.enemies.filter(enemy => !enemy.eliminated).forEach(enemy => enemy.render());
    this.drawEnemyAssignments();
    this.soldiers.filter(soldier => !soldier.eliminated).forEach(soldier => soldier.render());
    if (this.commander && !this.commander.eliminated) this.commander.render();
    this.drawEffects();
    if (this.levelTransition) this.drawLevelTransition();
    this.drawOrders();
    if (this.debug && this.commander) this.drawDebug();
    // Keep this in-world hint above later-drawn trees, buildings, and units.
    if (this.hospital && this.phase === 'playing') this.drawHospitalPrompt();
    if (this.paused && this.phase === 'playing') this.drawPause();
    if (this.transitionFrames > 0) {
      noStroke(); fill(5, 10, 13, this.transitionFrames / 24 * 220); rect(0, 0, width, height);
    }
    pop();
  }

  drawLevelTransition() {
    const transition = this.levelTransition;
    const progress = 1 - transition.life / transition.max;
    const fade = Math.min(1, transition.life / 18, progress * 7);
    push(); rectMode(CENTER); textAlign(CENTER, CENTER);
    noStroke(); fill(4, 10, 12, 105 * fade); rect(width / 2, height / 2, width, height);
    noFill(); stroke(195, 238, 174, 190 * fade); strokeWeight(2);
    circle(width / 2, height / 2, 110 + (1 - fade) * 130);
    noStroke(); fill('#d9f4be'); textSize(13); text('SECTEUR SÉCURISÉ', width / 2, height / 2 - 28);
    fill('#f5f2d9'); textSize(42); text(String(transition.level).startsWith('BOSS') ? transition.level : 'LEVEL ' + transition.level, width / 2, height / 2 + 4);
    fill('#bad0b9'); textSize(9); text(transition.level === 'BOSS VAINCU' ? 'RÉCOMPENSE VALIDÉE' : 'RENFORTS EN APPROCHE', width / 2, height / 2 + 38);
    pop();
  }

  drawEnemyAssignments() {
    this.enemies.filter(enemy => !enemy.eliminated).forEach(enemy => {
      const count = this.assignedSoldiers(enemy).length;
      const label = count + (count === 1 ? ' SOLDAT' : ' SOLDATS');
      push(); rectMode(CENTER); textAlign(CENTER, CENTER); textSize(7);
      const pillWidth = textWidth(label) + 12, x = enemy.pos.x + enemy.r + 18, y = enemy.pos.y - enemy.r - 10;
      noStroke(); fill(count ? '#36251ddd' : '#111b1ddd'); rect(x, y, pillWidth, 16, 6);
      stroke(count ? '#f5cc8277' : '#dbe8d433'); strokeWeight(1); noFill(); rect(x, y, pillWidth, 16, 6);
      noStroke(); fill(count ? '#ffe0a1' : '#b4c2b8'); text(label, x, y);
      pop();
    });
  }

  drawHospitalPrompt() {
    const distance = p5.Vector.dist(this.commander.pos, this.hospital.pos);
    if (distance > this.hospital.r + 48 || this.hospitalUsed) return;
    const label = 'H  ·  SOIN UNIQUE';
    const promptWidth = textWidth(label) + 18;
    noFill(); stroke(166, 244, 220, 36); strokeWeight(1);
    circle(this.hospital.pos.x, this.hospital.pos.y, this.hospital.r * 2);
    push(); rectMode(CENTER); textAlign(CENTER, CENTER); textSize(8);
    const promptX = this.hospital.pos.x + 36;
    noStroke(); fill('#081511f2'); rect(promptX, this.hospital.pos.y + 48, promptWidth, 19, 6);
    stroke('#a6f4dcaa'); strokeWeight(1); noFill(); rect(promptX, this.hospital.pos.y + 48, promptWidth, 19, 6);
    noStroke(); fill('#d9fff0'); text(label, promptX, this.hospital.pos.y + 48); pop();
  }

  drawEnvironment(theme) {
    const w = width, h = height, ctx = drawingContext;
    const base = ctx.createLinearGradient(0, 0, w * .7, h);
    if (this.levelKey === 'forest') {
      base.addColorStop(0, '#172d25'); base.addColorStop(.48, '#35583a'); base.addColorStop(1, '#172a23');
    } else if (this.levelKey === 'interior') {
      base.addColorStop(0, '#202b31'); base.addColorStop(.42, '#53615d'); base.addColorStop(1, '#252e33');
    } else if (this.levelKey === 'outpost') {
      base.addColorStop(0, '#8e7250'); base.addColorStop(.38, '#b49463'); base.addColorStop(1, '#5e5948');
    } else {
      base.addColorStop(0, '#31263f'); base.addColorStop(.48, '#59435e'); base.addColorStop(1, '#201d31');
    }
    ctx.save(); ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); ctx.restore();
    push();
    if (this.levelKey === 'forest') this.drawForestEnvironment(w, h);
    else if (this.levelKey === 'interior') this.drawInteriorEnvironment(w, h);
    else if (this.levelKey === 'outpost') this.drawOutpostEnvironment(w, h);
    else this.drawArenaEnvironment(w, h);

    const waveGlow = Math.min(.1, this.wave * .025) * (.78 + Math.sin(frameCount * .018) * .22);
    if (waveGlow > 0) {
      ctx.save(); ctx.globalAlpha = waveGlow;
      ctx.fillStyle = this.levelKey === 'interior' ? '#59c9d8' : this.levelKey === 'arena' ? '#c079ff' : '#ff9d63';
      ctx.fillRect(0, 0, w, h); ctx.restore();
    }
    this.drawAmbientParticles(w, h);

    const vignette = ctx.createRadialGradient(w * .5, h * .48, Math.min(w, h) * .12, w * .5, h * .5, Math.max(w, h) * .72);
    vignette.addColorStop(0, '#00000000');
    vignette.addColorStop(1, this.levelKey === 'arena' ? '#100c1b85' : '#08100c78');
    ctx.save(); ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h); ctx.restore();
    pop();
  }

  drawForestEnvironment(w, h) {
    const ctx = drawingContext, wind = Math.sin(frameCount * .018);
    // A distant canopy and a low valley establish depth behind the playable clearing.
    noStroke(); fill('#10251f');
    beginShape(); vertex(0, h * .29); vertex(0, h * .13); vertex(w * .08, h * .2); vertex(w * .16, h * .09);
    vertex(w * .25, h * .22); vertex(w * .36, h * .1); vertex(w * .47, h * .2); vertex(w * .59, h * .08);
    vertex(w * .71, h * .2); vertex(w * .82, h * .11); vertex(w * .94, h * .22); vertex(w, h * .12); vertex(w, h * .36); endShape(CLOSE);
    fill('#496345'); beginShape(); vertex(0, h * .35); vertex(w * .12, h * .28); vertex(w * .25, h * .36);
    vertex(w * .43, h * .25); vertex(w * .58, h * .34); vertex(w * .76, h * .26); vertex(w, h * .34); vertex(w, h * .48); vertex(0, h * .48); endShape(CLOSE);
    fill('#193a2b'); beginShape(); vertex(0,h*.72); vertex(w*.16,h*.62); vertex(w*.34,h*.7); vertex(w*.54,h*.61); vertex(w*.72,h*.72); vertex(w,h*.63); vertex(w,h); vertex(0,h); endShape(CLOSE);

    // Sun shafts fade through the canopy and stop before washing out units.
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const x = w * (.17 + i * .2) + wind * 5;
      const beam = ctx.createLinearGradient(x, h * .12, x + 65, h * .8);
      beam.addColorStop(0, '#f5e8a51c'); beam.addColorStop(.55, '#d9eaa007'); beam.addColorStop(1, '#d9eaa000');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x, h * .12); ctx.lineTo(x + 20, h * .12);
      ctx.lineTo(x + 95, h * .78); ctx.lineTo(x + 5, h * .72); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // Winding earth path, layered with a dark rut and a narrow warm center.
    noFill(); stroke('#1b261d'); strokeWeight(Math.max(38, h * .16));
    bezier(-w*.05,h*.79,w*.21,h*.73,w*.16,h*.48,w*.43,h*.47);
    bezier(w*.43,h*.47,w*.67,h*.46,w*.55,h*.25,w*1.05,h*.2);
    stroke('#92794c'); strokeWeight(Math.max(29, h * .12));
    bezier(-w*.05,h*.79,w*.21,h*.73,w*.16,h*.48,w*.43,h*.47);
    bezier(w*.43,h*.47,w*.67,h*.46,w*.55,h*.25,w*1.05,h*.2);
    stroke('#c3a46a55'); strokeWeight(2);
    bezier(-w*.04,h*.77,w*.2,h*.7,w*.17,h*.49,w*.43,h*.45);
    bezier(w*.43,h*.45,w*.66,h*.43,w*.59,h*.27,w*1.02,h*.22);

    // Soft leaf litter and grass tufts: fixed layout, gentle wind only.
    for (let i = 0; i < 58; i++) {
      const x = (i * 137 + 23) % w, y = (i * 83 + 17) % h;
      const size = 2 + (i % 4);
      noStroke(); fill(i % 3 === 0 ? '#b6cc7150' : i % 3 === 1 ? '#102a1e70' : '#dcc47630');
      ellipse(x, y, size * 1.9, size * .8);
      if (i % 3 === 0) {
        stroke('#9ac47785'); strokeWeight(1);
        line(x, y, x - 3 + wind * 2, y - 7 - (i % 3));
        line(x + 1, y, x + 5 + wind * 2, y - 5);
      }
      if (i % 11 === 2) {
        noStroke(); fill(i % 2 ? '#e9a5a0' : '#f0d47a'); circle(x + 3, y - 4, 3); fill('#f4e6b1'); circle(x + 3, y - 4, 1.1);
      }
    }
    // Atmospheric trunks frame the clearing without adding collision bodies.
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1, x = side < 0 ? w * (.025 + (i % 3) * .025) : w * (.95 - (i % 3) * .025);
      const y = h * (.1 + i * .115), r = Math.min(w, h) * (.035 + (i % 3) * .009);
      push(); translate(x, y);
      noStroke(); fill('#101b17a8'); ellipse(5, r * .65, r * 2.7, r * 1.2);
      fill('#483d2b'); rect(-r*.18, -r*.08, r*.36, r*1.35, 4);
      fill(i % 2 ? '#183b2a' : '#21462d'); ellipse(0, -r*.18, r*2.4, r*1.45);
      fill('#37613a88'); ellipse(-r*.2, -r*.28, r*1.55, r*.82);
      stroke('#76a55b45'); strokeWeight(2); line(-r*.7, -r*.35, r*.62, -r*.17);
      pop();
    }
    // Light pools between trees.
    ctx.save(); const pool = ctx.createRadialGradient(w*.54,h*.42,0,w*.54,h*.42,w*.43);
    pool.addColorStop(0,'#e9d68a12'); pool.addColorStop(1,'#e9d68a00'); ctx.fillStyle=pool; ctx.fillRect(0,0,w,h); ctx.restore();
  }

  drawInteriorEnvironment(w, h) {
    const ctx = drawingContext, pulse = .72 + Math.sin(frameCount * .045) * .12;
    // A distant bulkhead with illuminated observation panes.
    noStroke(); fill('#172329'); rect(0, 0, w, h * .18);
    fill('#29373a'); quad(0,h*.14,w,h*.14,w,h*.22,0,h*.24);
    for (let i = 0; i < 7; i++) {
      const x = w * (.055 + i * .14), ww = w * .095;
      fill('#111d23'); rect(x, h*.035, ww, h*.095, 4);
      ctx.save(); ctx.shadowColor = i % 3 === 1 ? '#8de8da' : '#e1bd79'; ctx.shadowBlur = 10;
      fill(i % 3 === 1 ? `rgba(94,205,191,${pulse})` : `rgba(197,150,83,${pulse*.62})`); rect(x+5,h*.045,ww-10,h*.065,2); ctx.restore();
      fill('#667474'); rect(x+ww*.44,h*.13,4,h*.025);
    }
    // Perspective floor plates converge toward the far wall, not a flat checkerboard.
    const floor = ctx.createLinearGradient(0,h*.18,0,h);
    floor.addColorStop(0,'#64706b'); floor.addColorStop(.38,'#46534f'); floor.addColorStop(1,'#293338');
    ctx.save(); ctx.fillStyle=floor; ctx.fillRect(0,h*.2,w,h*.8); ctx.restore();
    stroke('#b4c2b422'); strokeWeight(1);
    for (let i=0;i<13;i++) {
      const t=i/12, y=h*(.22 + t*t*.76); line(0,y,w,y);
    }
    for (let i=0;i<11;i++) { const x=w*i/10; line(w*.5,h*.19,x,h); }
    // A worn transport lane, recessed curbs and intermittent center lamps.
    noStroke(); fill('#222d31'); quad(w*.27,h*.21,w*.73,h*.21,w*.97,h,w*.03,h);
    fill('#748078'); quad(w*.265,h*.21,w*.285,h*.21,w*.055,h,w*.025,h);
    quad(w*.715,h*.21,w*.735,h*.21,w*.975,h,w*.945,h);
    fill('#394348'); quad(w*.29,h*.22,w*.71,h*.22,w*.91,h,w*.09,h);
    ctx.save(); ctx.setLineDash([14,18]); ctx.strokeStyle='#d0b46c66'; ctx.lineWidth=2; ctx.beginPath();
    ctx.moveTo(w*.5,h*.25);ctx.lineTo(w*.5,h);ctx.stroke();ctx.restore();
    // Service strips, pipes and warning panels hug the perimeter.
    for (let side of [-1,1]) {
      const x=side<0?w*.035:w*.965; ctx.save(); ctx.shadowColor='#74d5d0';ctx.shadowBlur=8;
      stroke('#6b8c8b');strokeWeight(5);line(x,h*.22,x,h*.94);stroke('#b2d4c2');strokeWeight(1);line(x+side*4,h*.22,x+side*4,h*.94);ctx.restore();
      for(let i=0;i<4;i++){const y=h*(.31+i*.16); noStroke(); fill(i%2?'#d6a85b':'#bb6c4f'); rect(side<0?w*.05:w*.91,y,w*.04,h*.018,2);}
    }
    for(let i=0;i<9;i++){
      const x=(i*97+43)%w,y=h*(.27+((i*41)%60)/100);
      if(i%2===0){noStroke();fill('#202b2d99');ellipse(x,y,25+i%4*7,7);fill('#8ec1ac28');ellipse(x-3,y-1,13,3);}
      else{stroke('#abb7a53a');strokeWeight(1);line(x,y,x+12,y+7);line(x+12,y+7,x+20,y+4);}
    }
    // Damp reflections in the lower service bay.
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<5;i++){const x=w*(.15+i*.17),y=h*(.73+(i%2)*.11),g=ctx.createRadialGradient(x,y,0,x,y,w*.12);g.addColorStop(0,'#76d2cc18');g.addColorStop(1,'#76d2cc00');ctx.fillStyle=g;ctx.fillRect(x-w*.12,y-h*.08,w*.24,h*.16);}
    ctx.restore();
  }

  drawOutpostEnvironment(w, h) {
    const ctx=drawingContext, shimmer=Math.sin(frameCount*.022)*4;
    // Ochre mesas overlap along the horizon; the floor falls into a dry basin.
    noStroke(); fill('#453f39'); beginShape();vertex(0,h*.35);vertex(0,h*.17);vertex(w*.11,h*.09);vertex(w*.2,h*.23);vertex(w*.33,h*.07);vertex(w*.43,h*.19);vertex(w*.55,h*.1);vertex(w*.67,h*.25);vertex(w*.8,h*.08);vertex(w*.91,h*.2);vertex(w,h*.13);vertex(w,h*.37);endShape(CLOSE);
    fill('#75634a');beginShape();vertex(0,h*.36);vertex(w*.13,h*.25);vertex(w*.25,h*.34);vertex(w*.39,h*.22);vertex(w*.55,h*.34);vertex(w*.72,h*.23);vertex(w*.86,h*.32);vertex(w,h*.24);vertex(w,h*.48);vertex(0,h*.47);endShape(CLOSE);
    fill('#b28d59');beginShape();vertex(0,h*.39);vertex(w*.16,h*.33);vertex(w*.31,h*.4);vertex(w*.49,h*.31);vertex(w*.67,h*.4);vertex(w*.84,h*.32);vertex(w,h*.39);vertex(w,h);vertex(0,h);endShape(CLOSE);
    // Sunken convoy track with two dusty wheel grooves.
    noFill();stroke('#514633');strokeWeight(h*.17);bezier(w*.92,h*.17,w*.72,h*.29,w*.73,h*.48,w*.46,h*.55);bezier(w*.46,h*.55,w*.28,h*.62,w*.4,h*.83,w*.07,h*1.03);
    stroke('#8f7149');strokeWeight(h*.135);bezier(w*.92,h*.17,w*.72,h*.29,w*.73,h*.48,w*.46,h*.55);bezier(w*.46,h*.55,w*.28,h*.62,w*.4,h*.83,w*.07,h*1.03);
    stroke('#d5b27a55');strokeWeight(2);bezier(w*.92,h*.17,w*.72,h*.29,w*.73,h*.48,w*.46,h*.55);bezier(w*.46,h*.55,w*.28,h*.62,w*.4,h*.83,w*.07,h*1.03);
    // Watch mast and distant prefab shelter.
    push();translate(w*.83,h*.19);stroke('#302f2a');strokeWeight(4);line(0,0,0,h*.18);line(-12,h*.08,12,h*.08);line(-10,h*.18,0,0);line(10,h*.18,0,0);noStroke();fill('#c9a564');rect(-18,-8,36,15,2);fill('#f7d585');rect(-10,-5,7,5,1);pop();
    push();translate(w*.12,h*.27);noStroke();fill('#55483a');rect(-28,-10,56,30,3);fill('#362f2b');triangle(-34,-10,0,-31,34,-10);fill('#c69b59');rect(-9,1,18,19,2);pop();
    // Wind-carved contours and scrub, with animated grains.
    stroke('#efd39a30');strokeWeight(1);
    for(let i=0;i<7;i++){const y=h*(.48+i*.075)+Math.sin(frameCount*.012+i)*2;noFill();bezier(-w*.08,y,w*.22,y-14,w*.5,y+18,w*1.08,y-7);}
    for(let i=0;i<43;i++){
      const x=(i*151+31)%w,y=h*(.43+((i*67)%55)/100),size=2+i%5;
      noStroke();fill(i%3===0?'#d9bd8030':'#443e3038');ellipse(x+shimmer*(i%2?1:-1),y,size*2,size*.7);
      if(i%4===0){stroke('#48503a');strokeWeight(2);line(x,y,x-3,y-6);line(x,y,x+4,y-7);noStroke();fill('#9b895d');circle(x-3,y-6,3);circle(x+4,y-7,3);}
      if(i%9===0){noStroke();fill('#e2c99480');circle(x+11,y+5,1.5);circle(x+16,y+3,1);}
    }
    // Warm sun haze at the ridgeline.
    const haze=ctx.createRadialGradient(w*.7,h*.16,0,w*.7,h*.16,w*.55);haze.addColorStop(0,'#ffd58a36');haze.addColorStop(1,'#ffd58a00');ctx.save();ctx.fillStyle=haze;ctx.fillRect(0,0,w,h*.58);ctx.restore();
  }

  drawArenaEnvironment(w, h) {
    const ctx=drawingContext, cx=w*.5, cy=h*.55, r=Math.min(w,h)*.68, pulse=1+Math.sin(frameCount*.025)*.012;
    // A buried amphitheatre: raised concentric terraces and luminous inlaid seams.
    ctx.save();const radial=ctx.createRadialGradient(cx,cy,r*.08,cx,cy,r*1.2);radial.addColorStop(0,'#72566f');radial.addColorStop(.43,'#45364f');radial.addColorStop(1,'#211d31');ctx.fillStyle=radial;ctx.fillRect(0,0,w,h);ctx.restore();
    noStroke();fill('#211a2b');ellipse(cx,cy,r*2.4,r*2.05);
    for(let i=0;i<5;i++){
      const ring=r*(1.02-i*.15)*pulse;
      noFill();stroke(i%2?'#c095dc25':'#67d7c526');strokeWeight(i===0?12:5);ellipse(cx,cy,ring*2,ring*1.72);
      stroke('#e5ceee16');strokeWeight(1);ellipse(cx,cy,(ring-8)*2,(ring-8)*1.72);
    }
    // Radial paving wedges and engraved marks.
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12,inner=r*.38,outer=r*(.91+(i%3)*.025);
      stroke(i%3===0?'#d4a4e94c':'#d5c4d51b');strokeWeight(i%3===0?2:1);
      line(cx+Math.cos(a)*inner,cy+Math.sin(a)*inner*.86,cx+Math.cos(a)*outer,cy+Math.sin(a)*outer*.86);
      if(i%2===0){const x=cx+Math.cos(a)*outer*.82,y=cy+Math.sin(a)*outer*.7;noStroke();fill('#b991c337');circle(x,y,2+i%4);}
    }
    // Four corner obelisks and their restrained cyan edge-light.
    for(let i=0;i<4;i++){
      const x=w*(i%2?.93:.07),y=h*(i<2?.18:.82),size=Math.min(w,h)*(.045+(i%2)*.008);
      push();translate(x,y);noStroke();fill('#191622aa');ellipse(3,size*.75,size*2.3,size*.65);
      fill('#342844');quad(-size*.45,size*.6,-size*.34,-size*.7,0,-size, size*.34,-size*.7,size*.45,size*.6);
      fill('#725887');quad(-size*.2,size*.5,-size*.13,-size*.68,0,-size*.87,size*.13,-size*.68,size*.2,size*.5);
      drawingContext.save();drawingContext.shadowColor='#75e6d1';drawingContext.shadowBlur=11;stroke('#8ce9d2');strokeWeight(2);line(0,-size*.62,0,size*.34);drawingContext.restore();pop();
    }
    // Glowing mineral seams pulse slowly between the paving stones.
    ctx.save();ctx.globalCompositeOperation='screen';ctx.shadowBlur=8;ctx.shadowColor='#cc8bff';ctx.strokeStyle='#c28ad94f';ctx.lineWidth=2;
    for(let i=0;i<8;i++){const a=i*Math.PI/4,outer=r*(.82+(i%2)*.06),mid=r*.48;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*outer,cy+Math.sin(a)*outer*.86);ctx.lineTo(cx+Math.cos(a+.12)*mid,cy+Math.sin(a+.12)*mid*.86);ctx.lineTo(cx+Math.cos(a-.08)*r*.25,cy+Math.sin(a-.08)*r*.22);ctx.stroke();}
    ctx.restore();
    // Dust glints gather near the old ring grooves.
    noStroke();for(let i=0;i<20;i++){const a=i*2.4+frameCount*.002,rr=r*(.68+(i%4)*.035);fill(i%2?'#b6f4df70':'#efbaf270');circle(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr*.86,1.5+i%3);}
  }

  drawAmbientParticles(w, h) {
    const color=this.levelKey==='forest'?'#d9edaa':this.levelKey==='interior'?'#a4e5df':this.levelKey==='outpost'?'#f0d09a':'#d9b4f2';
    noStroke();
    for(let i=0;i<22;i++){
      const speed=this.levelKey==='outpost'?.55:this.levelKey==='interior'?.25:.18;
      const x=(i*149+frameCount*(i%3+1)*speed)%w;
      const y=(i*83+Math.sin(frameCount*.018+i)*12+frameCount*(this.levelKey==='outpost'?.12:.04))%h;
      drawingContext.globalAlpha=.12+(i%4)*.035;fill(color);circle(x,y,this.levelKey==='outpost'?1.4+i%3:1.2+i%2);
    }
    drawingContext.globalAlpha=1;
  }

  drawOrders() {
    this.orders.forEach(order => {
      const alpha = map(order.life,0,order.max,0,220);
      noFill();
      if (order.kind === 'tactical') stroke('#ffc66d');
      else stroke(123,232,240,alpha);
      strokeWeight(2); circle(order.pos.x,order.pos.y,26+(order.max-order.life)*1.5);
      line(order.pos.x-8,order.pos.y,order.pos.x+8,order.pos.y);
      line(order.pos.x,order.pos.y-8,order.pos.x,order.pos.y+8);
    });
  }

  drawEffects() {
    this.effects.forEach(effect => {
      const alpha = map(effect.life,0,effect.max,0,230);
      if (effect.type === 'shot') {
        this.drawTracer(effect, '#ffdc91', alpha);
      } else if (effect.type === 'player-shot') {
        this.drawTracer(effect, '#a8f4e8', alpha);
      } else if (effect.type === 'melee') {
        push(); noFill(); stroke(effect.empowered ? 198 : 255, effect.empowered ? 161 : 226, effect.empowered ? 255 : 154, alpha); strokeWeight(effect.empowered ? 6 : 4);
        arc(effect.pos.x, effect.pos.y, 66, 66, effect.angle - .9, effect.angle + .9);
        stroke(255, 242, 205, alpha); strokeWeight(2); line(effect.pos.x, effect.pos.y, effect.target.x, effect.target.y); pop();
      } else if (effect.type === 'cache-reveal') {
        push(); noFill(); stroke(219, 246, 155, alpha); strokeWeight(3); circle(effect.pos.x, effect.pos.y, 18 + (effect.max-effect.life)*3); pop();
      } else if (effect.type === 'healing') {
        push(); noFill(); stroke(163, 245, 194, alpha); strokeWeight(3); circle(effect.pos.x, effect.pos.y, 18 + (effect.max-effect.life)*3); pop();
      } else if (effect.type === 'enemy-shot') {
        this.drawTracer(effect, '#ff526e', alpha);
      } else if (effect.type === 'muzzle') {
        push(); drawingContext.shadowBlur = 16; drawingContext.shadowColor = effect.color; noStroke(); fill(255,226,151,alpha); circle(effect.pos.x,effect.pos.y,4+(effect.max-effect.life)*1.3); drawingContext.shadowBlur = 0; pop();
      } else if (effect.type === 'enemy-death') {
        push(); drawingContext.shadowBlur = 8; drawingContext.shadowColor = effect.color; drawingContext.globalAlpha = alpha / 255; noStroke(); fill(effect.color); circle(effect.pos.x,effect.pos.y,Math.max(2,effect.size*(effect.life/effect.max))); drawingContext.globalAlpha = 1; drawingContext.shadowBlur = 0; pop();
      } else if (effect.type === 'boss-arrival') {
        push(); noFill(); stroke(255, 112, 83, alpha); strokeWeight(3); circle(effect.pos.x, effect.pos.y, 42 + (effect.max - effect.life) * 2.4); stroke(247, 202, 123, alpha * .55); strokeWeight(1); circle(effect.pos.x, effect.pos.y, 75 + (effect.max - effect.life) * 2.8); pop();
      } else if (effect.type === 'boss-slam') {
        push(); noFill(); stroke(255, 117, 89, alpha); strokeWeight(5 * effect.life / effect.max); circle(effect.pos.x, effect.pos.y, effect.radius * 2 * (1 - effect.life / effect.max)); stroke(255, 209, 130, alpha * .5); strokeWeight(2); circle(effect.pos.x, effect.pos.y, effect.radius * 1.55 * (1 - effect.life / effect.max)); pop();
      } else if (effect.type === 'boss-impact') {
        push(); noFill(); stroke(255, 190, 111, alpha); strokeWeight(3); circle(effect.pos.x, effect.pos.y, effect.radius + (effect.max - effect.life) * 2); pop();
      } else if (effect.type === 'boss-reward') {
        push(); noFill(); stroke(255, 224, 138, alpha); strokeWeight(3); circle(effect.pos.x, effect.pos.y, 24 + (effect.max - effect.life) * 2.1); fill('#fff0a8'); noStroke(); textAlign(CENTER, CENTER); textSize(12); text('+' + (12 + this.levelNumber * 3) + ' OR', effect.pos.x, effect.pos.y - 40 - (effect.max - effect.life) * .35); pop();
      } else if (effect.type === 'heal-spark') {
        noStroke(); fill(164,248,205,alpha); circle(effect.pos.x,effect.pos.y,3+(effect.life/effect.max)*3);
      } else if (effect.type === 'obstacle-spark') {
        push(); noStroke(); fill(255,196,107,alpha); circle(effect.pos.x,effect.pos.y,2+(effect.life/effect.max)*2); pop();
      } else if (effect.type === 'gold-pickup') {
        push(); noFill(); stroke(255,218,126,alpha); strokeWeight(2);
        circle(effect.pos.x,effect.pos.y,10+(effect.max-effect.life)*2.2);
        noStroke(); fill('#ffe6a1'); textAlign(CENTER,CENTER); textSize(9); text('+1 OR',effect.pos.x,effect.pos.y-14-(effect.max-effect.life)*.3); pop();
      } else if (effect.type === 'recruit') {
        noFill(); stroke(118,255,225,alpha); strokeWeight(3); circle(effect.pos.x,effect.pos.y,20+(effect.max-effect.life)*3);
      } else {
        noFill(); stroke(255,112,126,alpha); strokeWeight(3); circle(effect.pos.x,effect.pos.y,12+(effect.max-effect.life)*2);
      }
    });
  }

  drawTracer(effect, color, alpha) {
    const progress = 1 - effect.life / effect.max;
    const point = p5.Vector.lerp(effect.from, effect.to, progress);
    push(); drawingContext.shadowBlur = 12; drawingContext.shadowColor = color;
    drawingContext.globalAlpha = alpha / 255;
    stroke(color); strokeWeight(3);
    line(effect.from.x,effect.from.y,point.x,point.y);
    drawingContext.globalAlpha = 1;
    noStroke(); fill(color); circle(point.x,point.y,4);
    drawingContext.shadowBlur = 0; pop();
  }

  spawnDeathBurst(enemy) {
    const colors = this.levelKey === 'interior' ? ['#91d9cf','#d7fbda'] :
      this.levelKey === 'forest' ? ['#ff9275','#f4c77c'] :
        this.levelKey === 'outpost' ? ['#ffc36f','#e9e2c3'] : ['#d2a6ff','#ff9aa7'];
    const boss = enemy instanceof BossEnemy;
    this.effects.push({ type: 'enemy-death', pos: enemy.pos.copy(), life: boss ? 42 : 20, max: boss ? 42 : 20, size: boss ? 76 : 24, color: colors[0] });
    for (let index = 0; index < (boss ? 18 : 9); index++) {
      const angle = index * Math.PI * 2 / 9;
      const speed = (boss ? 2 : 1.2) + (index % 3) * .65;
      this.effects.push({ type: 'enemy-death', pos: enemy.pos.copy(), vel: createVector(Math.cos(angle) * speed, Math.sin(angle) * speed), life: (boss ? 34 : 24) + index % 5, max: (boss ? 34 : 24) + index % 5, size: (boss ? 8 : 5) + index % 3, color: colors[index % colors.length] });
    }
    if (boss) this.effects.push({ type: 'boss-slam', pos: enemy.pos.copy(), life: 45, max: 45, radius: 105 });
  }

  sparkAtFirstObstacle(start, end) {
    const segment = p5.Vector.sub(end, start), lengthSquared = segment.magSq();
    if (!lengthSquared) return;
    let closest = null, closestT = Infinity;
    for (const obstacle of this.obstacles) {
      const t = constrain(p5.Vector.dot(p5.Vector.sub(obstacle.pos, start), segment) / lengthSquared, 0, 1);
      const point = p5.Vector.add(start, segment.copy().mult(t));
      if (p5.Vector.dist(point, obstacle.pos) <= obstacle.r + 5 && t < closestT) { closest = point; closestT = t; }
    }
    if (!closest) return;
    if (this.effects.some(effect => effect.type === 'obstacle-spark' && p5.Vector.dist(effect.pos, closest) < 9)) return;
    for (let index = 0; index < 4; index++) {
      const angle = (index / 4) * Math.PI * 2;
      this.effects.push({ type: 'obstacle-spark', pos: closest.copy(), vel: createVector(Math.cos(angle) * 1.4, Math.sin(angle) * 1.4), life: 12, max: 12 });
    }
  }

  drawDebug() {
    push(); textFont('monospace'); textSize(8);
    this.obstacles.forEach((obstacle,index) => {
      noFill(); stroke(255,210,118,210); strokeWeight(1); drawingContext.setLineDash([4,4]); circle(obstacle.pos.x,obstacle.pos.y,obstacle.r*2); circle(obstacle.pos.x,obstacle.pos.y,(obstacle.r+this.commander.r/2)*2); drawingContext.setLineDash([]);
      noStroke(); fill('#ffe4a6'); text('O'+(index+1)+' r='+obstacle.r,obstacle.pos.x-obstacle.r,obstacle.pos.y-obstacle.r-4);
    });
    const units=[this.commander,...this.soldiers,...this.enemies].filter(unit=>unit&&!unit.eliminated);
    units.forEach(unit=>{
      const isEnemy=unit instanceof Enemy, color=isEnemy?'#ff8790':unit===this.commander?'#90f0ef':'#c0ef9b';
      noFill(); stroke(color); strokeWeight(1); circle(unit.pos.x,unit.pos.y,unit.r*2);
      line(unit.pos.x-5,unit.pos.y,unit.pos.x+5,unit.pos.y); line(unit.pos.x,unit.pos.y-5,unit.pos.x,unit.pos.y+5);
      const speed='v='+unit.vel.mag().toFixed(1);
      const label=isEnemy?(unit instanceof BossEnemy?'B'+unit.id+' '+unit.specialState+' ':'E'+unit.id+' ')+unit.health+'/'+unit.maxHealth+' '+speed:
        unit===this.commander?'P '+unit.orderType+' '+unit.pos.x.toFixed(0)+','+unit.pos.y.toFixed(0)+' '+unit.weapon+' '+speed:
          'S'+unit.id+' '+unit.orderType+(unit.target&&!unit.target.eliminated?' -> E'+unit.target.id:'')+' '+unit.pos.x.toFixed(0)+','+unit.pos.y.toFixed(0)+' '+speed;
      noStroke(); fill(color); text(label,unit.pos.x+unit.r+4,unit.pos.y-7);
      if(unit.destination){stroke(isEnemy?255:unit===this.commander?144:192,isEnemy?135:unit===this.commander?240:239,isEnemy?144:unit===this.commander?239:155,140);line(unit.pos.x,unit.pos.y,unit.destination.x,unit.destination.y);noFill();circle(unit.destination.x,unit.destination.y,8)}
      if(unit.lastAvoidance?.rays){
        for(const ray of unit.lastAvoidance.rays){if(ray.threatened)stroke(255,111,121,230);else stroke(120,235,212,110);strokeWeight(ray.threatened?2:1);line(unit.pos.x,unit.pos.y,ray.ahead.x,ray.ahead.y);noStroke();fill(ray.threatened?'#ff6f79':'#b7ffe9');circle(ray.ahead2.x,ray.ahead2.y,4)}
      }
      if(unit.target&&!unit.target.eliminated){stroke(255,198,109,210);strokeWeight(1);line(unit.pos.x,unit.pos.y,unit.target.pos.x,unit.target.pos.y)}
    });
    this.enemies.filter(enemy=>!enemy.eliminated).forEach(enemy=>{
      const count=this.assignedSoldiers(enemy).length; noStroke(); fill('#fff0bd'); text('AFFECTÉS '+count,enemy.pos.x+enemy.r+4,enemy.pos.y+7);
    });
    this.goldCoins.filter(coin=>!coin.collected).forEach(coin=>{
      noFill(); stroke(255,212,111,180); strokeWeight(1); circle(coin.pos.x,coin.pos.y,coin.r*3);
      noStroke(); fill('#ffe39b'); text('OR'+coin.id+' '+(coin.attracted?'ATTIRÉ':'AU SOL'),coin.pos.x+10,coin.pos.y-8);
      if (coin.attracted) { stroke(255,212,111,180); line(coin.pos.x,coin.pos.y,this.commander.pos.x,this.commander.pos.y); }
    });
    pop();
  }

  drawPause() {
    push(); noStroke(); fill('#07111bc9'); rect(0,0,width,height);
    fill('#edf4f2'); textAlign(CENTER,CENTER); textSize(28); textStyle(BOLD); text('PAUSE',width/2,height/2);
    fill('#a7bdc5'); textSize(12); textStyle(NORMAL); text('Échap pour reprendre',width/2,height/2+32); pop();
  }

  drawEndCard(victory) {
    push(); noStroke(); fill('#07111bda'); rect(0,0,width,height);
    textAlign(CENTER,CENTER); fill(victory?'#8be8d4':'#ff8991'); textSize(32); textStyle(BOLD);
    text(victory?'MISSION ACCOMPLIE':'MISSION ÉCHOUÉE',width/2,height/2-20);
    fill('#c7d8dc'); textSize(13); textStyle(NORMAL); text('R pour recommencer · Échap pour le menu',width/2,height/2+24); pop();
  }
}
