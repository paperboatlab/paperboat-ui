// The view cube (REBRAND, drawn in agent-docs rebrand/apps/simplicial): a solid cube in the scene's top-right
// corner, raised grey with ink edges and its faces named, turning with the camera. Hover tints the face, edge or
// corner under the pointer in the accent; a click turns the camera to look from there, a drag orbits. The same
// renderer draws it in its own viewport; a transparent overlay (`.view-cube`, placed by scene.css) takes the
// pointer, so the scene's controls never see it. From legacy shared's viewCube, restyled.
import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { tokenColor, tokenCss } from "./colors.ts";
import { cubeSide, type Vec3 } from "./fit.ts";

type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
// BoxGeometry's faces in order: +x, −x, +y, −y, +z, −z
const FACES = ["RIGHT", "LEFT", "TOP", "BOTTOM", "FRONT", "BACK"];
const TURN_MS = 260;

function face(name: string, host: Element): THREE.MeshBasicMaterial {
  const c = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
  const g = c.getContext("2d")!;
  g.fillStyle = tokenCss("--surface-raised", host);
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = tokenCss("--text", host);
  g.font = `600 22px ${getComputedStyle(host).getPropertyValue("--font-mono") || "monospace"}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(name, 64, 66);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map });
}

export function viewCube(host: HTMLElement, renderer: THREE.WebGLRenderer, camera: () => Camera, controls: OrbitControls) {
  const scene = new THREE.Scene();
  const faces = FACES.map((n) => face(n, host));
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), faces);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: tokenColor("--line-ink", host).hex }));
  // the third under the pointer, tinted as the primary key is (the accent over raised grey)
  const tint = parseFloat(getComputedStyle(host).getPropertyValue("--tint")) / 100 || 0.14;
  const mark = new THREE.Mesh(
    new THREE.BoxGeometry(1 / 3 + 0.01, 1 / 3 + 0.01, 1 / 3 + 0.01),
    new THREE.MeshBasicMaterial({ color: tokenColor("--accent", host).hex, transparent: true, opacity: tint * 2.5, depthTest: false }),
  );
  mark.visible = false;
  scene.add(cube, edges, mark);
  const eye = new THREE.OrthographicCamera(-0.95, 0.95, 0.95, -0.95, 0.1, 10);

  const overlay = document.createElement("div");
  overlay.className = "view-cube";
  overlay.title = "Click a face to look from there; drag to turn";
  host.append(overlay);

  let anim: { t0: number; from: THREE.Vector3; to: THREE.Vector3 } | null = null;
  const lookFrom = (d: Vec3) => {
    const dir = new THREE.Vector3(...d).normalize();
    if (Math.abs(dir.y) > 0.99) dir.z += 0.001; // straight down or up: keep a heading
    const from = camera().position.clone().sub(controls.target);
    const to = dir.normalize().multiplyScalar(from.length());
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      camera().position.copy(controls.target).add(to);
      controls.update();
    } else anim = { t0: performance.now(), from, to };
  };
  const step = () => {
    if (!anim) return;
    const p = Math.min((performance.now() - anim.t0) / TURN_MS, 1);
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    const q = new THREE.Quaternion().setFromUnitVectors(anim.from.clone().normalize(), anim.to.clone().normalize());
    const offset = anim.from.clone().applyQuaternion(new THREE.Quaternion().slerp(q, e));
    camera().position.copy(controls.target).add(offset);
    controls.update();
    if (p === 1) anim = null;
  };

  const ray = new THREE.Raycaster();
  const sideAt = (e: PointerEvent): Vec3 | null => {
    const r = overlay.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)), eye);
    const hit = ray.intersectObject(cube)[0];
    return hit ? cubeSide([hit.point.x, hit.point.y, hit.point.z]) : null;
  };
  let press: { x: number; y: number; moved: boolean } | null = null;
  overlay.addEventListener("pointermove", (e) => {
    if (press) {
      const dx = e.clientX - press.x, dy = e.clientY - press.y;
      if (!press.moved && Math.hypot(dx, dy) < 4) return;
      anim = null;
      press = { x: e.clientX, y: e.clientY, moved: true };
      const offset = camera().position.clone().sub(controls.target);
      const s = new THREE.Spherical().setFromVector3(offset);
      s.theta -= dx * 0.012;
      s.phi = THREE.MathUtils.clamp(s.phi - dy * 0.012, 0.01, Math.PI - 0.01);
      camera().position.copy(controls.target).add(offset.setFromSpherical(s));
      controls.update();
      return;
    }
    const d = sideAt(e);
    mark.visible = !!d;
    if (d) mark.position.set(d[0] / 3, d[1] / 3, d[2] / 3);
    overlay.style.cursor = d ? "pointer" : "";
  });
  overlay.addEventListener("pointerdown", (e) => {
    overlay.setPointerCapture(e.pointerId);
    press = { x: e.clientX, y: e.clientY, moved: false };
  });
  overlay.addEventListener("pointerup", (e) => {
    const was = press;
    press = null;
    if (was && !was.moved) {
      const d = sideAt(e);
      if (d) lookFrom(d);
    }
  });
  overlay.addEventListener("pointerleave", () => { if (!press) mark.visible = false; });

  return {
    /** Draw the cube over the scene just rendered, `height` px tall. */
    draw(height: number) {
      step();
      eye.quaternion.copy(camera().quaternion);
      eye.position.set(0, 0, 3).applyQuaternion(camera().quaternion);
      const size = overlay.offsetWidth;
      if (!size) return;
      const x = overlay.offsetLeft, y = height - overlay.offsetTop - size; // the viewport counts from the bottom
      renderer.setViewport(x, y, size, size);
      renderer.setScissor(x, y, size, size);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      renderer.render(scene, eye);
      renderer.setScissorTest(false);
    },
    dispose() {
      overlay.remove();
      cube.geometry.dispose();
      for (const m of faces) { m.map?.dispose(); m.dispose(); }
      edges.geometry.dispose();
      (edges.material as THREE.Material).dispose();
      mark.geometry.dispose();
      (mark.material as THREE.Material).dispose();
    },
  };
}
