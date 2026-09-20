import type { SceneDefinition, Vec2 } from "./model";
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const mix = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
});

/** Navigation derives from physical clearance, never personality or authored routes. */
export function planPath(
  scene: SceneDefinition,
  start: Vec2,
  end: Vec2,
  curvature: number,
): Vec2[] {
  start = { ...start };
  end = { ...end };
  const obstacles = scene.actors.map((actor) => ({
    center: actor.position,
    radius: actor.interactionRadius * 0.7 + 0.2,
  }));
  const inside = (p: Vec2) =>
    p.x >= scene.bounds.min.x &&
    p.x <= scene.bounds.max.x &&
    p.z >= scene.bounds.min.z &&
    p.z <= scene.bounds.max.z;
  const clear = (a: Vec2, b: Vec2) =>
    inside(a) &&
    inside(b) &&
    obstacles.every(({ center, radius }) => {
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((center.x - a.x) * dx + (center.z - a.z) * dz) /
            (dx * dx + dz * dz || 1),
        ),
      );
      return distance(center, mix(a, b, t)) >= radius - 1e-6;
    });
  const nodes: Vec2[] = [start, end];
  for (const { center, radius } of obstacles) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const p = {
        x: center.x + Math.cos(a) * (radius + 0.14),
        z: center.z + Math.sin(a) * (radius + 0.14),
      };
      if (clear(p, p)) nodes.push(p);
    }
  }
  const costs = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    visited = new Set<number>();
  costs[0] = 0;
  for (let count = 0; count < nodes.length; count++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (current < 0 || costs[i] < costs[current]))
        current = i;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) break;
    visited.add(current);
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i) || !clear(nodes[current], nodes[i])) continue;
      const candidate = costs[current] + distance(nodes[current], nodes[i]);
      if (candidate < costs[i]) {
        costs[i] = candidate;
        previous[i] = current;
      }
    }
  }
  if (!Number.isFinite(costs[1]))
    throw new Error("No physically clear route to this opportunity.");
  const path: Vec2[] = [];
  for (let i = 1; i !== -1; i = previous[i]) path.unshift(nodes[i]);
  // Gentle corner rounding and expressive arcs are admitted only when clear.
  const rounded: Vec2[] = [start];
  for (let i = 1; i < path.length - 1; i++) {
    const a = mix(path[i], path[i - 1], 0.22),
      b = mix(path[i], path[i + 1], 0.22);
    const curve = Array.from({ length: 9 }, (_, j) =>
      mix(mix(a, path[i], j / 8), mix(path[i], b, j / 8), j / 8),
    );
    if (
      curve.every((p, j) =>
        clear(j ? curve[j - 1] : rounded[rounded.length - 1], p),
      ) &&
      clear(b, path[i + 1])
    )
      rounded.push(...curve);
    else rounded.push(path[i]);
  }
  rounded.push(end);
  const expressive: Vec2[] = [start];
  for (let i = 1; i < rounded.length; i++) {
    const a = rounded[i - 1],
      b = rounded[i];
    const samples = Array.from({ length: 17 }, (_, j) => {
      const t = j / 16,
        bend = Math.sin(Math.PI * t) * curvature * 0.35;
      const p = mix(a, b, t);
      return { x: p.x - (b.z - a.z) * bend, z: p.z + (b.x - a.x) * bend };
    });
    if (samples.every((p, j) => clear(j ? samples[j - 1] : a, p)))
      expressive.push(...samples.slice(1));
    else expressive.push(b);
  }
  expressive[expressive.length - 1] = { ...end };
  return expressive;
}

export function pathLength(path: Vec2[]) {
  return path
    .slice(1)
    .reduce((sum, point, i) => sum + distance(path[i], point), 0);
}
export function pointOnPath(
  path: Vec2[],
  progress: number,
  length = pathLength(path),
): Vec2 {
  if (progress >= 1) return { ...path[path.length - 1] };
  let remaining = Math.max(0, Math.min(1, progress)) * length;
  for (let i = 1; i < path.length; i++) {
    const segment = distance(path[i - 1], path[i]);
    if (remaining <= segment && segment > 0)
      return mix(path[i - 1], path[i], remaining / segment);
    remaining -= segment;
  }
  return { ...path[path.length - 1] };
}
