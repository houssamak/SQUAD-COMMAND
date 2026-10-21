class Enemy extends VehicleAvecRadar {
  constructor(x, y, id) {
    super(x, y, 3);
    this.r = 14;
    this.destination = this.pos.copy();
    this.id = id;
    this.maxSpeed = 2.25;
    this.maxForce = 0.14;
    this.health = 3;
    this.maxHealth = 3;
    this.eliminated = false;
    this.selected = false;
    this.attackCooldown = 0;
    this.targetUnit = null;
  }

  damage(amount = 1) {
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) this.eliminated = true;
  }

  updateToward(targetPosition, obstacles) {
    this.destination = targetPosition.copy();
    const arrival = this.arrive(targetPosition, 38).mult(0.7);
    const avoidance = this.avoidMulti(obstacles).mult(2.4);
    this.applyForce(arrival.add(avoidance).limit(this.maxForce));
    super.update();
    const margin = this.r + 8;
    ObstacleContact.resolve(this, obstacles);
    this.pos.x = constrain(this.pos.x, margin, width - margin);
    this.pos.y = constrain(this.pos.y, margin, height - margin);
    this.attackCooldown = Math.max(0, this.attackCooldown - 1);
  }

  render() {
    push(); translate(this.pos.x, this.pos.y);
    const heading = this.vel.magSq() > .1 ? this.vel.heading() : Math.PI / 2;
    rotate(heading);
    const stride = this.vel.mag() > .2 ? Math.sin(frameCount*.28+this.id)*3 : 0;
    noStroke(); fill(0, 0, 0, 72); ellipse(3, 17, 35, 12);
    stroke('#321b26'); strokeWeight(5); strokeCap(ROUND); line(-5,12,-6+stride,22); line(5,12,6-stride,22);
    noStroke(); fill('#381c2b'); rectMode(CENTER); rect(0,3,27,31,7);
    fill('#7c3045'); rect(0,2,21,25,6);
    fill('#a83c51'); triangle(-12,-5,-17,-12,-6,-10); triangle(12,-5,17,-12,6,-10);
    fill('#d85b67'); quad(-8,-6,0,-11,8,-6,0,4);
    fill('#4b2634'); ellipse(0,-11,17,15); triangle(-8,-15,-13,-22,-4,-18); triangle(8,-15,13,-22,4,-18);
    fill('#ffb17d'); rect(0,-10,12,3,1); fill('#fff1c4'); rect(2,-10,4,2,1);
    fill('#241a22'); rect(7,-1,17,4,2); fill('#ff8f64'); circle(15,-1,3);
    if (this.selected) { noFill(); stroke('#ffe29a'); strokeWeight(2); circle(0,2,46); }
    pop();
    noStroke(); fill('#3c1e2b'); rect(this.pos.x - 21, this.pos.y - 25, 42, 5, 3);
    fill('#ff6b7c'); rect(this.pos.x - 21, this.pos.y - 25, 42 * this.health / this.maxHealth, 3, 2);
  }
}
