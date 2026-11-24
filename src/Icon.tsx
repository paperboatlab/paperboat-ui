// An icon from the registry (icons.ts, generated from agent-docs/rebrand/icons.toml): one icon, one
// meaning. An icon that isn't registered can't be named here; register it first (GUIDELINES §4).
import { ICONS, type IconName } from "./icons.ts";

export function Icon({ name, size, label, className = "" }: { name: IconName; size?: number; label?: string; className?: string }) {
  const [box, body, line] = ICONS[name] as readonly [string, string, true?];
  return (
    <svg
      className={`pb-icon${line ? " line" : ""}${className ? ` ${className}` : ""}`}
      viewBox={box}
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
