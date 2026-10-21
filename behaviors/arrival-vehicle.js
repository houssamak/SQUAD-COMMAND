/*
 * Adaptation héritée du seek/arrive de 3-Arrival/vehicle.js.
 * Seule la méthode enseignée est spécialisée; la locomotion et les autres
 * responsabilités continuent de venir de Vehicle.
 */
class ArrivalVehicle extends Vehicle {
  seek(target, arrival = false, distanceArret = 0) {
    let desiredSpeed = this.maxSpeed;
    if (arrival) {
      const distance = p5.Vector.dist(this.pos, target);
      if (distance < this.rayonZoneDeFreinage) {
        desiredSpeed = map(distance, distanceArret, this.rayonZoneDeFreinage, 0, this.maxSpeed);
      }
    }
    const desiredVelocity = p5.Vector.sub(target, this.pos);
    desiredVelocity.setMag(desiredSpeed);
    const steering = p5.Vector.sub(desiredVelocity, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }
}
