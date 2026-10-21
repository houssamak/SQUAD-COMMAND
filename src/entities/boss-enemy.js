class BossEnemy extends Enemy {
  constructor(x, y, id, level = 3) {
    super(x, y, id);
    this.isBoss = true;
    this.level = level;
    this.r = 27 + Math.min(8, level - 3) * 1.5;
    this.health = 24 + (level - 3) * 8;
    this.maxHealth = this.health;
    this.maxSpeed = 1.7 + Math.min(0.45, (level - 3) * 0.1);
    this.maxForce = 0.16;
    this.attackDamage = 2 + Math.floor((level - 3) / 2);
    this.specialDamage = 3 + Math.floor((level - 3) / 2);
    this.appearanceTimer = 78;
    this.specialCooldown = 115;
    this.specialIndex = 0;
    this.specialState = '';
    this.specialTimer = 0;
    this.specialTarget = null;
    this.chargeHits = new Set();
    this.baseMaxSpeed = this.maxSpeed;
    this.baseMaxForce = this.maxForce;
  }

  updateBoss(targetPosition, obstacles) {
    if (this.appearanceTimer > 0) {
      this.appearanceTimer--;
      return [];
    }
    this.specialCooldown = Math.max(0, this.specialCooldown - 1);
    if (this.specialState === 'slam-windup') {
      this.specialTimer--;
      if (this.specialTimer <= 0) {
        const position = this.pos.copy();
        this.specialState = '';
        this.specialCooldown = Math.max(105, 155 - this.level * 4);
        return [{ type: 'slam', position, radius: 128 + (this.level - 3) * 8 }];
      }
      this.updateToward(this.pos.copy(), obstacles);
      return [];
    }
    if (this.specialState === 'charge-windup') {
      this.specialTimer--;
      this.updateToward(this.pos.copy(), obstacles);
      if (this.specialTimer <= 0) {
        this.specialState = 'charge';
        this.specialTimer = 56;
        this.chargeHits.clear();
      }
      return [];
    }
    if (this.specialState === 'charge') {
      this.maxSpeed = this.baseMaxSpeed * 2.05;
      this.maxForce = this.baseMaxForce * 1.45;
      this.updateToward(this.specialTarget, obstacles);
      this.specialTimer--;
      if (this.specialTimer <= 0 || p5.Vector.dist(this.pos, this.specialTarget) < 34) {
        this.specialState = '';
        this.specialCooldown = Math.max(110, 165 - this.level * 4);
        this.maxSpeed = this.baseMaxSpeed;
        this.maxForce = this.baseMaxForce;
      }
      return [{ type: 'charge', position: this.pos.copy(), radius: this.r + 23 }];
    }
    this.maxSpeed = this.baseMaxSpeed;
    this.maxForce = this.baseMaxForce;
    this.updateToward(targetPosition, obstacles);
    if (this.specialCooldown === 0) {
      this.specialState = this.specialIndex++ % 2 === 0 ? 'slam-windup' : 'charge-windup';
      this.specialTimer = this.specialState === 'slam-windup' ? 42 : 34;
      if (this.specialState === 'charge-windup') this.specialTarget = targetPosition.copy();
    }
    return [];
  }

  canHitDuringCharge(unit) {
    if (this.specialState !== 'charge' || this.chargeHits.has(unit.id)) return false;
    if (p5.Vector.dist(this.pos, unit.pos) > this.r + unit.r + 10) return false;
    this.chargeHits.add(unit.id);
    return true;
  }

  render() {
    const reveal = 1 - this.appearanceTimer / 78;
    const pulse = 1 + Math.sin(frameCount * 0.11) * 0.035;
    push();
    translate(this.pos.x, this.pos.y);
    scale(Math.max(0.12, reveal) * pulse);
    noStroke(); fill(0, 0, 0, 105); ellipse(5, this.r * 0.76, this.r * 2.8, this.r * 0.72);
    drawingContext.shadowColor = '#ff754f'; drawingContext.shadowBlur = 24;
    fill('#421f32'); ellipse(0, 0, this.r * 2.1, this.r * 2.25);
    fill('#8e3545'); ellipse(0, -3, this.r * 1.72, this.r * 1.82);
    fill('#bd554e'); ellipse(-this.r * .45, -this.r * .38, this.r * .52, this.r * .95); ellipse(this.r * .45, -this.r * .38, this.r * .52, this.r * .95);
    fill('#392238'); triangle(-this.r*.68,-this.r*.65,-this.r*.85,-this.r*1.35,-this.r*.27,-this.r*.86);
    triangle(this.r*.68,-this.r*.65,this.r*.85,-this.r*1.35,this.r*.27,-this.r*.86);
    fill('#ffe29b'); ellipse(-this.r*.34,-this.r*.15,6,4); ellipse(this.r*.34,-this.r*.15,6,4);
    fill('#241b2a'); ellipse(0,this.r*.25,this.r*.65,this.r*.38);
    drawingContext.shadowBlur = 0;
    if (this.selected) { noFill(); stroke('#ffe29a'); strokeWeight(2); circle(0,0,this.r*2.65); }
    pop();

    const barWidth = this.r * 2.9, barX = this.pos.x - barWidth / 2, barY = this.pos.y - this.r - 24;
    noStroke(); fill('#17141dcc'); rect(barX - 3, barY - 5, barWidth + 6, 17, 6);
    fill('#39202d'); rect(barX, barY, barWidth, 7, 4);
    fill('#ff765e'); rect(barX, barY, barWidth * this.health / this.maxHealth, 7, 4);
    fill('#fff0d6'); textAlign(CENTER, CENTER); textSize(8); text('COLOSSUS · ' + this.health + ' / ' + this.maxHealth, this.pos.x, barY - 8);

    if (this.specialState === 'slam-windup') {
      const flash = Math.sin(frameCount * .38) > 0 ? '#ff715d' : '#ffd075';
      noFill(); stroke(flash); strokeWeight(3); circle(this.pos.x, this.pos.y, 250 + Math.sin(frameCount * .2) * 8);
      stroke('#ffb36577'); strokeWeight(1); circle(this.pos.x, this.pos.y, 276);
    } else if (this.specialState === 'charge-windup' && this.specialTarget) {
      noFill(); stroke('#ff6a67'); strokeWeight(3); circle(this.specialTarget.x, this.specialTarget.y, 44 + Math.sin(frameCount * .3) * 7);
      drawingContext.setLineDash([7, 7]); line(this.pos.x, this.pos.y, this.specialTarget.x, this.specialTarget.y); drawingContext.setLineDash([]);
    }
  }
}
