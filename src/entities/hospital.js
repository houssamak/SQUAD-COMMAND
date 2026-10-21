class FieldHospital extends Vehicle {
  constructor(x, y, theme) {
    super(x, y);
    this.pos = createVector(x, y);
    this.vel.set(0, 0);
    this.r = 50;
    this.theme = theme;
  }

  render(used) {
    const pulse = used ? 0 : 1 + Math.sin(frameCount * 0.055) * 0.04;
    push(); translate(this.pos.x, this.pos.y); scale(pulse);
    drawingContext.shadowBlur = used ? 0 : 16;
    drawingContext.shadowColor = '#a6f4dc';
    noStroke(); fill(0, 0, 0, 60); ellipse(3, 30, 102, 26);
    fill(this.theme.wall); stroke(this.theme.trim); strokeWeight(2);
    rectMode(CENTER); rect(0, 0, 88, 56, 7);
    noStroke(); fill(this.theme.roof); quad(-48, -18, -34, -38, 34, -38, 48, -18);
    fill('#edf6e9'); rect(0, 1, 68, 31, 3);
    fill('#7e9a92'); rect(-20, 0, 22, 25, 2); rect(20, 0, 22, 25, 2);
    fill('#ddfaf0'); rect(0, 2, 11, 28, 2); rect(0, 2, 28, 11, 2);
    fill('#162c2d'); rect(0, 20, 16, 18, 2);
    noStroke(); fill(used ? '#82918a' : '#a7f0d5'); rect(0, -27, 34, 10, 3);
    fill('#173331'); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(7); text(used ? 'SOINS ÉPUISÉS' : 'POSTE MÉDICAL', 0, -27);
    drawingContext.shadowBlur = 0; pop();
    if (!used) {
      noFill(); stroke(166, 244, 220, 42); strokeWeight(1);
      circle(this.pos.x, this.pos.y + 3, 116 + Math.sin(frameCount * .04) * 5);
    }
  }
}
