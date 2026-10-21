class Commander extends SquadAgent {
  constructor(x, y) {
    super(x, y, 'commander', { main: '#69dded', dark: '#155167', trim: '#eaffff' });
    this.weapon = 'none';
    this.hasDiggingAxe = true;
    this.hasRifle = false;
    this.digAnimation = 0;
    this.weaponCooldown = 0;
    this.attackAnimation = 0;
    this.attackDirection = 0;
    this.medkitCharges = 0;
    this.armorCharges = 0;
    this.shockCharges = 0;
  }

  damage(amount = 1) {
    const absorbed = Math.min(this.armorCharges, amount);
    this.armorCharges -= absorbed;
    const remaining = amount - absorbed;
    if (remaining > 0) super.damage(remaining);
    return remaining;
  }
}
