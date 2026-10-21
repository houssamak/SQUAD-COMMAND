/* Scene collision rule applied after steering and inherited locomotion. */
class ObstacleContact {
  static resolve(vehicle, obstacles) {
    if (!Array.isArray(obstacles)) return;
    const clearance = vehicle.r / 2;
    for (let pass = 0; pass < 3; pass++) {
      for (const obstacle of obstacles) {
        if (!obstacle?.pos || !Number.isFinite(obstacle.pos.x) || !Number.isFinite(obstacle.pos.y) ||
          !Number.isFinite(obstacle.r) || obstacle.r < 0) continue;
        const required = obstacle.r + clearance;
        const offset = p5.Vector.sub(vehicle.pos, obstacle.pos);
        const distanceSquared = offset.magSq();
        if (distanceSquared >= required * required) continue;
        let distance = Math.sqrt(distanceSquared);
        if (distance < 1e-6) {
          offset.set(vehicle.vel.x === 0 && vehicle.vel.y === 0 ? 1 : -vehicle.vel.x, vehicle.vel.y === 0 ? 0 : -vehicle.vel.y);
          if (offset.magSq() < 1e-6) offset.set(1, 0);
          distance = offset.mag();
        }
        const normal = offset.div(distance);
        vehicle.pos.set(obstacle.pos.x + normal.x * required, obstacle.pos.y + normal.y * required);
        const inwardSpeed = p5.Vector.dot(vehicle.vel, normal);
        if (inwardSpeed < 0) vehicle.vel.sub(normal.copy().mult(inwardSpeed));
        if (inwardSpeed < -0.02 || vehicle.vel.magSq() < 0.04) {
          const tangent = createVector(-normal.y, normal.x);
          const towardDestination = vehicle.destination
            ? p5.Vector.sub(vehicle.destination, vehicle.pos)
            : createVector(0, 0);
          let direction = p5.Vector.dot(tangent, towardDestination) < 0 ? -1 : 1;
          if (Math.abs(p5.Vector.dot(tangent, towardDestination)) < 1e-6 && (vehicle.id || 0) % 2) direction *= -1;
          const slideSpeed = Math.max(0.75, vehicle.maxSpeed * 0.42);
          vehicle.vel.add(tangent.mult(direction * slideSpeed)).limit(vehicle.maxSpeed);
        }
      }
    }
  }
}
