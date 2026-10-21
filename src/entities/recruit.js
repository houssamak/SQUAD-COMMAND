class Recruit extends Vehicle {
  constructor(x, y, id) {
    super(x, y);
    this.pos = createVector(x, y);
    this.vel.set(0, 0);
    this.r = 13;
    this.id = id;
    this.collected = false;
    this.phase = random(TWO_PI);
  }

  render() {
    const pulse = 1 + Math.sin(frameCount * 0.055 + this.phase) * 0.1;
    push(); translate(this.pos.x, this.pos.y);
    noFill(); stroke('#8df4dc39'); strokeWeight(1); circle(0, 0, 42 * pulse); stroke('#8df4dc88'); strokeWeight(2); circle(0, 0, 30 * pulse);
    noStroke(); fill('#123c35'); circle(0, 0, 23 * pulse); fill('#7cffe3'); circle(0, 0, 17 * pulse);
    fill('#092a31'); circle(0, 0, 8); fill('#eafffb'); circle(-3, -4, 4);
    stroke('#c4ffe9'); strokeWeight(1.5); line(-19, 0, -13, 0); line(13, 0, 19, 0); line(0, -19, 0, -13); line(0, 13, 0, 19);
    pop();
  }
}
