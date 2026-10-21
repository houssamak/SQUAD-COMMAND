/*
 * Variante de VehiculeAvecRadar tirée du calcul joint par l'utilisateur dans
 * l'aperçu multi-rayons. Le Vehicle pédagogique demeure inchangé.
 */
class VehicleAvecRadar extends ArrivalVehicle {
  constructor(x, y, nombreRayons = 3) {
    super(x, y);
    this.nombreRayons = nombreRayons;
    this.largeurZoneEvitementDevantVaisseau = this.r / 2;
    this.lastAvoidance = { force: createVector(0, 0), rays: [] };
  }

  avoidMulti(obstacles, nombreRayons = this.nombreRayons) {
    const requestedCount = Number(nombreRayons);
    const speed = this.vel.mag();
    if (!Array.isArray(obstacles) || !Number.isFinite(requestedCount) || requestedCount < 1 ||
      !Number.isFinite(speed) || !Number.isFinite(this.maxForce) || this.maxForce < 0 ||
      !Number.isFinite(this.pos.x) || !Number.isFinite(this.pos.y)) {
      this.lastAvoidance = { force: createVector(0, 0), rays: [] };
      return createVector(0, 0);
    }
    const count = Math.max(1, Math.min(31, Math.floor(requestedCount)));

    const validObstacles = obstacles.filter(obstacle => obstacle && obstacle.pos &&
      Number.isFinite(obstacle.pos.x) && Number.isFinite(obstacle.pos.y) &&
      Number.isFinite(obstacle.r) && obstacle.r >= 0);
    if (speed < 1e-9) {
      this.lastAvoidance = { force: createVector(0, 0), rays: [] };
      return createVector(0, 0);
    }

    const heading = this.vel.heading();
    const spread = Math.PI * 2 / 3;
    const rays = [];
    const total = createVector(0, 0);
    for (let index = 0; index < count; index++) {
      const ratio = count === 1 ? 0.5 : index / (count - 1);
      const offset = (ratio - 0.5) * spread;
      const angle = heading + offset;
      const direction = p5.Vector.fromAngle(angle);
      const ahead = p5.Vector.add(this.pos, direction.copy().mult(speed * 30));
      const ahead2 = p5.Vector.add(this.pos, direction.copy().mult(speed * 15));
      const samplePoints = [this.pos.copy(), ahead2, ahead];
      let closest = null;
      let closestDistance = Infinity;
      let closestPoint = null;

      for (const obstacle of validObstacles) {
        for (const sample of samplePoints) {
          const distance = p5.Vector.dist(sample, obstacle.pos);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = obstacle;
            closestPoint = sample;
          }
        }
      }

      let force = createVector(0, 0);
      const threatened = closest !== null && closestDistance <
        closest.r + this.largeurZoneEvitementDevantVaisseau;
      if (threatened) {
        force = p5.Vector.sub(closestPoint, closest.pos);
        if (force.magSq() < 1e-18) {
          const side = offset < 0 ? -1 : 1;
          force = createVector(-direction.y * side, direction.x * side);
        }
        force.setMag(this.maxForce / 2);
        total.add(force);
      }
      rays.push({ angle, direction, ahead, ahead2, closest, closestPoint,
        closestDistance, threatened, force });
    }

    const average = total.div(count).limit(this.maxForce);
    this.lastAvoidance = { force: average.copy(), rays };
    return average;
  }
}
