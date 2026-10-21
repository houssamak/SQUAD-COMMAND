class TacticalHome extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.pos = createVector(x, y);
    this.r = 24;
    this.health = 150;
    this.maxHealth = 150;
    this.attackCooldown = 0;
  }

  damage(amount = 1) { this.health = Math.max(0, this.health - amount); }

  render() {
    push(); translate(this.pos.x, this.pos.y);
    drawingContext.shadowBlur = 19; drawingContext.shadowColor = '#76dfbd66';
    noStroke(); fill('#102a22'); circle(0, 0, 68); drawingContext.shadowBlur = 0;
    stroke('#77dcb8'); strokeWeight(2); noFill(); circle(0, 0, 56); stroke('#b3ecc266'); circle(0, 0, 44);
    noStroke(); fill('#1a4437'); rectMode(CENTER); rect(0, 2, 34, 29, 7);
    fill('#b4f2cf'); rect(0, 0, 23, 20, 4); fill('#347b64'); triangle(-14, -7, 14, -7, 0, -22);
    fill('#e7fff0'); circle(0, 1, 5); fill('#85e6c1'); rect(0, 10, 3, 8, 1);
    fill('#e7f4f0'); textAlign(CENTER, CENTER); textSize(8); text('HOME', 0, 38);
    pop();
    noStroke(); fill('#271e25'); rect(this.pos.x - 30, this.pos.y + 40, 60, 5, 2);
    fill(this.health < 35 ? '#ff687d' : '#77e0bd'); rect(this.pos.x - 30, this.pos.y + 40, 60 * this.health / this.maxHealth, 4, 2);
  }
}
