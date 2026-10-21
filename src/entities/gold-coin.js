class GoldCoin extends VehicleAvecRadar {
  constructor(x, y, id) {
    super(x, y, 5);
    this.id = id;
    this.r = 7;
    this.maxSpeed = 5.5;
    this.maxForce = 0.34;
    this.rayonZoneDeFreinage = 78;
    this.magnetRange = 150;
    this.attracted = false;
    this.collected = false;
    this.previousPosition = this.pos.copy();
  }

  updateToward(target, obstacles) {
    if (this.collected) return false;
    if (!this.attracted && p5.Vector.dist(this.pos, target.pos) <= this.magnetRange) this.attracted = true;
    if (!this.attracted) return false;

    this.previousPosition.set(this.pos.x, this.pos.y);
    const distance = p5.Vector.dist(this.pos, target.pos);
    const seekForce = (distance > this.rayonZoneDeFreinage ? this.seek(target.pos) : this.arrive(target.pos, 0)).mult(1.15);
    const avoidance = this.avoidMulti(obstacles).mult(1.8);
    this.applyForce(seekForce.add(avoidance).limit(this.maxForce));
    super.update();
    ObstacleContact.resolve(this, obstacles);
    this.pos.x = constrain(this.pos.x, this.r, width - this.r);
    this.pos.y = constrain(this.pos.y, this.r, height - this.r);
    return p5.Vector.dist(this.pos, target.pos) <= target.r + this.r + 7;
  }

  render() {
    if (this.collected) return;
    const pulse = 1 + Math.sin(frameCount * .12 + this.id) * .12;
    push();
    if (this.attracted) {
      drawingContext.globalAlpha = .52;
      stroke('#ffd46f'); strokeWeight(2);
      line(this.previousPosition.x, this.previousPosition.y, this.pos.x, this.pos.y);
      drawingContext.globalAlpha = 1;
    }
    translate(this.pos.x, this.pos.y); rotate(frameCount * .018 + this.id);
    drawingContext.shadowBlur = this.attracted ? 18 : 11;
    drawingContext.shadowColor = '#ffd46f';
    noStroke(); fill('#9b642c'); circle(0, 1, 17 * pulse);
    fill('#f0b94f'); circle(0, 0, 13 * pulse);
    fill('#ffe7a1'); circle(-1, -1, 7 * pulse);
    fill('#9b642c'); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(7); text('$', 0, 0);
    drawingContext.shadowBlur = 0;
    pop();
  }
}
