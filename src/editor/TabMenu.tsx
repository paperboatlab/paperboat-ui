// A tab's right-click menu, drawn like the file tree's (REBRAND "File menu"): a head naming the file over
// the menu. The items come from tabMenu (tabs.ts); the host keeps the tab tinted while the menu is open.
import { Icon } from "../Icon.tsx";
import { Menu, type MenuEntry } from "../Menu.tsx";
import { fileIconFor } from "../files/types.ts";
import { pageZoom } from "../scale.ts";

export function TabMenu({ path, x, y, items, onClose }: { path: string; x: number; y: number; items: MenuEntry[]; onClose: () => void }) {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { icon, tone } = fileIconFor(name, "file");
  const z = pageZoom();   // the pointer is in screen pixels
  return (
    <div className="file-menu own" style={{ left: Math.min(x / z, innerWidth / z - 290), top: Math.min(y / z, innerHeight / z - 420) }}>
      <div className="file-menu-head"><span style={{ color: `var(--file-${tone})`, display: "inline-flex" }}><Icon name={icon} /></span>{name}</div>
      <Menu label={`${name}: tab actions`} items={items} onClose={onClose} />
    </div>
  );
}
