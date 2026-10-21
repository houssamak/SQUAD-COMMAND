class CommandController {
  constructor(game) {
    this.game = game;
    this.tacticalMode = false;
  }

  acceptsCanvasEvent(event, canvas) {
    return Boolean(event && event.target === canvas);
  }

  click(x, y, tacticalKeyDown = false, levelKey = this.game.levelKey, additive = false) {
    const game = this.game;
    if (game.phase === 'menu') { game.start(levelKey); return 'started'; }
    if (game.phase !== 'playing' || game.paused) return 'ignored';

    const enemy = game.enemyAt(x, y);
    if (enemy) {
      if (this.tacticalMode || tacticalKeyDown) {
        game.cancelCommanderFlee();
        const assigned = game.assignOneSoldier(enemy);
        this.tacticalMode = false;
        game.tacticalMode = false;
        return assigned ? 'soldier-assigned' : 'ignored';
      }
      game.selectEnemy(enemy);
      return 'enemy-selected';
    }

    if (this.tacticalMode || tacticalKeyDown) {
      game.cancelCommanderFlee();
      const soldier = game.soldierAt(x, y);
      if (soldier) {
        soldier.selected = true;
        game.autoAssignSoldier(soldier);
        return 'soldier-selected';
      }
      game.tacticalOrder(x, y);
      return 'tactical-order';
    }
    if (game.selectAt(x, y, true, additive)) return 'selected';
    if (game.controlMode === 'click') { game.orderCommander(x, y); return 'move-order'; }
    return 'follow-mode';
  }

  keydown(key, levelKey = this.game.levelKey) {
    const game = this.game;
    const normalized = String(key).toLowerCase();
    if (normalized === 'escape') {
      if (game.phase === 'victory' || game.phase === 'defeat') { game.phase = 'menu'; return 'menu'; }
      if (game.phase !== 'playing') return 'ignored';
      game.paused = !game.paused;
      return game.paused ? 'paused' : 'resumed';
    }
    if ((game.phase === 'victory' || game.phase === 'defeat') && (normalized === 'r' || normalized === 'enter')) {
      game.start(levelKey); return 'restarted';
    }
    if (game.phase === 'menu') {
      if (normalized === 'enter' || normalized === ' ') { game.start(levelKey); return 'started'; }
      return 'ignored';
    }
    if (game.phase !== 'playing' || game.paused) return 'ignored';
    if (['d','t','e','h','p','r'].includes(normalized)) game.cancelCommanderFlee();
    if (normalized === 'd') {
      this.tacticalMode = true;
      game.tacticalMode = true;
      return 'tactical-mode';
    }
    if (normalized === 't') { game.engage(); return 'engage'; }
    if (normalized === 'e') { game.digCache(); return 'dig'; }
    if (normalized === 'h') { game.useHospital(); return 'hospital'; }
    if (normalized === 'f') { game.fleePlayerAndSelected(); return 'flee'; }
    if (normalized === 'p') { game.disperse(); return 'disperse'; }
    if (normalized === 'r') { game.regroup(); return 'regroup'; }
    return 'ignored';
  }

  keyup(key) {
    if (String(key).toLowerCase() !== 'd') return false;
    this.tacticalMode = false;
    this.game.tacticalMode = false;
    return true;
  }
}
