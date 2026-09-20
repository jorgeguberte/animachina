import * as THREE from "three";
import type { ActorDefinition } from "../engine/model";

const material = (color: number, metalness = 0, emissive = 0) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness: metalness ? 0.32 : 0.8,
    emissive,
    emissiveIntensity: emissive ? 1.5 : 0,
  });
const bronze = material(0xb79863, 0.75);
const dark = material(0x172c33, 0.65);
const stone = material(0x506777);
const glow = material(0xffdf9a, 0.1, 0xffbb55);
const aqua = material(0x74eddf, 0.3, 0x24baa4);
function mesh(
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function ring(
  parent: THREE.Object3D,
  radius: number,
  tube: number,
  y: number,
  mat = bronze,
) {
  const object = mesh(
    new THREE.TorusGeometry(radius, tube, 8, 80),
    mat,
    parent,
    0,
    y,
  );
  object.rotation.x = Math.PI / 2;
  return object;
}

/** Authored stagecraft. No personality or policy knowledge belongs here. */
export function buildGarden(scene: THREE.Scene) {
  const root = new THREE.Group();
  scene.add(root);
  mesh(new THREE.CylinderGeometry(5.8, 6, 0.42, 96), dark, root, 0, -0.25);
  mesh(
    new THREE.CylinderGeometry(5.62, 5.68, 0.1, 96),
    material(0x263d48),
    root,
    0,
    -0.04,
  );
  ring(root, 5.72, 0.035, 0.015);
  ring(root, 5.52, 0.018, 0.025);
  ring(root, 4.48, 0.012, 0.03);
  ring(root, 1.38, 0.022, 0.025);
  // Radial inlays and warm aisle lights make the plaza read as an authored set.
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI) / 24;
    const line = mesh(
      new THREE.BoxGeometry(0.014, 0.018, 0.85),
      bronze,
      root,
      Math.cos(a) * 5,
      0.02,
      Math.sin(a) * 5,
    );
    line.rotation.y = Math.PI / 2 - a;
    const pin = mesh(
      new THREE.SphereGeometry(0.025, 6, 6),
      glow,
      root,
      Math.cos(a) * 5.52,
      0.065,
      Math.sin(a) * 5.52,
    );
    pin.castShadow = false;
  }
  const paving = material(0x50615e, 0.25);
  for (const r of [2.15, 3.1, 3.95]) ring(root, r, 0.008, 0.018, paving);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const joint = mesh(
      new THREE.BoxGeometry(0.008, 0.008, 2.95),
      paving,
      root,
      Math.cos(a) * 2.96,
      0.022,
      Math.sin(a) * 2.96,
    );
    joint.rotation.y = Math.PI / 2 - a;
  }
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(3.4, 0.2, 1.45), dark, root, side * 6.5, -0.1);
    for (const z of [-0.67, 0.67])
      mesh(
        new THREE.BoxGeometry(3.4, 0.025, 0.025),
        bronze,
        root,
        side * 6.5,
        0.02,
        z,
      );
    const arch = new THREE.Group();
    arch.position.x = side * 6.4;
    root.add(arch);
    for (const z of [-0.83, 0.83]) {
      mesh(
        new THREE.CylinderGeometry(0.045, 0.065, 2.2, 10),
        bronze,
        arch,
        0,
        1.1,
        z,
      );
      mesh(new THREE.SphereGeometry(0.12, 12, 8), glow, arch, 0, 2.2, z);
    }
    const arc = mesh(
      new THREE.TorusGeometry(0.83, 0.045, 8, 40, Math.PI),
      bronze,
      arch,
      0,
      2.2,
    );
    arc.rotation.y = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = ((i + 1) / 6) * Math.PI;
      mesh(
        new THREE.SphereGeometry(0.042, 8, 6),
        glow,
        arch,
        0,
        2.2 + Math.sin(a) * 0.83,
        Math.cos(a) * 0.83,
      );
    }
  }
  const leaves: THREE.Object3D[] = [];
  // Open sightlines along the entry and exit axes.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) < 0.35) continue;
    const x = Math.cos(a) * 5.15,
      z = Math.sin(a) * 5.15;
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    if (z > 2) tree.scale.setScalar(0.52);
    root.add(tree);
    mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.32, 8), dark, tree, 0, 0.16);
    mesh(
      new THREE.CylinderGeometry(0.028, 0.065, 1.2, 6),
      bronze,
      tree,
      0,
      0.78,
    );
    for (let j = 0; j < 3; j++) {
      const leaf = mesh(
        new THREE.IcosahedronGeometry(0.42 - j * 0.055, 0),
        material(j % 2 ? 0x3f706b : 0x244f51, 0.25),
        tree,
        Math.sin(j * 2) * 0.12,
        1.05 + j * 0.28,
        0,
      );
      leaf.scale.set(1, 1.3, 0.8);
      leaves.push(leaf);
    }
  }
  for (const a of [0.65, 2.45, 3.8, 5.7]) {
    const x = Math.cos(a) * 4.65,
      z = Math.sin(a) * 4.65;
    mesh(
      new THREE.CylinderGeometry(0.025, 0.05, 1.65, 8),
      bronze,
      root,
      x,
      0.85,
      z,
    );
    mesh(new THREE.BoxGeometry(0.19, 0.27, 0.19), glow, root, x, 1.73, z);
    mesh(new THREE.ConeGeometry(0.19, 0.17, 4), dark, root, x, 1.95, z);
  }
  const positions = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    const a = i * 2.399963;
    const r = 2 + (((i * 17) % 100) / 100) * 7;
    positions.set(
      [Math.cos(a) * r, 0.3 + ((i * 31) % 100) / 25, Math.sin(a) * r],
      i * 3,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xd7f3c6,
      size: 0.035,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(motes);
  return (time: number, reduced: boolean) => {
    motes.visible = !reduced;
    motes.rotation.y = reduced ? 0 : time * 0.018;
    leaves.forEach((leaf, i) => {
      leaf.rotation.z = reduced ? 0 : Math.sin(time * 0.7 + i) * 0.035;
    });
  };
}

export function buildActor(actor: ActorDefinition) {
  const group = new THREE.Group();
  group.position.set(actor.position.x, 0.08, actor.position.z);
  if (actor.kind === "fountain") {
    mesh(new THREE.CylinderGeometry(0.94, 1.02, 0.16, 64), dark, group);
    ring(group, 0.91, 0.07, 0.1);
    mesh(
      new THREE.CylinderGeometry(0.83, 0.83, 0.045, 64),
      material(0x308d9a, 0.6, 0x134747),
      group,
      0,
      0.08,
    );
    mesh(
      new THREE.CylinderGeometry(0.12, 0.22, 0.65, 16),
      bronze,
      group,
      0,
      0.39,
    );
    mesh(
      new THREE.CylinderGeometry(0.4, 0.16, 0.14, 32),
      bronze,
      group,
      0,
      0.7,
    );
    mesh(new THREE.SphereGeometry(0.11, 16, 12), aqua, group, 0, 0.92);
    const jets = new THREE.Group();
    jets.name = "jets";
    group.add(jets);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(Math.cos(a) * 0.15, 0.75, Math.sin(a) * 0.15),
        new THREE.Vector3(Math.cos(a) * 0.55, 1.5, Math.sin(a) * 0.55),
        new THREE.Vector3(Math.cos(a) * 0.73, 0.12, Math.sin(a) * 0.73),
      );
      mesh(new THREE.TubeGeometry(curve, 20, 0.014, 5, false), aqua, jets);
    }
  }
  if (actor.kind === "statue") {
    mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.23, 8), dark, group);
    ring(group, 0.45, 0.035, 0.17);
    mesh(new THREE.ConeGeometry(0.35, 0.95, 7), stone, group, 0, 0.7);
    mesh(new THREE.SphereGeometry(0.21, 16, 12), bronze, group, 0, 1.32);
    const halo = mesh(
      new THREE.TorusGeometry(0.38, 0.018, 8, 40),
      glow,
      group,
      0,
      1.35,
      0.07,
    );
    halo.name = "halo";
    for (const side of [-1, 1]) {
      const arm = mesh(
        new THREE.CapsuleGeometry(0.07, 0.45, 4, 8),
        bronze,
        group,
        side * 0.3,
        0.92,
      );
      arm.rotation.z = side * 0.7;
    }
  }
  if (actor.kind === "flowers") {
    mesh(new THREE.CylinderGeometry(0.75, 0.82, 0.18, 16), dark, group);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.39996,
        r = Math.sqrt(i / 11) * 0.6,
        h = 0.3 + (i % 3) * 0.13;
      const flower = new THREE.Group();
      flower.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
      mesh(
        new THREE.CylinderGeometry(0.014, 0.02, h, 5),
        bronze,
        flower,
        0,
        h / 2,
      );
      const petals = new THREE.Group();
      petals.position.y = h;
      flower.add(petals);
      const petalMaterial = material(
        [0xeca2a7, 0xd3b7ee, 0xf3cd87][i % 3],
        0.15,
        [0x502132, 0x342452, 0x4a3818][i % 3],
      );
      for (let j = 0; j < 5; j++) {
        const angle = (j / 5) * Math.PI * 2;
        const petal = mesh(
          new THREE.SphereGeometry(0.09, 8, 6),
          petalMaterial,
          petals,
          Math.cos(angle) * 0.08,
          0,
          Math.sin(angle) * 0.08,
        );
        petal.scale.set(1, 0.35, 1.35);
        petal.rotation.y = -angle;
      }
      mesh(new THREE.SphereGeometry(0.04, 8, 6), glow, petals, 0, 0.04);
      group.add(flower);
    }
  }
  if (actor.kind === "creature") {
    mesh(
      new THREE.SphereGeometry(0.33, 24, 16),
      material(0xe4b879, 0.55),
      group,
      0,
      0.38,
    ).scale.set(1, 1.05, 0.85);
    mesh(
      new THREE.SphereGeometry(0.23, 20, 12),
      material(0xf5d9a6, 0.2),
      group,
      0,
      0.38,
      -0.13,
    ).scale.set(1, 0.8, 0.65);
    for (const side of [-1, 1]) {
      const ear = mesh(
        new THREE.ConeGeometry(0.12, 0.35, 6),
        bronze,
        group,
        side * 0.21,
        0.73,
      );
      ear.rotation.z = side * -0.22;
      mesh(
        new THREE.SphereGeometry(0.068, 12, 8),
        dark,
        group,
        side * 0.1,
        0.43,
        -0.29,
      );
      mesh(
        new THREE.SphereGeometry(0.022, 8, 6),
        aqua,
        group,
        side * 0.1,
        0.445,
        -0.349,
      );
      mesh(
        new THREE.SphereGeometry(0.12, 12, 8),
        bronze,
        group,
        side * 0.2,
        0.12,
        -0.05,
      ).scale.set(1, 0.5, 1.4);
    }
    const tail = mesh(
      new THREE.TorusGeometry(0.2, 0.055, 8, 20, Math.PI * 1.5),
      bronze,
      group,
      0,
      0.34,
      0.32,
    );
    tail.rotation.y = Math.PI / 2;
  }
  if (actor.kind === "lamp") {
    mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.16, 8), dark, group);
    mesh(
      new THREE.CylinderGeometry(0.045, 0.085, 1.4, 12),
      bronze,
      group,
      0,
      0.75,
    );
    const lantern = new THREE.Group();
    lantern.name = "lantern";
    lantern.position.y = 1.55;
    group.add(lantern);
    mesh(new THREE.OctahedronGeometry(0.27), glow, lantern);
    for (const y of [-0.22, 0.22])
      mesh(new THREE.ConeGeometry(0.3, 0.18, 6), bronze, lantern, 0, y);
  }
  return group;
}

export function buildVehicle() {
  const group = new THREE.Group();
  const hull = mesh(
    new THREE.SphereGeometry(0.4, 24, 16),
    bronze,
    group,
    0,
    0.18,
  );
  hull.scale.set(1, 0.5, 1.5);
  const cabin = mesh(
    new THREE.SphereGeometry(0.3, 24, 16),
    dark,
    group,
    0,
    0.36,
  );
  cabin.scale.set(1, 0.7, 1.25);
  mesh(
    new THREE.BoxGeometry(0.4, 0.14, 0.32),
    material(0x9f5160),
    group,
    0,
    0.44,
    -0.08,
  );
  for (const x of [-0.25, 0.25])
    mesh(new THREE.SphereGeometry(0.06, 12, 8), glow, group, x, 0.28, 0.38);
  const underglow = ring(group, 0.4, 0.025, 0.045, aqua);
  underglow.scale.y = 1.35;
  return group;
}
