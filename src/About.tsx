// The About window, the same in every app and the Launcher (REBRAND "About", ui-example.html §10):
// a dialog over a scrim (Help › About, Esc closes), the app's mark folding and unfolding (AppMark
// `loop`: it rests a second on the finished logo, never on the folded start; reduced motion keeps it
// still), the lockup, the versions, Copy version info · Check for updates · Source on GitHub, the
// credits, and every attribution with what it does, its licence and its link.
import { useEffect, useState } from "react";
import { AppMark } from "./AppMark.tsx";
import { Dialog } from "./Dialog.tsx";
import { Key } from "./Key.tsx";
import { appName, builtOn, FONT_CREDITS, versionInfo, type Credit } from "./about.ts";
import type { App } from "./fold.ts";

function Credits({ title, rows }: { title: string; rows: Credit[] }) {
  return (
    <>
      <div className="about-group">{title}</div>
      <table className="about-credits"><tbody>
        {rows.map(([name, what, licence, url]) => (
          <tr key={name}><td><b>{name}</b></td><td className="about-muted">{what}</td><td><code>{licence}</code></td>
            <td><a href={url} target="_blank" rel="noreferrer">{url.replace(/^https:\/\//, "")}</a></td></tr>
        ))}
      </tbody></table>
    </>
  );
}

export function About({ app, role, version, paperboat, info, repo, credits = [], onCheckUpdates, onClose }: {
  app: App;
  /** One line: what the app is. */
  role: string;
  version: string;
  /** The Paperboat it belongs to; null when it isn't installed; left out (or while asking) the line isn't shown. */
  paperboat?: string | null;
  /** In mono: what it talks to (engine and protocol, omc, Julia) and the commit. */
  info?: string;
  /** Its repository, `owner/name`. */
  repo: string;
  /** Its own libraries and runtimes; the kit's and the fonts follow. */
  credits?: Credit[];
  /** The app's own check; without it, the key opens the releases page. */
  onCheckUpdates?: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t); }, [copied]);
  const url = `https://github.com/${repo}`;
  const open = (u: string) => window.open(u, "_blank", "noreferrer");
  const copy = () => void navigator.clipboard?.writeText(versionInfo(app, version, paperboat, info)).then(() => setCopied(true));
  return (
    <Dialog title="About" wide className="about" onClose={onClose}>
      <div className="about-top">
        <AppMark app={app} size={112} loop label={appName(app)} />
        <div className="about-name">
          <span className="about-lockup">{app === "paperboat" ? <b>Paperboat</b> : <><span>Paperboat</span> <b>{appName(app)}</b></>}</span>
          <small>{role}</small>
          <div className="about-version"><b>Version {version}</b>{app !== "paperboat" && paperboat !== undefined && <span>{paperboat ? `Paperboat ${paperboat}` : "Paperboat not installed"}</span>}{info && <code>{info}</code>}</div>
          <div className="about-keys">
            <Key size="sm" icon={copied ? "check" : "copy"} onClick={copy}>{copied ? "Copied" : "Copy version info"}</Key>
            <Key size="sm" icon="cloud-download" onClick={onCheckUpdates ?? (() => open(`${url}/releases`))}>Check for updates</Key>
            <Key size="sm" icon="link-external" onClick={() => open(url)}>Source on GitHub</Key>
          </div>
        </div>
      </div>
      <div className="about-made"><b>Made by the Paperboat Lab contributors</b> · free software under{" "}
        <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer">GPL-3.0-only</a> ·{" "}
        <a href={`${url}/graphs/contributors`} target="_blank" rel="noreferrer">contributors</a> ·{" "}
        <a href="https://paperboatlab.github.io" target="_blank" rel="noreferrer">docs</a> ·{" "}
        <a href={`${url}/issues`} target="_blank" rel="noreferrer">report an issue</a></div>
      <div>
        <Credits title="Built on" rows={builtOn(credits)} />
        <Credits title="Fonts and icons" rows={FONT_CREDITS} />
      </div>
      <div className="about-foot">© 2026 the Paperboat Lab contributors. Codicons © Microsoft, CC BY 4.0. Each library above keeps its own licence; the full texts ship with the app.</div>
    </Dialog>
  );
}
