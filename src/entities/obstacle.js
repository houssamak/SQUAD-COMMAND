class TacticalObstacle extends Vehicle {
  constructor(x, y, radius, kind = 'rock') {
    super(x, y);
    this.pos = createVector(x, y);
    this.vel.set(0, 0);
    this.r = radius;
    this.kind = kind;
  }

  render(theme) {
    push(); translate(this.pos.x, this.pos.y);
    noFill(); stroke(theme.highlight + '55'); strokeWeight(1); drawingContext.setLineDash([3, 5]);
    ellipse(0, 0, (this.r + 6.5) * 2); drawingContext.setLineDash([]);
    noStroke(); fill(0, 0, 0, 65); ellipse(2, this.r * 0.55, this.r * 1.8, this.r * 0.56);
    if (this.kind === 'tree') {
      fill('#101914'); ellipse(0, 0, this.r * 1.92, this.r * 1.92);
      fill(theme.obstacleShadow); ellipse(this.r * .12, this.r * .08, this.r * 1.68, this.r * 1.62);
      fill(theme.obstacle); ellipse(-this.r * .08, -this.r * .1, this.r * 1.48, this.r * 1.45);
      fill(theme.highlight); ellipse(-this.r * 0.28, -this.r * 0.32, this.r * 0.52, this.r * 0.46);
      fill('#d7ecc642'); ellipse(this.r * .22, -this.r * .18, this.r * .19, this.r * .15);
    } else if (this.kind === 'crate') {
      rectMode(CENTER); stroke('#111a16'); strokeWeight(2);
      fill(theme.obstacleShadow); rect(1, 1, this.r * 1.9, this.r * 1.9, 5);
      fill(theme.obstacle); rect(0, -1, this.r * 1.68, this.r * 1.68, 4);
      stroke(theme.highlight); strokeWeight(1.6); noFill(); rect(0, -1, this.r * 1.25, this.r * 1.25, 2);
      line(-this.r * .48, -this.r * .48, this.r * .48, this.r * .48);
      line(this.r * .48, -this.r * .48, -this.r * .48, this.r * .48);
      noStroke(); fill(theme.highlight); rect(0, -this.r * .72, this.r * .45, 3, 2);
    } else {
      fill('#101914'); ellipse(0, 0, this.r * 1.9, this.r * 1.82);
      fill(theme.obstacleShadow); beginShape(); vertex(-this.r*.72,this.r*.12); vertex(-this.r*.48,-this.r*.56); vertex(-this.r*.05,-this.r*.79); vertex(this.r*.62,-this.r*.54); vertex(this.r*.82,this.r*.06); vertex(this.r*.42,this.r*.62); vertex(-this.r*.36,this.r*.7); endShape(CLOSE);
      fill(theme.obstacle); beginShape(); vertex(-this.r*.63,this.r*.08); vertex(-this.r*.4,-this.r*.48); vertex(-this.r*.03,-this.r*.68); vertex(this.r*.56,-this.r*.43); vertex(this.r*.68,this.r*.04); vertex(this.r*.35,this.r*.49); vertex(-this.r*.3,this.r*.56); endShape(CLOSE);
      fill(theme.highlight); ellipse(-this.r * 0.22, -this.r * 0.3, this.r * 0.52, this.r * 0.29);
    }
    pop();
  }
}
