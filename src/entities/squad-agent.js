class SquadAgent extends VehicleAvecRadar {
  constructor(x, y, role, palette) {
    super(x, y, 3);
    this.role = role;
    this.palette = palette;
    this.r = role === 'commander' ? 15 : 11;
    this.largeurZoneEvitementDevantVaisseau = this.r / 2;
    this.maxSpeed = role === 'commander' ? 4.2 : 4.5;
    this.maxForce = role === 'commander' ? 0.24 : 0.28;
    this.destination = this.pos.copy();
    this.selected = false;
    this.target = null;
    this.fireCooldown = 0;
    this.attackAnimation = 0;
    this.attackDirection = 0;
    this.health = role === 'commander' ? 16 : 8;
    this.maxHealth = this.health;
    this.eliminated = false;
    this.orderType = role === 'commander' ? 'player' : 'formation';
    this.fleeThreat = null;
    this.orderBeforeFlee = null;
  }

  commandTo(position) { this.destination = position.copy(); }

  steer(obstacles) {
    const arrive = this.arrive(this.destination, 0).mult(0.8);
    const avoid = this.avoidMulti(obstacles).mult(3);
    const combined = arrive.add(avoid).limit(this.maxForce);
    this.applyForce(combined);
  }

  updateAgent(obstacles) {
    this.steer(obstacles);
    super.update();
    const margin = this.r + 8;
    ObstacleContact.resolve(this, obstacles);
    this.pos.x = constrain(this.pos.x, margin, width - margin);
    this.pos.y = constrain(this.pos.y, margin, height - margin);
    this.fireCooldown = Math.max(0, this.fireCooldown - 1);
  }

  damage(amount = 1) {
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) this.eliminated = true;
  }

  updateFlee(threat, obstacles) {
    if (!threat || threat.eliminated) return false;
    const force = this.flee(threat).mult(1.6);
    const avoidance = this.avoidMulti(obstacles).mult(2.4);
    this.applyForce(force.add(avoidance).limit(this.maxForce));
    super.update();
    const margin = this.r + 8;
    ObstacleContact.resolve(this, obstacles);
    this.pos.x = constrain(this.pos.x, margin, width - margin);
    this.pos.y = constrain(this.pos.y, margin, height - margin);
    this.fireCooldown = Math.max(0, this.fireCooldown - 1);
    return true;
  }

  render() {
    const heading = this.attackAnimation > 0 ? this.attackDirection :
      this.vel.magSq() > 0.1 ? this.vel.heading() : -Math.PI / 2;
    const fleeing = this.orderType === 'flee';
    const stride = this.vel.mag() > 0.2 ? Math.sin(frameCount * (fleeing ? 0.48 : 0.32) + (this.id || 0)) * (fleeing ? 5 : 3) : 0;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(heading);
    noStroke(); fill(0, 0, 0, 75); ellipse(3, this.r + 6, this.r * 2.1, this.r * .66);
    stroke(this.palette.dark); strokeWeight(4); strokeCap(ROUND);
    line(-4, this.r * .35, -5 + stride, this.r + 3); line(4, this.r * .35, 5 - stride, this.r + 3);
    noStroke(); fill(this.palette.dark); rectMode(CENTER); rect(-5 + stride, this.r + 2, 7, 4, 2); rect(5 - stride, this.r + 2, 7, 4, 2);
    fill('#0e1715'); ellipse(0, 3, this.r * 1.78, this.r * 1.95);
    fill(this.palette.dark); rect(0, 3, this.r * 1.56, this.r * 1.72, 5);
    fill(this.palette.main); rect(0, 1, this.r * 1.28, this.r * 1.46, 4);
    fill(this.palette.trim); quad(-this.r*.53,-2,0,-this.r*.62,this.r*.53,-2,0,this.r*.36);
    fill(this.palette.dark); rect(-this.r*.72, 1, 5, this.r*.7, 2); rect(this.r*.72, 1, 5, this.r*.7, 2);
    fill('#121b19'); ellipse(0, -this.r * .67, this.r * .96, this.r * .87);
    fill(this.palette.trim); arc(0, -this.r*.62, this.r*.95, this.r*.78, Math.PI, 0, CHORD);
    fill('#172c2a'); rect(0, -this.r*.55, this.r*.62, this.r*.2, 2);
    fill('#b8f4df'); rect(this.r*.12, -this.r*.55, this.r*.23, 2, 1);
    fill(this.palette.dark); rect(0, this.r*.48, this.r*.4, this.r*.62, 2);
    if (this.role === 'commander' && !this.hasRifle) {
      push(); translate(this.r * .75, -1);
      const swing = this.digAnimation > 0 ? Math.sin((1 - this.digAnimation / 20) * Math.PI) * 1.65 : -.35;
      rotate(swing); stroke('#503829'); strokeWeight(3); strokeCap(ROUND); line(0, 2, 18, -7);
      stroke('#c8d4d3'); strokeWeight(2); line(14, -5, 20, -12);
      noStroke(); fill('#c8d4d3'); quad(18, -16, 24, -14, 22, -6, 16, -8);
      fill('#f3f2de'); triangle(20, -15, 24, -14, 22, -11); pop();
    } else if (this.role === 'commander') {
      const recoil = this.hasRifle && this.attackAnimation > 0 ? Math.sin((this.attackAnimation / 7) * Math.PI) * 3 : 0;
      stroke('#153a40'); strokeWeight(4); strokeCap(ROUND); line(1, -2, this.r + 10 - recoil, -2);
      stroke('#b8f4df'); strokeWeight(1); line(5, -5, this.r + 8 - recoil, -5);
      noStroke(); fill('#172a27'); rect(this.r + 8 - recoil, -2, 5, 6, 1);
      if (this.attackAnimation > 0) { fill('#efffb3'); circle(this.r + 15 - recoil, -2, 5); }
    } else {
      stroke('#1b2824'); strokeWeight(3); line(2, -this.r*.16, this.r + 7, -this.r*.1);
      stroke(this.palette.trim); strokeWeight(1); line(3, -this.r*.28, this.r + 6, -this.r*.22);
    }
    if (this.selected) {
      noFill(); stroke('#ffe29a'); strokeWeight(2);
      ellipse(0, 0, this.r * 3.1, this.r * 3.1);
    }
    pop();
    if (this.target) {
      noFill(); stroke('#ff6f79'); strokeWeight(1.5);
      circle(this.target.pos.x, this.target.pos.y, this.target.r * 3.2);
    }
    if (this.health < this.maxHealth) {
      const ratio = this.health / this.maxHealth;
      noStroke(); fill('#291f24'); rect(this.pos.x - 14, this.pos.y - this.r - 12, 28, 3, 2);
      fill(ratio < .35 ? '#ff6979' : '#9be28d'); rect(this.pos.x - 14, this.pos.y - this.r - 12, 28 * ratio, 3, 2);
    }
    if (this.orderType === 'flee') {
      noFill(); stroke('#ff9b75'); strokeWeight(2); circle(this.pos.x, this.pos.y, this.r * 3.6);
    }
    if (this.orderType === 'attack' && this.target && !this.target.eliminated) {
      noFill(); stroke('#f5cc82aa'); strokeWeight(1); drawingContext.setLineDash([4,6]); line(this.pos.x,this.pos.y,this.target.pos.x,this.target.pos.y); drawingContext.setLineDash([]);
    }
    if (this.role === 'commander') {
      const equipment = this.hasRifle ? 'FUSIL' : 'HACHE · OUTIL';
      const charges = this.medkitCharges ? ' · MED ' + this.medkitCharges : this.armorCharges ? ' · ARM ' + this.armorCharges : this.shockCharges ? ' · ARC ' + this.shockCharges : '';
      push(); rectMode(CENTER); textAlign(CENTER, CENTER); textSize(8);
      const label = equipment + charges, labelWidth = textWidth(label) + 12;
      noStroke(); fill('#09140fe8'); rect(this.pos.x, this.pos.y - this.r - 23, labelWidth, 16, 5);
      fill('#dff7e2'); text(label, this.pos.x, this.pos.y - this.r - 23); pop();
    }
  }
}
