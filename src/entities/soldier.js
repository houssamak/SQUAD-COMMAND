class Soldier extends SquadAgent {
  constructor(x, y, id) {
    super(x, y, 'soldier', { main: '#9be28d', dark: '#356e46', trim: '#f0ffe7' });
    this.id = id;
    this.orderLabel = 'FORMATION';
    this.weapon = 'rifle';
    this.hasRifle = true;
    this.supportTarget = null;
  }
}
