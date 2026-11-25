// The 3D stage (REBRAND, drawn in agent-docs rebrand/apps/simplicial): shapes on --scene-bg over the floor grid,
// solids with ink edges, an orbit camera, the view cube top-right (or the x/y/z triad), the objects' names beside
// them and the picked one in a soft outline (--accent-select). Knows shapes, not domains: the app says which
// object an entity belongs to (`group`), what to call it (`labels`), which is picked, and hears a pick. Every
// colour is a token, read when the stage is built and again when the theme changes (the camera stays put).
// From legacy shared's SceneView.
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { tokenColor } from "./colors.ts";
import { fitDistance, screenBox, type Vec3 } from "./fit.ts";
import { meshGeometry, meshLook, paintField } from "./meshes.ts";
import type { SceneCamera, SceneEntity, SceneHandle } from "./types.ts";
import { viewAxes } from "./viewAxes.ts";
import { viewCube } from "./viewCube.ts";

/** Ticks when the theme changes (<html data-theme>, or the system's while it follows it). */
function useThemeVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((x) => x + 1);
    const watch = new MutationObserver(bump);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-app"] });
    const dark = matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", bump);
    return () => { watch.disconnect(); dark.removeEventListener("change", bump); };
  }, []);
  return v;
}

const lookOf = (e: SceneEntity) => JSON.stringify([e.shape, e.size, e.color, e.src, e.shape === "mesh" ? meshLook(e) : null, e.wireframe, e.wireframeColor, e.overlay, e.colormap]);

function dispose(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
      o.geometry.dispose();
      for (const m of [o.material].flat() as THREE.MeshBasicMaterial[]) { m.map?.dispose(); m.dispose(); }
    }
  });
}

type Colors = { ink: number; muted: number; flat: boolean };

function createObject(e: SceneEntity, c: Colors): THREE.Object3D {
  const color = new THREE.Color(e.color ?? c.muted);
  if (e.shape === "line") {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color, depthTest: !e.overlay, depthWrite: !e.overlay, transparent: !!e.overlay }),
    );
    if (e.overlay) line.renderOrder = 10;
    return line;
  }
  if (e.shape === "image") {
    const [w, h] = e.size ?? [1, 1];
    const map = new THREE.TextureLoader().load(e.src ?? "");
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
  }
  if (e.shape === "mesh") {
    const geometry = meshGeometry(e);
    const field = geometry.getAttribute("color") !== undefined;
    const options = { color: field ? 0xffffff : color, vertexColors: field, side: THREE.DoubleSide, polygonOffset: !!e.wireframe, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
    const mesh = new THREE.Mesh(geometry, c.flat ? new THREE.MeshBasicMaterial(options) : new THREE.MeshStandardMaterial(options));
    if (e.wireframe) mesh.add(new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color: e.wireframeColor ?? c.ink, transparent: true, opacity: 0.35 })));
    return mesh;
  }
  const [a, b, d] = e.size ?? [1, 1, 1];
  const geometry = e.shape === "sphere" ? new THREE.SphereGeometry(a, 32, 20)
    : e.shape === "cylinder" ? new THREE.CylinderGeometry(a, a, b, 32)
    : new THREE.BoxGeometry(a, b, d);
  const mesh = new THREE.Mesh(geometry, c.flat ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  // solids are inked at their creases, as the paper look draws them (a sphere has none)
  if (e.shape !== "sphere") mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), new THREE.LineBasicMaterial({ color: c.ink, transparent: true, opacity: 0.55 })));
  return mesh;
}

function applyEntity(obj: THREE.Object3D, e: SceneEntity) {
  if (obj instanceof THREE.Line) {
    const at = obj.geometry.getAttribute("position") as THREE.BufferAttribute;
    at.setXYZ(0, ...e.pos);
    at.setXYZ(1, ...(e.to ?? e.pos));
    at.needsUpdate = true;
    obj.geometry.computeBoundingSphere();
    return;
  }
  if (e.shape === "mesh" && obj instanceof THREE.Mesh) paintField(obj.geometry, e);
  obj.position.set(...e.pos);
  obj.rotation.set(...(e.rot ?? [0, 0, 0]));
  obj.scale.set(...(e.scale ?? [1, 1, 1]));
}

type Stage = {
  scene: THREE.Scene;
  objects: Map<string, { obj: THREE.Object3D; look: string }>;
  colors: Colors;
  fit: (only?: string) => void;
};

export function SceneView({ entities, view = { mode: "3d" }, grid = true, orientation = "cube", group, labels, selected, onPick, handle }: {
  entities: Record<string, SceneEntity>;
  view?: SceneCamera;
  /** The floor grid (3D). */
  grid?: boolean;
  /** The corner widget in 3D: the view cube, the x/y/z triad, or none. */
  orientation?: "cube" | "axes" | "none";
  /** The object an entity belongs to (picked, named and outlined as one); default: the entity itself. */
  group?: (entityId: string) => string | undefined;
  /** Names drawn beside objects, by object. */
  labels?: Record<string, string>;
  /** The picked object, outlined. */
  selected?: string | null;
  /** A click on an object (its group), or on nothing (null). */
  onPick?: (object: string | null) => void;
  /** Fit, for the app's keys. */
  handle?: RefObject<SceneHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useThemeVersion();
  const stage = useRef<Stage | null>(null);
  const camera = useRef<{ eye: THREE.Vector3; target: THREE.Vector3 } | null>(null); // kept across a rebuild
  const fitted = useRef(false);
  // read every frame, so the props never rebuild the stage
  const live = useRef({ group, labels, selected, onPick });
  live.current = { group, labels, selected, onPick };
  const viewKey = JSON.stringify(view);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.autoClear = false;
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(tokenColor("--scene-bg", el).hex);
    const colors: Colors = { ink: tokenColor("--line-ink", el).hex, muted: tokenColor("--text-muted", el).hex, flat: view.mode === "2d" };
    // light is white in both themes: it is physics, not theme
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(3, 5, 4);
    scene.add(new THREE.AmbientLight(0xffffff, 1.25), key);

    let cam: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const size = () => [el.clientWidth, el.clientHeight] as const;
    if (view.mode === "2d") {
      const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      ortho.position.set(view.center[0], view.center[1], 10);
      cam = ortho;
    } else {
      const floor = new THREE.GridHelper(10, 10, tokenColor("--scene-grid", el).hex, tokenColor("--scene-grid", el).hex);
      floor.position.y = view.floor ?? 0;
      floor.visible = grid && view.grid !== false;
      floor.userData.floor = true;
      scene.add(floor);
      const persp = new THREE.PerspectiveCamera(view.camera?.fov ?? 50, 1, 0.01, 1000);
      persp.position.set(...(view.camera?.eye ?? [2, 4, 8]));
      cam = persp;
    }
    const controls = new OrbitControls(cam, renderer.domElement);
    if (view.mode === "2d") { controls.target.set(view.center[0], view.center[1], 0); controls.enableRotate = false; }
    else if (view.camera?.target) controls.target.set(...view.camera.target);
    if (camera.current) { cam.position.copy(camera.current.eye); controls.target.copy(camera.current.target); }
    controls.update();

    const resize = () => {
      const [w, h] = size();
      renderer.setSize(w, h, false);
      const aspect = w / Math.max(h, 1);
      if (cam instanceof THREE.PerspectiveCamera) cam.aspect = aspect;
      else if (view.mode === "2d") Object.assign(cam, { left: (-view.height / 2) * aspect, right: (view.height / 2) * aspect, top: view.height / 2, bottom: -view.height / 2 });
      cam.updateProjectionMatrix();
    };

    const objects = new Map<string, { obj: THREE.Object3D; look: string }>();
    const boxOf = (only?: string) => {
      const box = new THREE.Box3();
      for (const [id, { obj }] of objects) if (!only || (live.current.group?.(id) ?? id) === only) box.expandByObject(obj);
      return box;
    };
    let pending = false;
    const fit = (only?: string) => {
      const [w, h] = size();
      const box = boxOf(only);
      if (box.isEmpty()) return;
      if (!w || !h) { pending = true; return; } // hidden: once it has a size
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      if (cam instanceof THREE.PerspectiveCamera) {
        const dir = cam.position.clone().sub(controls.target).normalize();
        controls.target.copy(sphere.center);
        cam.position.copy(sphere.center).addScaledVector(dir, fitDistance(sphere.radius, cam.fov, w / h));
      } else {
        controls.target.set(sphere.center.x, sphere.center.y, 0);
        cam.position.set(sphere.center.x, sphere.center.y, 10);
        cam.zoom = (cam.top - cam.bottom) / (2.4 * Math.max(sphere.radius, 1e-3));
        cam.updateProjectionMatrix();
      }
      controls.update();
    };
    stage.current = { scene, objects, colors, fit };
    if (handle) handle.current = { fit };

    const cube = view.mode === "3d" && orientation === "cube" ? viewCube(el, renderer, () => cam, controls) : null;
    const triad = view.mode === "3d" && orientation === "axes" ? viewAxes(el, renderer, () => cam) : null;

    // A click (not a drag) picks what is under it: its object, or nothing.
    const ray = new THREE.Raycaster();
    ray.params.Line.threshold = 0.03;
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null; };
    const onUp = (e: PointerEvent) => {
      const at = down;
      down = null;
      const pick = live.current.onPick;
      if (!pick || !at || Math.hypot(e.clientX - at.x, e.clientY - at.y) > 4) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
      const hit = ray.intersectObjects([...objects.values()].map((o) => o.obj), true).find((h) => !(h.object instanceof THREE.LineSegments));
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && o.userData.entity === undefined) o = o.parent;
      const id = o?.userData.entity as string | undefined;
      pick(id === undefined ? null : live.current.group?.(id) ?? id);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // The names and the outline over the stage, where the objects are on screen.
    const marks = document.createElement("div");
    marks.className = "scene-marks";
    el.append(marks);
    const tags = new Map<string, HTMLElement>();
    const outline = document.createElement("div");
    outline.className = "scene-select";
    marks.append(outline);
    const corners = (box: THREE.Box3): Vec3[] => {
      const [w, h] = size();
      const out: Vec3[] = [];
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam);
        out.push([((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h, p.z]);
      }
      return out;
    };
    const place = (node: HTMLElement, css: string) => { if (node.style.cssText !== css) node.style.cssText = css; };
    const overlay = () => {
      const { labels: names = {}, selected: picked } = live.current;
      for (const [k, node] of tags) if (!(k in names)) { node.remove(); tags.delete(k); }
      for (const [k, text] of Object.entries(names)) {
        let node = tags.get(k);
        if (!node) { node = Object.assign(document.createElement("span"), { className: "scene-label" }); marks.append(node); tags.set(k, node); }
        if (node.textContent !== text) node.textContent = text;
        const b = screenBox(corners(boxOf(k)));
        place(node, b ? `transform:translate(${Math.round(b.x + b.w + 6)}px,${Math.round(b.y)}px)` : "display:none");
      }
      const b = picked ? screenBox(corners(boxOf(picked))) : null;
      place(outline, b ? `transform:translate(${Math.round(b.x - 6)}px,${Math.round(b.y - 6)}px);width:${Math.round(b.w + 12)}px;height:${Math.round(b.h + 12)}px` : "display:none");
    };

    const watch = new ResizeObserver(() => { resize(); if (pending) { pending = false; fit(); } });
    watch.observe(el);
    resize();
    renderer.setAnimationLoop(() => {
      const [w, h] = size();
      if (!w || !h) return; // hidden (another page, a closed drawer): nothing to draw
      controls.update();
      renderer.setViewport(0, 0, w, h);
      renderer.clear();
      renderer.render(scene, cam);
      cube?.draw(h);
      triad?.draw(h);
      overlay();
    });

    return () => {
      camera.current = { eye: cam.position.clone(), target: controls.target.clone() };
      renderer.setAnimationLoop(null);
      watch.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      cube?.dispose();
      triad?.dispose();
      marks.remove();
      controls.dispose();
      for (const { obj } of objects.values()) dispose(obj);
      scene.traverse((o) => { if (o.userData.floor) dispose(o); });
      renderer.dispose();
      renderer.domElement.remove();
      stage.current = null;
      if (handle) handle.current = null;
    };
  }, [theme, viewKey, orientation]); // eslint-disable-line react-hooks/exhaustive-deps -- the view is read once per build

  useEffect(() => {
    stage.current?.scene.traverse((o) => { if (o.userData.floor) o.visible = grid && (view.mode !== "3d" || view.grid !== false); });
  }, [grid, theme, viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    for (const [id, { obj, look }] of s.objects) {
      const e = entities[id];
      if (!e || lookOf(e) !== look) { s.scene.remove(obj); dispose(obj); s.objects.delete(id); }
    }
    for (const e of Object.values(entities)) {
      let entry = s.objects.get(e.id);
      if (!entry) {
        entry = { obj: createObject(e, s.colors), look: lookOf(e) };
        entry.obj.userData.entity = e.id;
        s.objects.set(e.id, entry);
        s.scene.add(entry.obj);
      }
      applyEntity(entry.obj, e);
    }
    // Where the station didn't say where the camera opens, it opens on everything, at once.
    if (!fitted.current && s.objects.size && !(view.mode === "3d" && view.camera)) { fitted.current = true; s.fit(); }
  }, [entities, theme, viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="scene-view" ref={host} />;
}
