import { WATER_Y, X0, X1, Z0, Z1 } from "./world";

/**
 * Mouse-look reconnaissance flight.
 * Basis (controls skill): yaw 0 faces world −Z; +yaw turns the nose left.
 * A/D are strafe, not rudder — A is player-left (−right), D is player-right.
 * Mouse right decreases yaw (look right). Mouse up increases pitch (look up).
 */

export type FlightState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vy: number;
  vz: number;
};

export type FlightInput = {
  thrust: number;
  strafe: number;
  lift: number;
  boost: boolean;
  lookDx: number;
  lookDy: number;
};

const LOOK = 0.00235;
const PITCH_MIN = -1.28;
const PITCH_MAX = 1.05;
const EYE = 1.6;

export function flightSpeed(s: FlightState) {
  return Math.hypot(s.vx, s.vy, s.vz);
}

export function headingText(yaw: number) {
  let deg = Math.round(((-yaw * 180) / Math.PI) % 360);
  deg = ((deg % 360) + 360) % 360;
  const card = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
  return `${card} ${String(deg).padStart(3, "0")}°`;
}

export function aimYawPitch(dx: number, dy: number, dz: number) {
  const horiz = Math.hypot(dx, dz) || 1e-6;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, horiz) };
}

export function stepFlight(s: FlightState, input: FlightInput, dt: number, ground: (x: number, z: number) => number) {
  s.yaw -= input.lookDx * LOOK;
  s.pitch -= input.lookDy * LOOK;
  if (s.pitch > PITCH_MAX) s.pitch = PITCH_MAX;
  if (s.pitch < PITCH_MIN) s.pitch = PITCH_MIN;

  const cp = Math.cos(s.pitch);
  const sp = Math.sin(s.pitch);
  const sy = Math.sin(s.yaw);
  const cy = Math.cos(s.yaw);
  const fx = -sy * cp;
  const fy = sp;
  const fz = -cy * cp;
  const rx = cy;
  const rz = -sy;

  const max = input.boost ? 48 : 22;
  const tx = fx * input.thrust * max + rx * input.strafe * max * 0.82;
  const ty = fy * input.thrust * max + input.lift * max * 0.68;
  const tz = fz * input.thrust * max + rz * input.strafe * max * 0.82;
  const k = 1 - Math.exp(-dt * 3.15);
  s.vx += (tx - s.vx) * k;
  s.vy += (ty - s.vy) * k;
  s.vz += (tz - s.vz) * k;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;

  const minX = X0 + 8;
  const maxX = X1 - 8;
  const minZ = Z0 + 8;
  const maxZ = Z1 - 8;
  if (s.x < minX) {
    s.x = minX;
    if (s.vx < 0) s.vx = 0;
  } else if (s.x > maxX) {
    s.x = maxX;
    if (s.vx > 0) s.vx = 0;
  }
  if (s.z < minZ) {
    s.z = minZ;
    if (s.vz < 0) s.vz = 0;
  } else if (s.z > maxZ) {
    s.z = maxZ;
    if (s.vz > 0) s.vz = 0;
  }

  const g = ground(s.x, s.z);
  let minY = g + EYE;
  if (g < WATER_Y + 0.2) minY = Math.max(minY, WATER_Y + 0.85);
  if (s.y < minY) {
    s.y = minY;
    if (s.vy < 0) s.vy = 0;
  }
  if (s.y > 168) {
    s.y = 168;
    if (s.vy > 0) s.vy = 0;
  }
}

export function overlookState(): FlightState {
  return { x: 6, y: 26, z: 76, yaw: 0.04, pitch: -0.34, vx: 0, vy: 0, vz: 0 };
}
