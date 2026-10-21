class WorldCache extends Vehicle {
  constructor(x, y, item, label) {
    super(x, y);
    this.pos = createVector(x, y);
    this.vel.set(0, 0);
    this.r = 10;
    this.item = item;
    this.label = label;
    this.collected = false;
  }

  renderClue() {
    if (this.collected) return;
    const pulse = 1 + Math.sin(frameCount * 0.07) * 0.12;
    const color = this.item === 'rifle' ? '#c7e895' :
      this.item === 'medkit' ? '#ff968b' : this.item === 'armor' ? '#98d9d5' : '#c6a1ff';
    push(); translate(this.pos.x, this.pos.y); rotate(Math.PI / 4);
    drawingContext.shadowBlur = 14; drawingContext.shadowColor = color;
    noStroke(); fill(color); rectMode(CENTER); rect(0, 0, 13 * pulse, 13 * pulse, 2);
    drawingContext.shadowBlur = 0; fill('#fff4ca'); rect(-2, -2, 4, 4, 1);
    pop();
  }

  renderPrompt() {
    if (this.collected) return;
    push(); rectMode(CENTER); textAlign(CENTER, CENTER); textSize(8);
    const label = 'E · CREUSER';
    const widthLabel = textWidth(label) + 16;
    noStroke(); fill('#09140fe8'); rect(this.pos.x, this.pos.y - 19, widthLabel, 18, 6);
    stroke('#d5e99b88'); strokeWeight(1); noFill(); rect(this.pos.x, this.pos.y - 19, widthLabel, 18, 6);
    noStroke(); fill('#e8f2cd'); text(label, this.pos.x, this.pos.y - 19);
    pop();
  }
}
