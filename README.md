# Paperboat UI

The Paperboat look as React components (`@paperboatlab/ui`): the design tokens, keys, pills, the
spinner, the rail, panels, dialogs, menus, toasts, the theme picker, the floating search and the app
marks with their idle fold. Every [Paperboat](https://github.com/paperboatlab/paperboat) app uses it
(the Launcher, Malachite, Simplicial, Articula, Julix). It holds no app logic. It replaces
[paperboat-shared-legacy](https://github.com/paperboatlab/paperboat-shared-legacy).

**Design:** the rebrand (`agent-docs/rebrand`: REBRAND.md, out/brand.html) · **Icons:** one registry,
`agent-docs/rebrand/icons.toml`; `npm run icons` writes `src/icons.ts` from it.

## Use

```sh
echo "@paperboatlab:registry=https://npm.pkg.github.com" >> .npmrc
npm install @paperboatlab/ui
```

```tsx
import "@paperboatlab/ui/tokens.css";
import "@paperboatlab/ui/ui.css";
import { Key, Rail, ThemePicker } from "@paperboatlab/ui";
```

Each app sets `data-app` on `<html>` (`paperboat`, `simplicial`, `articula`, `julix`, `malachite`) for
its accent.

## Check

```sh
npm ci
npm run typecheck
npm test
npm run demo        # every component, light and dark: serve demo/ and open index.html
```

## CI

[ci.yml](.github/workflows/ci.yml) typechecks and tests every push; a `v*` tag publishes the package to
GitHub Packages.

## Licence

GNU General Public License version 3 (see [LICENSE](LICENSE)). Codicons: CC BY 4.0, Microsoft.
