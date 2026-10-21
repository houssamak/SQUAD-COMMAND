const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  setMag(n) { const m = this.mag(); if (m > 0) this.mult(n / m); return this; }
  normalize() { const m = this.mag(); if (m > 0) this.div(m); return this; }
  limit(n) { if (this.magSq() > n * n) this.setMag(n); return this; }
  heading() { return Math.atan2(this.y, this.x); }
  rotate(angle) {
    const x = this.x * Math.cos(angle) - this.y * Math.sin(angle);
    this.y = this.x * Math.sin(angle) + this.y * Math.cos(angle);
    this.x = x;
    return this;
  }
  set(x, y) { this.x = x; this.y = y; return this; }
  static fromAngle(a) { return new Vector(Math.cos(a), Math.sin(a)); }
  static add(a,b) { return new Vector(a.x+b.x,a.y+b.y); }
  static sub(a,b) { return new Vector(a.x-b.x,a.y-b.y); }
  static dist(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }
  static lerp(a,b,t) { return new Vector(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t); }
  static dot(a,b) { return a.x*b.x+a.y*b.y; }
}

let randomSeed = 17;
const uiNodes = new Map();
const drawnText = [];
const strokeCalls = [];
const audioEvents = [];
const context = vm.createContext({
  p5: { Vector },
  createVector: (x = 0, y = 0) => new Vector(x,y),
  constrain: (value, low, high) => Math.max(low,Math.min(high,value)),
  map: (value,a,b,c,d) => c+(d-c)*((value-a)/(b-a)),
  random: (minimum = 1, maximum) => {
    randomSeed = (randomSeed * 48271) % 2147483647;
    const fraction = randomSeed / 2147483647;
    return maximum === undefined ? fraction * minimum : minimum + fraction * (maximum - minimum);
  },
  TWO_PI: Math.PI * 2,
  frameCount: 0,
  CENTER: 'center',
  push: () => {},
  pop: () => {},
  rectMode: () => {},
  textAlign: () => {},
  textFont: () => {},
  textSize: () => {},
  textWidth: value => String(value).length * 7,
  noStroke: () => {},
  stroke: (...args) => strokeCalls.push(args),
  noFill: () => {},
  fill: () => {},
  strokeWeight: () => {},
  line: () => {},
  circle: () => {},
  rect: () => {},
  drawingContext: { setLineDash: () => {} },
  text: (...args) => drawnText.push(args),
  document: { getElementById: id => { if (!uiNodes.has(id)) uiNodes.set(id,{ textContent: '', style: {} }); return uiNodes.get(id); } },
  gameAudio: { play: eventName => audioEvents.push(eventName) },
  width: 500,
  height: 400,
  Math,
  Number,
  Array,
  Infinity
});
const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
vm.runInContext(read('behaviors/vehicle.js'), context, { filename: 'behaviors/vehicle.js' });
vm.runInContext(read('behaviors/arrival-vehicle.js'), context, { filename: 'behaviors/arrival-vehicle.js' });
vm.runInContext(read('behaviors/vehicle-avec-radar.js'), context, { filename: 'behaviors/vehicle-avec-radar.js' });
for (const file of [
  'src/game/levels.js',
  'src/game/obstacle-contact.js',
  'src/entities/obstacle.js',
  'src/entities/recruit.js',
  'src/entities/world-cache.js',
  'src/entities/hospital.js',
  'src/entities/gold-coin.js',
  'src/entities/enemy.js',
  'src/entities/boss-enemy.js',
  'src/entities/home.js',
  'src/entities/squad-agent.js',
  'src/entities/commander.js',
  'src/entities/soldier.js',
  'src/game/game.js',
  'src/ui/command-controller.js'
]) vm.runInContext(read(file), context, { filename: file });
const setup = vm.runInContext(`({ VehicleAvecRadar, ObstacleContact, SquadAgent, SquadCommandGame, Soldier, Enemy, BossEnemy, TacticalHome, WorldCache, FieldHospital, GoldCoin, CommandController })`, context);

const makeVehicle = (x = 0, y = 0, vx = 1, vy = 0) => {
  const vehicle = new setup.VehicleAvecRadar(x,y);
  vehicle.vel.set(vx,vy);
  vehicle.maxForce = 0.2;
  return vehicle;
};

test('a single ray uses velocity-scaled ahead and ahead2 points and returns the source force budget', () => {
  const vehicle = makeVehicle();
  const force = vehicle.avoidMulti([{ pos: new Vector(15,4), r: 10 }], 1);
  assert.equal(vehicle.lastAvoidance.rays.length, 1);
  assert.equal(vehicle.lastAvoidance.rays[0].ahead.x, 30);
  assert.equal(vehicle.lastAvoidance.rays[0].ahead2.x, 15);
  assert.equal(vehicle.lastAvoidance.rays[0].threatened, true);
  assert.ok(Math.abs(force.x) < 1e-12);
  assert.ok(Math.abs(force.y + 0.1) < 1e-12);
});

test('Arrival reuses the 3-Arrival braking curve and subtracts residual velocity', () => {
  const vehicle = makeVehicle(0,0,2,0);
  const braking = vehicle.arrive(new Vector(0,0),0);
  assert.ok(Math.abs(braking.x + vehicle.maxForce) < 1e-12);
  vehicle.vel.set(0,0);
  const halfRadius = vehicle.arrive(new Vector(50,0),0);
  assert.ok(Math.abs(halfRadius.x - vehicle.maxForce) < 1e-12);
  assert.ok(Math.abs(halfRadius.y) < 1e-12);
});

test('the three-ray average includes clear rays and preserves the 120 degree preview fan', () => {
  const vehicle = makeVehicle();
  const force = vehicle.avoidMulti([{ pos: new Vector(15,0), r: 2 }], 3);
  assert.equal(vehicle.lastAvoidance.rays.length, 3);
  assert.ok(Math.abs(vehicle.lastAvoidance.rays[0].angle + Math.PI/3) < 1e-12);
  assert.equal(vehicle.lastAvoidance.rays.filter(ray => ray.threatened).length, 1);
  assert.ok(Math.abs(force.y - 0.1/3) < 1e-12);
  assert.ok(force.mag() <= vehicle.maxForce/2 + 1e-12);
});

test('each ray selects its closest obstacle and keeps finite forces between multiple obstacles', () => {
  const vehicle = makeVehicle();
  const farther = { id: 'ahead2-near', pos: new Vector(12,0), r: 4 };
  const closest = { id: 'ahead-near', pos: new Vector(30,0), r: 4 };
  vehicle.avoidMulti([farther,closest],1);
  assert.equal(vehicle.lastAvoidance.rays[0].closest.id,'ahead-near');
  const corridor = vehicle.avoidMulti([
    { pos: new Vector(20,20), r: 16 },
    { pos: new Vector(20,-20), r: 16 }
  ],3);
  assert.equal(vehicle.lastAvoidance.rays.length,3);
  assert.ok(Number.isFinite(corridor.x) && Number.isFinite(corridor.y));
});

test('ray detection uses a strict obstacle-radius plus clearance threshold', () => {
  const vehicle = makeVehicle();
  const exactThreshold = vehicle.r / 2 + 5;
  const force = vehicle.avoidMulti([{ pos: new Vector(15,exactThreshold), r: 5 }], 1);
  assert.equal(vehicle.lastAvoidance.rays[0].threatened, false);
  assert.equal(force.mag(), 0);
});

test('invalid obstacle data is ignored and invalid ray counts produce finite zero output', () => {
  const vehicle = makeVehicle();
  const force = vehicle.avoidMulti([{ pos: new Vector(NaN,0), r: 5 }, { pos: new Vector(0,0), r: -2 }], 3);
  assert.equal(force.mag(), 0);
  for (const count of [0, -1, Infinity]) {
    assert.equal(vehicle.avoidMulti([], count).mag(), 0);
    assert.equal(vehicle.lastAvoidance.rays.length, 0);
  }
  assert.equal(vehicle.avoidMulti([], 1.5).mag(), 0);
  assert.equal(vehicle.lastAvoidance.rays.length, 1);
  assert.equal(vehicle.avoidMulti([], 32).mag(), 0);
  assert.equal(vehicle.lastAvoidance.rays.length, 31);
  assert.equal(vehicle.avoidMulti(null,3).mag(),0);
});

test('zero speed returns a finite zero force without mutating shared vectors', () => {
  const vehicle = makeVehicle(2,3,0,0);
  const position = vehicle.pos.copy();
  const velocity = vehicle.vel.copy();
  const obstaclePosition = new Vector(2,3);
  const result = vehicle.avoidMulti([{ pos: obstaclePosition, r: 20 }], 3);
  assert.deepEqual([result.x,result.y],[0,0]);
  assert.deepEqual([vehicle.pos.x,vehicle.pos.y],[position.x,position.y]);
  assert.deepEqual([vehicle.vel.x,vehicle.vel.y],[velocity.x,velocity.y]);
  assert.deepEqual([obstaclePosition.x,obstaclePosition.y],[2,3]);
});

test('SquadAgent composes arrival and multi-ray avoidance, then uses inherited locomotion once', () => {
  const agent = new setup.SquadAgent(100,100,'soldier',{main:'#fff',dark:'#333',trim:'#eee'});
  agent.destination = new Vector(200,100);
  agent.vel.set(4,0);
  const obstacles = [{ pos: new Vector(145,104), r: 18 }];
  agent.steer(obstacles);
  assert.ok(agent.lastAvoidance.rays.some(ray => ray.threatened));
  assert.ok(agent.acc.mag() <= agent.maxForce + 1e-12);
  agent.updateAgent(obstacles);
  assert.ok(agent.pos.x > 100);
  assert.ok(agent.vel.mag() <= agent.maxSpeed + 1e-12);
  assert.equal(agent.acc.mag(),0);
});

test('recruit pickups are one-time and the third recruit starts the first wave', () => {
  const game = new setup.SquadCommandGame();
  game.start('forest');
  for (let index = 0; index < 3; index++) {
    const pickup = game.recruits[0];
    game.commander.pos.set(pickup.pos.x,pickup.pos.y);
    game.commander.destination.set(pickup.pos.x,pickup.pos.y);
    const before = game.soldiers.length;
    game.update();
    assert.equal(game.soldiers.length,before+1);
    assert.equal(game.wave,index === 2 ? 1 : 0);
  }
  assert.equal(game.recruits.length,3);
  assert.equal(game.enemies.length,4);
});

test('tactical orders and P/R preserve missions outside the selected soldiers', () => {
  const game = new setup.SquadCommandGame();
  game.start('outpost');
  const commands = new setup.CommandController(game);
  game.soldiers = [new setup.Soldier(230,190,1),new setup.Soldier(250,190,2),new setup.Soldier(270,190,3)];
  const originalPositions = game.soldiers.map(unit => unit.pos.copy());
  game.soldiers[1].selected = true;
  commands.keydown('d');
  commands.click(330,230);
  commands.keyup('d');
  assert.equal(game.soldiers[0].orderLabel,'FORMATION');
  assert.equal(game.soldiers[1].orderLabel,'TACTIQUE');
  assert.equal(game.soldiers[2].orderLabel,'FORMATION');
  commands.keydown('p');
  for (let index=0;index<game.soldiers.length;index++) {
    assert.deepEqual([game.soldiers[index].pos.x,game.soldiers[index].pos.y],[originalPositions[index].x,originalPositions[index].y]);
    assert.equal(game.soldiers[index].orderLabel,index === 1 ? 'RECHERCHE' : 'FORMATION');
    assert.equal(game.soldiers[index].orderType,index === 1 ? 'search' : 'formation');
  }
  assert.notDeepEqual([game.soldiers[1].destination.x,game.soldiers[1].destination.y],[originalPositions[1].x,originalPositions[1].y]);
  commands.keydown('r');
  assert.ok(game.soldiers.every(unit => unit.orderLabel === 'FORMATION'));
});

test('changing environment resets the same systems against a separate level configuration', () => {
  const game = new setup.SquadCommandGame();
  game.start('forest');
  const originalObstacle = game.obstacles[0];
  game.start('arena');
  assert.equal(game.levelKey,'arena');
  assert.equal(game.obstacles.length,6);
  assert.notEqual(game.obstacles[0],originalObstacle);
  assert.equal(game.soldiers.length,0);
  assert.equal(game.enemies.length,0);
  assert.equal(game.recruits.length,6);
});

test('world resize remaps active destinations and entities without restarting the mission', () => {
  const game = new setup.SquadCommandGame();
  game.start('interior');
  game.soldiers.push(new setup.Soldier(100,120,1));
  game.soldiers[0].commandTo(new Vector(200,160));
  const originalObstacleRadius = game.obstacles[0].r;
  game.resizeWorld(500,400,1000,600);
  assert.equal(game.phase,'playing');
  assert.equal(game.commander.pos.x,500);
  assert.equal(game.commander.pos.y,312);
  assert.equal(game.soldiers[0].pos.x,200);
  assert.equal(game.soldiers[0].pos.y,180);
  assert.equal(game.soldiers[0].destination.x,400);
  assert.equal(game.soldiers[0].destination.y,240);
  assert.equal(game.obstacles[0].r,originalObstacleRadius*1.5);
});

test('T engagement remains intact and cleared waves advance through five two-wave levels', () => {
  const game = new setup.SquadCommandGame();
  game.start('arena');
  const commands = new setup.CommandController(game);
  game.soldiers = [new setup.Soldier(240,200,1),new setup.Soldier(260,200,2),new setup.Soldier(280,200,3)];
  game.spawnWave();
  const target = game.enemies.slice().sort((a,b) => Vector.dist(game.commander.pos,a.pos)-Vector.dist(game.commander.pos,b.pos))[0];
  game.selectEnemy(target);
  game.soldiers.forEach((soldier,index) => { soldier.selected = true; soldier.pos.set(target.pos.x + index * 5,target.pos.y); });
  commands.keydown('t');
  assert.equal(target.health,0);
  assert.equal(target.eliminated,true);
  assert.equal(commands.keydown('escape'),'paused');
  assert.equal(game.paused,true);
  assert.equal(commands.keydown('t'),'ignored');
  assert.equal(commands.keydown('escape'),'resumed');
  assert.ok(game.enemies.filter(enemy => enemy !== target).every(enemy => enemy.health === enemy.maxHealth));
  game.enemies.forEach(enemy => enemy.eliminated = true);
  game.update();
  assert.equal(game.pendingWaveCountdown,108);
  for (let frame=0;frame<108;frame++) game.update();
  assert.equal(game.wave,2);
  assert.equal(game.enemies.length,5);
  assert.ok(game.enemies.every(enemy => !enemy.eliminated));
  for (let wave=2;wave<=10;wave++) {
    game.enemies.forEach(enemy => enemy.eliminated = true);
    game.update();
    if (wave === 10) break;
    const delay = game.pendingWaveCountdown;
    assert.equal(delay,wave % 2 === 1 ? 108 : 145);
    for (let frame=0;frame<delay;frame++) game.update();
    assert.equal(game.wave,wave+1);
    assert.equal(game.levelNumber,Math.floor(wave / 2) + 1);
  }
  assert.equal(game.phase,'victory');
  assert.equal(commands.keydown('r'),'restarted');
  assert.equal(game.phase,'playing');
  assert.equal(game.wave,0);
});

test('each level has exactly two waves and notifications queue, cap at three, and expire', () => {
  const game=new setup.SquadCommandGame(); game.start('forest');
  game.soldiers=[1,2,3].map(id=>new setup.Soldier(100+id*18,180,id));
  game.spawnWave();
  assert.equal(game.waveInLevel,1);
  const firstBoss=game.enemies.filter(enemy=>enemy instanceof setup.BossEnemy);
  assert.equal(firstBoss.length,0);
  game.enemies.forEach(enemy=>enemy.eliminated=true);
  game.update();
  for(let frame=0;frame<108;frame++)game.update();
  assert.equal(game.waveInLevel,2);
  game.enemies.forEach(enemy=>enemy.eliminated=true);
  game.update();
  assert.equal(game.pendingWaveCountdown,145);
  assert.equal(game.levelNumber,2);
  for(let frame=0;frame<145;frame++)game.update();
  assert.equal(game.waveInLevel,1);
  assert.equal(game.levelNumber,2);

  game.levelNumber=3; game.waveInLevel=0; game.spawnWave();
  assert.equal(game.enemies.filter(enemy=>enemy instanceof setup.BossEnemy).length,1);
  game.enemies.forEach(enemy=>enemy.eliminated=true);
  game.update();
  for(let frame=0;frame<108;frame++)game.update();
  assert.equal(game.waveInLevel,2);
  assert.equal(game.enemies.filter(enemy=>enemy instanceof setup.BossEnemy).length,0);
  game.enemies.forEach(enemy=>enemy.eliminated=true);
  game.update();
  assert.equal(game.levelNumber,4);
  assert.equal(game.waveInLevel,0);

  game.showMessage('notification 1',1);
  game.showMessage('notification 2',20);
  game.showMessage('notification 3',20);
  game.showMessage('notification 4',20);
  assert.equal(game.notifications.length,3);
  assert.equal(game.notifications[0].text,'notification 4');
  assert.equal(game.notifications[2].text,'notification 2');
  const activeNotification = game.notifications[0];
  game.showMessage('notification 4',45);
  assert.equal(game.notifications.length,3,'an active duplicate updates instead of adding a second card');
  assert.equal(game.notifications[0],activeNotification);
  assert.equal(activeNotification.life,45);
  game.showMessage('short notification',1);
  game.updateNotifications();
  assert.equal(game.notifications.length,2);
  assert.equal(game.notifications[0].text,'notification 4');
});

test('an identical active notification refreshes its existing DOM card instead of duplicating it', () => {
  const game = new setup.SquadCommandGame();
  const cards = [];
  const stack = { prepend(node) { cards.unshift(node); } };
  const originalGetElementById = context.document.getElementById;
  const originalCreateElement = context.document.createElement;
  context.document.getElementById = id => id === 'notificationStack' ? stack : originalGetElementById(id);
  context.document.createElement = () => ({
    className: '', textContent: '', title: '', style: {},
    classList: { remove() {} },
    remove() { const index = cards.indexOf(this); if (index >= 0) cards.splice(index, 1); }
  });
  try {
    game.showMessage('Boss en approche', 30);
    const originalNode = game.notifications[0].node;
    game.showMessage('Boss en approche', 90);
    assert.equal(game.notifications.length, 1);
    assert.equal(cards.length, 1);
    assert.equal(game.notifications[0].node, originalNode);
    assert.equal(game.notifications[0].life, 90);
  } finally {
    context.document.getElementById = originalGetElementById;
    context.document.createElement = originalCreateElement;
  }
});

test('mission notifications share the infirmary HUD container and sit beside it in the battlefield', () => {
  const html = read('index.html');
  const styles = read('levels.css');
  assert.match(html, /class="stat hospital-stat"[\s\S]*?id="hudHospital"[\s\S]*?id="notificationStack"[\s\S]*?<\/div>/);
  assert.doesNotMatch(html.slice(0, html.indexOf('<main class="layout">')), /id="notificationStack"/);
  assert.match(styles, /\.notification-stack\{[^}]*left:calc\(100% \+ 8px\)[^}]*top:calc\(100% \+ 7px\)[^}]*}/);
  assert.match(styles, /\.hospital-stat\{position:relative;z-index:5}/);
  assert.match(styles, /\.notification-stack\{[^}]*z-index:6/);
});

test('a distant dig prompt shows only the exact rifle-clue sentence without pixel distances', () => {
  const game = new setup.SquadCommandGame();
  game.start('forest');
  let previousNoticeRemoved = false;
  let stackCleared = false;
  game.notifications.push({ text: 'Indice repéré à 100 px', node: { remove: () => { previousNoticeRemoved = true; } } });
  uiNodes.set('notificationStack', { replaceChildren: () => { stackCleared = true; } });
  game.commander.pos.set(game.cache.pos.x - 100, game.cache.pos.y);
  assert.equal(game.digCache(), false);
  assert.equal(previousNoticeRemoved, true);
  assert.equal(stackCleared, true);
  assert.equal(game.notifications.length, 1);
  assert.equal(game.notifications[0].text, 'Rapprochez-vous de l’indice pour obtenir un fusil');
  assert.doesNotMatch(game.notifications[0].text, /Indice repéré|\d+\s*px/);
  uiNodes.delete('notificationStack');
});

test('successive D-clicks on one enemy assign exactly one formation soldier per click', () => {
  const game = new setup.SquadCommandGame(); game.start('arena'); game.obstacles = [];
  const soldiers = [100,120,140,160].map((x,index)=>new setup.Soldier(x,180,index+1));
  soldiers[3].orderType = 'move'; soldiers[3].orderLabel = 'TACTIQUE';
  soldiers[3].commandTo(new Vector(80,300));
  game.soldiers = soldiers;
  const target = new setup.Enemy(330,180,9), other = new setup.Enemy(420,280,10);
  game.enemies = [target,other];
  const commands = new setup.CommandController(game);
  commands.keydown('d');
  for (let count=1;count<=3;count++) {
    assert.equal(commands.click(target.pos.x,target.pos.y,true),'soldier-assigned');
    assert.equal(game.assignedSoldiers(target).length,count);
  }
  assert.deepEqual(soldiers.map(soldier=>soldier.target?.id||null),[9,9,9,null]);
  assert.deepEqual(soldiers.map(soldier=>soldier.orderLabel),['CIBLE','CIBLE','CIBLE','TACTIQUE']);
  assert.equal(commands.click(target.pos.x,target.pos.y,true),'ignored');
  assert.equal(game.assignedSoldiers(target).length,3);
  assert.equal(game.assignedSoldiers(other).length,0);
  assert.match(game.message,/Aucun fusilier/);
  commands.keyup('d');
});

test('level three spawns one scalable Colossus with a telegraphed slam and visible health', () => {
  audioEvents.length = 0;
  const game = new setup.SquadCommandGame();
  game.start('forest');
  game.levelNumber = 3;
  game.soldiers = [new setup.Soldier(180,220,1),new setup.Soldier(220,220,2),new setup.Soldier(260,220,3)];
  game.spawnWave();
  assert.deepEqual(audioEvents,['boss-arrival']);
  const bosses = game.enemies.filter(enemy => enemy instanceof setup.BossEnemy);
  assert.equal(bosses.length,1);
  const boss = bosses[0];
  assert.ok(boss.health > game.enemies.find(enemy => !(enemy instanceof setup.BossEnemy)).health * 4);
  assert.ok(boss.r > game.enemies.find(enemy => !(enemy instanceof setup.BossEnemy)).r);
  game.updateHud();
  assert.equal(uiNodes.get('bossHealthPanel').hidden,false);
  assert.equal(uiNodes.get('bossHealthText').textContent,boss.health + ' / ' + boss.maxHealth);

  for (let frame=0;frame<78;frame++) boss.updateBoss(boss.pos.copy(),[]);
  boss.specialCooldown=0;
  assert.equal(boss.updateBoss(boss.pos.copy(),[]).length,0);
  assert.equal(boss.specialState,'slam-windup');
  let impacts=[];
  for (let frame=0;frame<42;frame++) impacts=impacts.concat(boss.updateBoss(boss.pos.copy(),[]));
  assert.equal(impacts.length,1);
  assert.equal(impacts[0].type,'slam');
  game.commander.pos.set(boss.pos.x,boss.pos.y);
  const health=game.commander.health;
  game.resolveBossEvents(boss,impacts);
  assert.equal(game.commander.health,health-boss.specialDamage);

  const laterBoss=new setup.BossEnemy(350,250,79,5);
  assert.ok(laterBoss.health>boss.health);
  assert.ok(laterBoss.specialDamage>boss.specialDamage);
  boss.specialIndex=1; boss.specialCooldown=0;
  const chargeTarget=new Vector(boss.pos.x+320,boss.pos.y);
  boss.updateBoss(chargeTarget,[]);
  assert.equal(boss.specialState,'charge-windup');
  assert.equal(boss.specialTarget.x,chargeTarget.x);
  for(let frame=0;frame<34;frame++) boss.updateBoss(chargeTarget,[]);
  assert.equal(boss.specialState,'charge');
  boss.updateBoss(chargeTarget,[]);
  const collision={id:999,r:10,pos:boss.pos.copy()};
  assert.equal(boss.canHitDuringCharge(collision),true);
  assert.equal(boss.canHitDuringCharge(collision),false);

  for(const map of ['forest','interior','outpost','arena']){
    const mapGame=new setup.SquadCommandGame(); mapGame.start(map); mapGame.levelNumber=3; mapGame.spawnWave();
    const mapBoss=mapGame.enemies.find(enemy=>enemy instanceof setup.BossEnemy);
    assert.ok(mapBoss,'level 3 should spawn the boss on '+map);
    assert.ok(mapGame.enemies.filter(enemy=>enemy!==mapBoss).every(enemy=>Vector.dist(enemy.pos,mapBoss.pos)>mapBoss.r+enemy.r),map+' boss spawn must stay distinct from normal enemy spawns');
  }
});

test('boss targeting and damage remain compatible with D assignments and soldier fire', () => {
  const game = new setup.SquadCommandGame(); game.start('arena'); game.obstacles=[];
  const soldier = new setup.Soldier(200,200,1); soldier.selected=true; game.soldiers=[soldier];
  const boss = new setup.BossEnemy(260,200,77,3); boss.appearanceTimer=0; game.enemies=[boss];
  assert.equal(game.assignOneSoldier(boss),soldier);
  assert.equal(soldier.target,boss);
  assert.equal(boss.health,boss.maxHealth);
  soldier.pos.set(215,200);
  soldier.fireCooldown=0;
  assert.equal(game.fireAt(soldier,boss),true);
  assert.equal(boss.health,boss.maxHealth-1);
  game.updateHud();
  assert.equal(uiNodes.get('bossHealthText').textContent,boss.health + ' / ' + boss.maxHealth);
});

test('the commander starts with a digging axe and cannot attack before finding a rifle', () => {
  const game = new setup.SquadCommandGame(); game.start('forest'); game.obstacles=[];
  const target = new setup.Enemy(game.commander.pos.x+42,game.commander.pos.y,1);
  game.enemies=[target];
  const commands = new setup.CommandController(game);
  assert.equal(game.commander.weapon,'none');
  assert.equal(game.commander.hasDiggingAxe,true);
  commands.keydown('t');
  assert.equal(target.health,target.maxHealth);
  assert.equal(game.commander.attackAnimation,0);
  assert.equal(game.effects.some(effect=>effect.type==='melee'||effect.type==='player-shot'),false);
});

test('E digs at the forest clue to recover a rifle that powers T and its visible shot', () => {
  const game = new setup.SquadCommandGame(); game.start('forest'); game.obstacles=[];
  const commands = new setup.CommandController(game);
  assert.equal(game.cache.item,'rifle');
  assert.equal(commands.keydown('e'),'dig');
  assert.equal(game.cache.collected,false);
  game.commander.pos.set(game.cache.pos.x,game.cache.pos.y);
  assert.equal(commands.keydown('e'),'dig');
  assert.equal(game.cache.collected,true);
  assert.equal(game.commander.weapon,'rifle');
  assert.equal(game.commander.hasRifle,true);
  const target = new setup.Enemy(game.commander.pos.x+160,game.commander.pos.y,1);
  game.enemies=[target]; game.commander.weaponCooldown=0;
  commands.keydown('t');
  assert.equal(target.health,2);
  assert.equal(game.effects.some(effect=>effect.type==='player-shot'),true);
});

test('map caches grant useful medical, armor, and capacitor equipment', () => {
  const game = new setup.SquadCommandGame();
  for (const [level,item] of [['interior','medkit'],['outpost','armor'],['arena','capacitor']]) {
    game.start(level); game.obstacles=[];
    assert.equal(game.cache.item,item);
    game.commander.pos.set(game.cache.pos.x,game.cache.pos.y);
    assert.equal(game.digCache(),true);
    assert.equal(game.commander.hasRifle,true, 'every discovered cache grants the commander a rifle');
    assert.equal(game.commander.weapon,'rifle');
    if (item==='medkit') {
      const soldier=new setup.Soldier(game.hospital.pos.x+170,game.hospital.pos.y,1);
      game.soldiers=[soldier]; game.commander.pos.set(game.hospital.pos.x,game.hospital.pos.y); game.commander.damage(4); soldier.damage(4);
      assert.equal(game.useMedkit(),true);
      assert.equal(game.commander.health,game.commander.maxHealth);
      assert.equal(soldier.health,soldier.maxHealth);
      assert.equal(game.commander.medkitCharges,0);
      assert.equal(game.useMedkit(),false);
    } else if (item==='armor') {
      game.commander.damage(2);
      assert.equal(game.commander.health,game.commander.maxHealth);
      assert.equal(game.commander.armorCharges,1);
      game.commander.damage(2);
      assert.equal(game.commander.health,game.commander.maxHealth-1);
    } else {
      game.commander.hasRifle=true; game.commander.weapon='rifle';
      game.enemies=[new setup.Enemy(game.commander.pos.x+65,game.commander.pos.y,1)];
      game.commander.weaponCooldown=0;
      game.commanderAttack();
      assert.equal(game.enemies[0].health,0);
      assert.equal(game.enemies[0].eliminated,true);
      assert.equal(game.commander.shockCharges,2);
    }
  }
});

test('H heals once only inside each map hospital and a new mission restores the treatment', () => {
  audioEvents.length = 0;
  const game = new setup.SquadCommandGame(); game.start('forest');
  const commands = new setup.CommandController(game);
  game.commander.pos.set(game.hospital.pos.x,game.hospital.pos.y);
  assert.equal(commands.keydown('h'),'hospital');
  assert.equal(game.hospitalUsed,false);
  assert.deepEqual(audioEvents,[],'a healthy party does not play the successful-heal cue');
  game.commander.pos.set(250,200);
  game.commander.damage(5);
  assert.equal(commands.keydown('h'),'hospital');
  assert.equal(game.commander.health,game.commander.maxHealth-5);
  game.commander.pos.set(game.hospital.pos.x,game.hospital.pos.y);
  assert.equal(commands.keydown('h'),'hospital');
  assert.equal(game.commander.health,game.commander.maxHealth);
  assert.deepEqual(audioEvents,['heal']);
  game.commander.damage(4);
  assert.equal(commands.keydown('h'),'hospital');
  assert.equal(game.commander.health,game.commander.maxHealth-4);
  assert.deepEqual(audioEvents,['heal'],'out-of-range and already-used attempts stay silent');
  for (const level of ['interior','outpost','arena']) {
    game.start(level);
    const mapCommands = new setup.CommandController(game);
    assert.ok(game.hospital instanceof setup.FieldHospital);
    assert.equal(game.hospitalUsed,false);
    game.commander.pos.set(game.hospital.pos.x,game.hospital.pos.y);
    game.commander.damage(2);
    assert.equal(mapCommands.keydown('h'),'hospital');
    assert.equal(game.commander.health,game.commander.maxHealth);
  }
});

test('hospital prompt stays at its scene height, shifts right, and renders above every obstacle', () => {
  const game = new setup.SquadCommandGame(); game.start('forest');
  game.commander.pos.set(game.hospital.pos.x,game.hospital.pos.y);
  game.transitionFrames=0;
  const order=[];
  game.drawEnvironment=()=>order.push('environment');
  game.hospital.render=()=>order.push('hospital');
  game.obstacles.forEach((obstacle,index)=>obstacle.render=()=>order.push('obstacle-'+index));
  game.cache.renderClue=()=>{}; game.cache.renderPrompt=()=>{};
  game.goldCoins.forEach(coin=>coin.render=()=>{});
  game.recruits.forEach(recruit=>recruit.render=()=>{});
  game.home.render=()=>{};
  game.drawEnemyAssignments=()=>{}; game.commander.render=()=>{};
  game.drawEffects=()=>{}; game.drawOrders=()=>{}; game.drawDebug=()=>{};
  const renderPrompt=game.drawHospitalPrompt.bind(game);
  game.drawHospitalPrompt=()=>{ order.push('treatment-prompt'); renderPrompt(); };
  drawnText.length=0;
  game.drawWorld();
  const promptIndex=order.indexOf('treatment-prompt');
  const finalObstacleIndex=Math.max(...order.map((entry,index)=>entry.startsWith('obstacle-')?index:-1));
  assert.ok(promptIndex>finalObstacleIndex,'later obstacle paint cannot cover the in-world label');
  const label=drawnText.find(entry=>entry[0]==='H  ·  SOIN UNIQUE');
  assert.ok(label);
  assert.equal(label[1],game.hospital.pos.x+36);
  assert.equal(label[2],game.hospital.pos.y+48,'the label remains at its existing vertical position');
  const originalCircle=context.circle, originalRect=context.rect, originalText=context.text;
  const promptPaint=[];
  context.circle=()=>promptPaint.push('range-ring');
  context.rect=()=>promptPaint.push('prompt-box');
  context.text=(value)=>{if(value==='H  ·  SOIN UNIQUE')promptPaint.push('prompt-text');};
  try { game.drawHospitalPrompt(); }
  finally { context.circle=originalCircle; context.rect=originalRect; context.text=originalText; }
  assert.ok(promptPaint.indexOf('range-ring')<promptPaint.indexOf('prompt-box'), 'the range ring is behind the opaque label background');
  assert.ok(promptPaint.indexOf('prompt-box')<promptPaint.indexOf('prompt-text'), 'the text is painted after its background');
});

test('validated shots animate as short tracers, deaths burst once, and blocked shots spark on cover', () => {
  audioEvents.length = 0;
  const game = new setup.SquadCommandGame(); game.start('forest');
  game.obstacles=[]; game.commander.pos.set(100,100);
  const target=new setup.Enemy(180,100,9); target.health=1; game.enemies=[target];
  assert.equal(game.fireAt(game.commander,target),true);
  assert.deepEqual(audioEvents,['shot-player']);
  const tracer=game.effects.find(effect=>effect.type==='shot');
  assert.ok(tracer.from.x < tracer.to.x);
  assert.equal(target.eliminated,true);
  assert.equal(game.effects.filter(effect=>effect.type==='enemy-death').length,10);
  const blocked=new setup.Enemy(180,160,10); game.enemies=[blocked]; game.obstacles=[{pos:new Vector(140,160),r:14}];
  game.commander.pos.set(100,160); game.commander.fireCooldown=0;
  assert.equal(game.fireAt(game.commander,blocked),false);
  assert.deepEqual(audioEvents,['shot-player'],'blocked shots do not trigger a gunshot cue');
  assert.equal(game.effects.filter(effect=>effect.type==='obstacle-spark').length,4);
});

test('commander follows a new destination progressively and settles near it', () => {
  const game = new setup.SquadCommandGame();
  game.start('forest');
  game.obstacles = [];
  game.recruits = [];
  game.commander.pos.set(100, 100);
  game.commander.vel.set(0, 0);
  game.commander.commandTo(new Vector(300, 100));
  const initial = game.commander.pos.copy();
  for (let step = 0; step < 90; step++) game.update();
  assert.ok(game.commander.pos.x > initial.x + 80, 'movement should be visible within 90 simulation frames');
  game.commander.commandTo(new Vector(170, 180));
  for (let step = 0; step < 180; step++) game.update();
  assert.ok(Vector.dist(game.commander.pos, new Vector(170, 180)) < 8);
  assert.ok(game.commander.vel.mag() < 0.2);
});

test('behavior-six forces affect motion around an off-center obstacle without changing its algorithm', () => {
  const game = new setup.SquadCommandGame();
  game.start('arena');
  game.recruits = [];
  game.obstacles = [{ pos: new Vector(190,220), r: 25 }];
  game.commander.pos.set(100,200);
  game.commander.vel.set(3,0);
  game.commander.commandTo(new Vector(400,200));
  const clearPath = new setup.SquadCommandGame();
  clearPath.start('arena');
  clearPath.recruits = [];
  clearPath.obstacles = [];
  clearPath.commander.pos.set(100,200);
  clearPath.commander.vel.set(3,0);
  clearPath.commander.commandTo(new Vector(400,200));
  let minimumDistance = Infinity;
  let threatDetected = false;
  for (let step = 0; step < 90; step++) {
    game.update();
    clearPath.update();
    minimumDistance = Math.min(minimumDistance,Vector.dist(game.commander.pos,game.obstacles[0].pos));
    threatDetected ||= game.commander.lastAvoidance.rays.some(ray => ray.threatened);
  }
  assert.ok(Number.isFinite(minimumDistance));
  assert.ok(threatDetected, 'avoidMulti should report the obstacle during the traversal');
  assert.ok(Vector.dist(game.commander.pos,clearPath.commander.pos) > 0.1, 'the reported avoidance force should change the locomotion result');
  assert.ok(game.commander.pos.x > 250, 'arrival should continue toward the destination after the dodge');
});

test('frontal and chained obstacles are cleared by the live avoidance integration', () => {
  for (const scenario of [
    { start: [80,180], goal: [420,180], obstacles: [[240,180,38]] },
    { start: [80,180], goal: [440,180], obstacles: [[190,180,28],[285,180,34],[375,180,30]] }
  ]) {
    const game = new setup.SquadCommandGame();
    game.start('arena'); game.obstacles = []; game.recruits = []; game.soldiers = [];
    game.commander.pos.set(...scenario.start); game.commander.vel.set(3,0);
    game.commander.commandTo(new Vector(...scenario.goal));
    game.obstacles = scenario.obstacles.map(([x,y,r]) => ({pos:new Vector(x,y),r}));
    const minimum = scenario.obstacles.map(() => Infinity);
    for (let step=0;step<180;step++) {
      game.update();
      scenario.obstacles.forEach(([x,y,r],index) => { minimum[index]=Math.min(minimum[index],Vector.dist(game.commander.pos,new Vector(x,y))-r); });
    }
    assert.ok(minimum.every(clearance => clearance > game.commander.r / 2 - 1), `minimum surface clearances: ${minimum.join(', ')}`);
    assert.ok(Vector.dist(game.commander.pos,new Vector(...scenario.goal)) < 20, 'the commander should continue to the destination after avoiding');
  }
});

test('a soldier follows the same avoidance and contact rules around a frontal wall and a second blocker', () => {
  const game = new setup.SquadCommandGame();
  game.start('arena');
  const soldier = new setup.Soldier(70, 210, 7);
  soldier.commandTo(new Vector(450, 210));
  const obstacles = [
    { pos: new Vector(175, 210), r: 34 },
    { pos: new Vector(290, 210), r: 36 }
  ];
  let minimumClearance = Infinity;
  for (let step = 0; step < 180; step++) {
    soldier.updateAgent(obstacles);
    minimumClearance = Math.min(minimumClearance, ...obstacles.map(obstacle =>
      Vector.dist(soldier.pos, obstacle.pos) - obstacle.r));
  }
  assert.ok(minimumClearance >= soldier.r / 2 - 1);
  assert.ok(Vector.dist(soldier.pos, new Vector(450, 210)) < 20);
});

test('scene contact resolution ignores invalid obstacle coordinates without corrupting locomotion', () => {
  const agent = new setup.SquadAgent(50,50,'soldier',{main:'#fff',dark:'#333',trim:'#eee'});
  agent.vel.set(2,1);
  const original = [agent.pos.x,agent.pos.y,agent.vel.x,agent.vel.y];
  setup.ObstacleContact.resolve(agent,[
    { pos: new Vector(NaN,50), r: 18 },
    { pos: new Vector(50,50), r: Infinity }
  ]);
  assert.deepEqual([agent.pos.x,agent.pos.y,agent.vel.x,agent.vel.y],original);
});

test('soldier D-click selects additively and immediately assigns balanced attack targets', () => {
  const game = new setup.SquadCommandGame(); game.start('arena'); game.obstacles = [];
  game.soldiers = [new setup.Soldier(100,100,1),new setup.Soldier(150,100,2),new setup.Soldier(200,100,3)];
  game.enemies = [new setup.Enemy(330,100,1),new setup.Enemy(380,100,2)];
  const commands = new setup.CommandController(game);
  commands.keydown('d');
  assert.equal(commands.click(100,100),'soldier-selected');
  assert.equal(commands.click(150,100),'soldier-selected');
  assert.equal(commands.click(200,100),'soldier-selected');
  commands.keyup('d');
  assert.ok(game.soldiers.every(soldier => soldier.selected && soldier.orderType === 'attack' && soldier.target));
  commands.keydown('d');
  assert.equal(commands.click(100,100),'soldier-selected');
  commands.keyup('d');
  assert.equal(game.soldiers[0].selected,true,'D-click keeps an already selected soldier selected');
  assert.equal(game.soldiers[0].target,game.soldiers[2].target);
  assert.notEqual(game.soldiers[1].target,game.soldiers[0].target, 'a second live target should receive another soldier');
  game.soldiers[0].selected = false;
  assert.equal(game.soldiers[0].orderType,'attack', 'changing selection must preserve the issued mission');
});

test('T preserves separate valid targets and damages each selected unit target at range', () => {
  const game = new setup.SquadCommandGame(); game.start('arena'); game.obstacles = [];
  const first = new setup.Soldier(170,150,1);
  const second = new setup.Soldier(330,250,2);
  const left = new setup.Enemy(200,150,1);
  const right = new setup.Enemy(360,250,2);
  game.soldiers = [first,second]; game.enemies = [left,right];
  first.selected = true; second.selected = true;
  first.target = left; second.target = right;
  first.orderType = second.orderType = 'attack';
  first.orderLabel = second.orderLabel = 'CIBLE';
  const command = new setup.CommandController(game);
  command.keydown('t');
  assert.equal(left.health,2);
  assert.equal(right.health,2);
  assert.equal(first.target,left);
  assert.equal(second.target,right);
});

test('T makes accompanying riflemen support the selected enemy without replacing independent orders', () => {
  const game = new setup.SquadCommandGame(); game.start('arena'); game.obstacles = [];
  game.commander.pos.set(180,180); game.commander.destination = game.commander.pos.copy();
  game.commander.weapon = 'rifle'; game.commander.hasRifle = true; game.commander.weaponCooldown = 0;
  const target = new setup.Enemy(255,180,1); target.health = target.maxHealth = 16;
  const nearerEnemy = new setup.Enemy(215,180,2);
  const first = new setup.Soldier(230,165,1), second = new setup.Soldier(230,195,2);
  const unarmed = new setup.Soldier(230,180,3); unarmed.hasRifle = false; unarmed.weapon = 'none';
  const independent = new setup.Soldier(225,215,4); independent.orderType = 'attack'; independent.target = nearerEnemy;
  game.soldiers = [first, second, unarmed, independent]; game.enemies = [nearerEnemy, target]; game.selectedEnemy = target;
  const commands = new setup.CommandController(game);
  const initialHealth = target.health;
  commands.keydown('t');
  assert.equal(target.health, initialHealth - 3, 'player and both armed formation soldiers hit the selected target immediately');
  assert.equal(nearerEnemy.health, nearerEnemy.maxHealth, 'T prioritizes the selected enemy over a closer one');
  assert.equal(first.supportTarget, target);
  assert.equal(second.supportTarget, target);
  assert.ok(first.attackAnimation > 0, 'the supporting shot triggers the aiming animation');
  assert.ok(Math.abs(first.attackDirection - Math.atan2(target.pos.y - first.pos.y, target.pos.x - first.pos.x)) < 1e-9,
    'the soldier faces the selected target while firing');
  assert.equal(first.orderType, 'formation');
  assert.equal(first.target, null);
  assert.equal(unarmed.supportTarget, null, 'a soldier without a rifle does not support the shot');
  assert.equal(independent.target, nearerEnemy, 'a soldier on an independent attack order keeps its target');
  for (let frame = 0; frame < 28; frame++) game.update();
  assert.equal(target.health, initialHealth - 5, 'the soldiers fire again after their existing 28-frame cadence');

  target.health = 2; target.eliminated = false;
  game.commander.weaponCooldown = 0;
  first.fireCooldown = 0; second.fireCooldown = 0;
  commands.keydown('t');
  assert.equal(target.health, 0, 'the commander and a support rifleman can eliminate the target');
  assert.equal(first.supportTarget, null);
  assert.equal(second.supportTarget, null);
  assert.equal(first.orderType, 'formation', 'formation behavior remains intact after the target is eliminated');
});

test('accompanying riflemen support T against a boss and damage its real health', () => {
  const game = new setup.SquadCommandGame(); game.start('arena'); game.obstacles = [];
  game.commander.pos.set(180,180); game.commander.destination = game.commander.pos.copy();
  game.commander.weapon = 'rifle'; game.commander.hasRifle = true; game.commander.weaponCooldown = 0;
  const boss = new setup.BossEnemy(250,180,99,3);
  const soldier = new setup.Soldier(220,180,1);
  game.enemies = [boss]; game.soldiers = [soldier]; game.selectedEnemy = boss;
  const commands = new setup.CommandController(game);
  commands.keydown('t');
  assert.equal(boss.health,boss.maxHealth-2,'the player and nearby soldier both damage the boss');
  assert.equal(soldier.supportTarget,boss);
  assert.ok(game.effects.some(effect=>effect.type==='shot'&&effect.to.x===boss.pos.x&&effect.to.y===boss.pos.y));
});

test('T support assigns the target but does not fire from outside soldier weapon range', () => {
  const game = new setup.SquadCommandGame(); game.start('arena'); game.obstacles = [];
  game.commander.pos.set(120,180); game.commander.destination = game.commander.pos.copy();
  game.commander.weapon = 'rifle'; game.commander.hasRifle = true; game.commander.weaponCooldown = 0;
  const target = new setup.Enemy(210,180,1); target.health = target.maxHealth = 10;
  const soldier = new setup.Soldier(420,180,1);
  game.enemies = [target]; game.soldiers = [soldier]; game.selectedEnemy = target;
  const commands = new setup.CommandController(game);
  commands.keydown('t');
  assert.equal(target.health,9,'only the commander can hit while the soldier is beyond 125 pixels');
  assert.equal(soldier.supportTarget,target,'the soldier retains the coordinated target for when it is in range');
  assert.equal(soldier.fireCooldown,0,'an out-of-range soldier does not consume its firing cadence');
});

test('line of sight checks every obstacle against the original shot segment without mutating endpoints', () => {
  const game = new setup.SquadCommandGame();
  const start = new Vector(20, 100), end = new Vector(320, 100);
  game.obstacles = [
    { pos: new Vector(100, 180), r: 15 },
    { pos: new Vector(170, 100), r: 18 },
    { pos: new Vector(245, 100), r: 16 }
  ];
  assert.equal(game.hasLineOfSight(start, end), false);
  assert.deepEqual([start.x,start.y,end.x,end.y],[20,100,320,100]);
  game.obstacles = [{ pos: new Vector(170, 142), r: 18 }];
  assert.equal(game.hasLineOfSight(start, end), true);
});

test('enemy selection and D-click assignment drive real targeted fire and damage', () => {
  const game = new setup.SquadCommandGame();
  game.start('arena');
  game.obstacles = [];
  game.soldiers = [new setup.Soldier(220,200,1),new setup.Soldier(240,200,2)];
  game.spawnWave();
  const target = game.enemies[0];
  const commands = new setup.CommandController(game);
  assert.equal(commands.click(target.pos.x,target.pos.y),'enemy-selected');
  assert.equal(game.selectedEnemy,target);
  game.soldiers.forEach((soldier,index) => { soldier.selected = true; soldier.pos.set(target.pos.x + index * 5,target.pos.y); });
  commands.keydown('t');
  assert.equal(target.health,target.maxHealth-game.soldiers.length);

  const second = game.enemies[1];
  game.soldiers[0].selected = true;
  game.soldiers[1].selected = false;
  game.soldiers[1].orderType = 'formation';
  game.soldiers[1].pos.set(second.pos.x - 25,second.pos.y);
  game.soldiers[1].fireCooldown = 0;
  const targetPosition = second.pos.copy();
  commands.keydown('d');
  assert.equal(commands.click(second.pos.x,second.pos.y),'soldier-assigned');
  assert.equal(game.soldiers[1].target,second);
  assert.equal(game.soldiers[1].orderLabel,'CIBLE');
  const healthBefore = second.health;
  game.update();
  assert.equal(second.health,healthBefore-1);
  assert.ok(game.effects.some(effect => effect.type === 'shot' && effect.to.x === targetPosition.x));
});

test('five soldiers retain two independent target orders as selection changes', () => {
  const game = new setup.SquadCommandGame();
  game.start('arena'); game.obstacles = [];
  game.soldiers = Array.from({length:5},(_,index) => new setup.Soldier(100 + index * 24,160,index+1));
  game.enemies = [new setup.Enemy(320,100,1),new setup.Enemy(360,270,2)];
  game.soldiers.slice(0,2).forEach(soldier => soldier.selected = true);
  assert.equal(game.assignTarget(game.enemies[0]),true);
  game.soldiers.slice(0,2).forEach(soldier => soldier.selected = false);
  game.soldiers.slice(2).forEach(soldier => soldier.selected = true);
  assert.equal(game.assignTarget(game.enemies[1]),true);
  game.soldiers.forEach((soldier,index) => { soldier.selected = index === 4; });
  assert.deepEqual(game.soldiers.map(soldier => soldier.target.id),[1,1,2,2,2]);
  assert.deepEqual(game.soldiers.map(soldier => soldier.orderLabel),['CIBLE','CIBLE','CIBLE','CIBLE','CIBLE']);
});

test('F uses the inherited flee force only for selected units and restores their previous order', () => {
  const game = new setup.SquadCommandGame();
  game.start('arena'); game.obstacles = [];
  const fleeing = new setup.Soldier(220,200,1);
  const other = new setup.Soldier(180,200,2);
  other.orderType = 'move'; other.orderLabel = 'TACTIQUE'; other.commandTo(new Vector(160,200));
  game.soldiers = [fleeing,other];
  game.enemies = [new setup.Enemy(250,200,1)];
  fleeing.selected = true;
  game.assignTarget(game.enemies[0]);
  fleeing.selected = true; other.selected = false;
  const before = fleeing.pos.copy();
  game.fleeSelected();
  assert.equal(fleeing.orderLabel,'FUITE');
  assert.equal(other.orderLabel,'TACTIQUE');
  for (let step=0;step<20;step++) game.update();
  assert.ok(fleeing.pos.x < before.x, 'the selected soldier should move away from the threat');
  fleeing.selected = true;
  game.fleeSelected();
  assert.equal(fleeing.orderLabel,'CIBLE', 'F cancels and restores the previous target order');
  fleeing.selected = false;
  game.enemies[0].eliminated = true;
  game.update();
  assert.equal(fleeing.orderLabel,'FORMATION');
  assert.equal(other.orderLabel,'TACTIQUE');
});

test('enemy steering reaches HOME and enemy attacks reduce its real health', () => {
  const game = new setup.SquadCommandGame();
  game.start('interior'); game.obstacles = []; game.soldiers = [];
  game.commander.pos.set(70,70); game.commander.destination.set(70,70);
  const enemy = new setup.Enemy(250,205,1);
  enemy.maxSpeed = 3;
  game.enemies = [enemy];
  assert.equal(game.home.health,game.home.maxHealth);
  const start = enemy.pos.copy();
  for (let step=0;step<100;step++) game.update();
  assert.ok(enemy.pos.y > start.y + 70, `enemy locomotion should advance toward HOME (${enemy.pos.x},${enemy.pos.y}; home ${game.home.pos.x},${game.home.pos.y})`);
  assert.ok(game.home.health < game.home.maxHealth, 'a range and line-of-sight attack must damage HOME');
  assert.ok(enemy.attackCooldown > 0, 'the cooldown confirms an attack was executed');
});

test('HOME damage has an explicit defeat threshold that the simulation enforces', () => {
  const game = new setup.SquadCommandGame();
  game.start('interior'); game.obstacles = []; game.soldiers = [];
  game.commander.pos.set(60,60);
  const enemy = new setup.Enemy(game.home.pos.x,game.home.pos.y-45,1);
  game.enemies = [enemy];
  game.home.health = 2;
  game.update();
  assert.equal(game.home.health,0);
  assert.equal(game.phase,'defeat');
  assert.match(game.message,/HOME|Relais|détruit/i);
});

test('mouse-follow and click-to-move modes keep explicit command behavior', () => {
  const game = new setup.SquadCommandGame();
  game.start('forest');
  const commands = new setup.CommandController(game);
  const before = game.commander.destination.copy();
  game.followCommander(360,280);
  assert.deepEqual([game.commander.destination.x,game.commander.destination.y],[360,280]);
  game.controlMode = 'click';
  game.followCommander(140,120);
  assert.deepEqual([game.commander.destination.x,game.commander.destination.y],[360,280]);
  assert.equal(commands.click(140,120),'move-order');
  assert.deepEqual([game.commander.destination.x,game.commander.destination.y],[140,120]);
  assert.notDeepEqual([game.commander.destination.x,game.commander.destination.y],[before.x,before.y]);
});

test('F moves the commander away from a nearby threat; T still requires a rifle', () => {
  const game = new setup.SquadCommandGame();
  game.start('arena');
  game.soldiers = [new setup.Soldier(100,100,1),new setup.Soldier(130,100,2)];
  game.spawnWave();
  const commands = new setup.CommandController(game);
  game.obstacles = [];
  game.enemies = [new setup.Enemy(game.commander.pos.x + 100,game.commander.pos.y,99)];
  const before = game.commander.pos.copy();
  commands.keydown('f');
  assert.equal(game.commander.orderType,'flee');
  for (let frame=0;frame<24;frame++) game.update();
  assert.ok(game.commander.pos.x < before.x, 'the commander must move away rather than only changing state');
  assert.ok(game.commander.lastAvoidance.rays.length > 0);
  commands.keydown('f');
  assert.notEqual(game.commander.orderType,'flee');
  commands.keydown('t');
  assert.ok(game.soldiers.every(soldier => soldier.orderType === 'formation' && soldier.target === null));
});

test('commander F escape uses multi-ray avoidance and clears an obstacle behind the player', () => {
  const game = new setup.SquadCommandGame(); game.start('arena');
  game.commander.pos.set(280,200); game.commander.vel.set(0,0); game.commander.commandTo(new Vector(280,200));
  const obstacle = { pos:new Vector(215,200), r:30 };
  game.obstacles=[obstacle];
  game.enemies=[new setup.Enemy(380,200,90)];
  const commands=new setup.CommandController(game);
  commands.keydown('f');
  for(let frame=0;frame<50;frame++) game.update();
  assert.ok(game.commander.pos.x < 280, 'flee force should move the commander away from the enemy');
  assert.ok(Vector.dist(game.commander.pos,obstacle.pos) >= obstacle.r+game.commander.r-0.1);
  assert.ok(game.commander.lastAvoidance.rays.length > 0);
});

test('page controls and overlays cannot be mistaken for battlefield pointer commands', () => {
  const game = new setup.SquadCommandGame();
  const commands = new setup.CommandController(game);
  const canvas = {};
  assert.equal(commands.acceptsCanvasEvent({ target: canvas },canvas),true);
  assert.equal(commands.acceptsCanvasEvent({ target: {} },canvas),false);
  assert.equal(commands.acceptsCanvasEvent(null,canvas),false);
});

test('gold coins seek the commander with inherited steering and collect only once', () => {
  const game = new setup.SquadCommandGame(); game.start('forest'); game.obstacles=[];
  const coin = new setup.GoldCoin(game.commander.pos.x + 120, game.commander.pos.y, 404);
  game.goldCoins = [coin];
  const start = coin.pos.copy();
  for (let frame=0;frame<100 && game.gold===0;frame++) game.update();
  assert.equal(coin.attracted,true);
  assert.ok(coin.pos.x < start.x, 'coin locomotion should move it toward the player');
  assert.equal(game.gold,1);
  assert.equal(coin.collected,true);
  for (let frame=0;frame<20;frame++) game.update();
  assert.equal(game.gold,1);
});

test('P search orders acquire and eliminate a nearby enemy, then restore formation', () => {
  const game = new setup.SquadCommandGame(); game.start('arena'); game.obstacles=[];
  const soldier = new setup.Soldier(170,180,1); soldier.selected=true;
  const target = new setup.Enemy(240,180,88); target.health=1; target.maxHealth=1;
  game.soldiers=[soldier]; game.enemies=[target];
  game.disperse();
  assert.equal(soldier.orderType,'search');
  for (let frame=0;frame<45 && !target.eliminated;frame++) game.update();
  assert.equal(target.eliminated,true);
  assert.equal(soldier.orderType,'formation');
  assert.equal(soldier.target,null);
});

test('debug labels show soldier order, target identity, and real speed', () => {
  const game = new setup.SquadCommandGame(); game.start('arena'); game.obstacles=[];
  const soldier = new setup.Soldier(100,100,1); soldier.orderType='attack';
  soldier.target=new setup.Enemy(180,100,6); soldier.vel.set(3,4);
  game.soldiers=[soldier]; game.enemies=[soldier.target]; game.goldCoins=[];
  drawnText.length=0;
  game.drawDebug();
  assert.ok(drawnText.some(([label]) => label === 'S1 attack -> E6 100,100 v=5.0'));
});

test('move and tactical order markers use valid p5 stroke signatures', () => {
  const game = new setup.SquadCommandGame();
  game.orders = [
    { pos: new Vector(40,50), life: 20, max: 45, kind: 'move' },
    { pos: new Vector(60,70), life: 20, max: 75, kind: 'tactical' }
  ];
  assert.doesNotThrow(() => game.drawOrders());
  assert.deepEqual(strokeCalls.at(-2).slice(0,3),[123,232,240]);
  assert.equal(strokeCalls.at(-2).length,4);
  assert.equal(typeof strokeCalls.at(-2)[3],'number');
  assert.deepEqual(strokeCalls.at(-1),['#ffc66d']);
});
