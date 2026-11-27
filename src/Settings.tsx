// Settings (REBRAND "Settings"): one floating window in every app, File › Settings… and the rail's Settings
// (Ctrl ,). A rail of pages on the left, in this order: General and the app's own page in every app, Editor
// where the app has an editor pane, Hub where the app uses hubs, Shortcuts. Rows: name and hint left, the
// control right, applied as changed (no Save).
import { useState, type ReactNode } from "react";
import type { Command } from "./commands.ts";
import { Dialog } from "./Dialog.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icons.ts";
import { Segmented } from "./controls.tsx";
import { SCALES, type Scale } from "./scale.ts";
import { THEMES, ThemePreview, type Theme } from "./theme.tsx";

export type SettingsPage = { id: string; label: string; icon: IconName; body: ReactNode };

export function Settings({ app, pages, page: initial, onClose }: {
  /** The app's name, beside the title. */
  app: string;
  pages: SettingsPage[];
  /** The page it opens on (Help › Keyboard shortcuts: "shortcuts"); default the first. */
  page?: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(() => (pages.some((p) => p.id === initial) ? initial! : pages[0]?.id));
  const shown = pages.find((p) => p.id === page) ?? pages[0];
  return (
    <Dialog title="Settings" tags={[app]} className="settings" onClose={onClose}>
      <div className="settings-body">
        <nav className="settings-nav" aria-label="Settings pages">
          {pages.map((p) => (
            <button key={p.id} type="button" aria-current={p.id === shown?.id ? "page" : undefined} onClick={() => setPage(p.id)}>
              <Icon name={p.icon} size={16} />{p.label}
            </button>
          ))}
        </nav>
        <div className="settings-page" role="region" aria-label={shown?.label}>{shown?.body}</div>
      </div>
    </Dialog>
  );
}

/** A group of rows under a heading. */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="settings-section"><h3>{title}</h3>{children}</section>;
}

/** One setting: its name and a hint on the left, the control on the right. */
export function SettingRow({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="sl"><b>{label}</b>{hint && <small>{hint}</small>}</div>
      <div className="sctl">{children}</div>
    </div>
  );
}

const NAME: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };

/** General › Appearance: the theme, three miniature windows (one setting for every Paperboat app). */
export function ThemeSetting({ theme, onTheme }: { theme: Theme; onTheme: (t: Theme) => void }) {
  return (
    <SettingsSection title="Theme">
      <div className="theme-choices large" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={t === theme} onClick={() => t !== theme && onTheme(t)}>
            <ThemePreview theme={t} width={112} />{NAME[t]}
          </button>
        ))}
      </div>
      <p className="settings-note">Applies to every Paperboat app</p>
    </SettingsSection>
  );
}

const SIZE: Record<string, string> = { "0.75": "Compact", "1": "Default", "1.25": "Large" };

/** General › Size: the whole interface at 75, 100 or 125 % (one setting for every Paperboat app; useScale applies it). */
export function ScaleSetting({ scale, onScale }: { scale: Scale; onScale: (s: Scale) => void }) {
  return (
    <SettingsSection title="Size">
      <SettingRow label="Interface scale" hint="Applies to every Paperboat app">
        <Segmented label="Interface scale" value={String(scale)} onChange={(v) => onScale(Number(v) as Scale)}
          options={SCALES.map((s) => ({ value: String(s), label: <>{SIZE[String(s)]} <span className="muted">{s * 100} %</span></> }))} />
      </SettingRow>
    </SettingsSection>
  );
}

/** The Shortcuts page: every key the app's commands know, by menu; changing them comes later. */
export function ShortcutList({ commands, menus }: { commands: Command[]; menus?: { id: string; label: string }[] }) {
  const keyed = commands.filter((c) => c.shortcut);
  const order = menus?.map((m) => m.id) ?? [...new Set(keyed.map((c) => c.menu))];
  const label = (id: string) => menus?.find((m) => m.id === id)?.label ?? id[0].toUpperCase() + id.slice(1);
  if (!keyed.length) return <p className="settings-note">No shortcuts.</p>;
  return (
    <>
      {order.filter((m) => keyed.some((c) => c.menu === m)).map((m) => (
        <SettingsSection key={m} title={label(m)}>
          {keyed.filter((c) => c.menu === m).map((c) => (
            <div key={c.id} className="set-row key-row"><span>{c.label.replace(/…$/, "")}</span><kbd>{c.shortcut}</kbd></div>
          ))}
        </SettingsSection>
      ))}
    </>
  );
}
