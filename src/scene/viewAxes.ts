// The orientation triad (a station's `orientation = "axes"`): x, y and z arrows in the scene's bottom-left
// corner (`.view-axes`, placed by scene.css), turning with the camera. Engineering colours (--axis-x, -y, -z).
// From legacy shared's viewAxes.
import * as THREE from "three";
import { tokenColor, tokenCss } from "./colors.ts";

type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

function label(text: string, color: string, font: string): THREE.Sprite {
  const c = Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.font = `600 30px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 32, 34);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }));
  sprite.scale.set(0.5, 0.5, 1);
  return sprite;
}

export function viewAxes(host: HTMLElement, renderer: THREE.WebGLRenderer, camera: () => Camera) {
  const scene = new THREE.Scene();
  const font = getComputedStyle(host).getPropertyValue("--font-mono") || "monospace";
  const parts = (["x", "y", "z"] as const).map((name, i) => {
    const dir = new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(), 1, tokenColor(`--axis-${name}`, host).hex, 0.2, 0.12);
    const sprite = label(name, tokenCss(`--axis-${name}`, host), font);
    sprite.position.copy(dir).multiplyScalar(1.3);
    scene.add(arrow, sprite);
    return { arrow, sprite };
  });
  const eye = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 20);
  const overlay = document.createElement("div");
  overlay.className = "view-axes";
  host.append(overlay);

  return {
    draw(height: number) {
      eye.quaternion.copy(camera().quaternion);
      eye.position.set(0, 0, 5).applyQuaternion(camera().quaternion);
      const size = overlay.offsetWidth;
      if (!size) return;
      const x = overlay.offsetLeft, y = height - overlay.offsetTop - size;
      renderer.setViewport(x, y, size, size);
      renderer.setScissor(x, y, size, size);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      renderer.render(scene, eye);
      renderer.setScissorTest(false);
    },
    dispose() {
      overlay.remove();
      for (const { arrow, sprite } of parts) {
        arrow.dispose();
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
    },
  };
}
