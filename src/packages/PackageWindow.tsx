// The window every app opens its package manager in: the shared Dialog, tall, titled with the
// bootstrapped runtime's version tags. The package manager is opened rarely, so it gets no tab
// or dock of its own.
import type { ReactNode } from "react";
import { Dialog } from "../Dialog.tsx";

export function PackageWindow({ title, tags = [], onClose, children }: {
  title: string;
  /** Short facts in the head: the runtime and its version, say. */
  tags?: (string | false | undefined | null)[];
  onClose: () => void;
  children: ReactNode;
}) {
  return <Dialog title={title} tags={tags} wide className="tall" onClose={onClose}>{children}</Dialog>;
}
