# design-sync notes — Gestion PDV UI Kit

Repo-specific gotchas for future syncs. The app is a **Vite React app**, not a packaged
component library, so the package shape runs in **synth-entry mode**.

## Setup quirks (must reproduce)
- **No library build.** `npm run build` builds the *app*, not a component entry. The
  converter synthesizes its entry from `srcDir` (`[NO_DIST]` is expected, not an error).
- **Self-referential package dir.** npm won't self-install, so `node_modules/pmu-mali-gestion`
  doesn't exist. We create a **Windows junction** `node_modules/pmu-mali-gestion → repo root`
  so `PKG_DIR` resolves. Recreate on a fresh clone:
  `New-Item -ItemType Junction -Path node_modules/pmu-mali-gestion -Target <repoRoot>`.
- **`@/` alias** is defined in `vite.config.js` (not a tsconfig). We added `tsconfig.dsync.json`
  with `paths: { "@/*": ["src/*"] }` and point `cfg.tsconfig` at it so esbuild resolves it.
- **CSS is Tailwind-generated.** There is no shipped stylesheet. We compile one with
  `.design-sync/tailwind.dsync.cjs` (mirrors the app theme, scopes content to the UI kit +
  previews) into `.design-sync/ds-tailwind.css` and point `cfg.cssEntry` at it. **Regenerate
  before every build** (it is gitignored):
  `npx tailwindcss -c .design-sync/tailwind.dsync.cjs -i ./src/index.css -o ./.design-sync/ds-tailwind.css`

## Scope (full kit)
- `cfg.srcDir` = `src/components/ui` → 22 top-level components authored as cards. The ~67
  compound sub-parts (CardHeader…, DialogContent…, SelectItem…, TableCell…) are kept on the
  bundle global (so the agent can compose them) but excluded as standalone cards via
  `componentSrcMap: null`.
- `AnchoredPopover` is a **default-only export** → not on the `export *` synth-entry global;
  excluded. `Toaster` (imperative renderer) and `SkeletonRow`/`SkeletonCard` are folded into
  other previews and excluded as cards.
- `.design-sync/pilot-ui/` (the earlier 5-file pilot copies) is now unused — safe to delete.

## Known render warns / overlay overrides
- Overlay/portal components use `cardMode: "single"` + a `viewport` so their OPEN state renders
  inside the card: `Dialog`, `Select`, `DropdownMenu`, `Popover`, `Tooltip`.
- `Toast` is **excluded as a card** (`componentSrcMap.Toast = null`): the Radix toast viewport is
  `fixed` + animates `slide-in-from-top-full`, which collapses/clips a static card in both single
  and column modes. It stays importable on the global; documented in conventions.md. To re-attempt
  a card, render a fully in-flow static representation (no fixed viewport, no enter animation).
- `Popover`: the trigger is centered (`flex justify-center`) so the centered panel has room and
  isn't clipped at the card's left edge.
- `Dialog` footer stacks full-width below the 640px `sm` breakpoint — intentional.

## Re-sync risks (watch list)
- **`pilot-ui/` copies drift** from the real `src/components/ui/*` — edits to the real files are
  NOT reflected until re-copied (or until `srcDir` is switched to the real dir). The pilot dir is
  gitignored, so a fresh clone must recreate it (or switch to the full-kit scope).
- The compiled `ds-tailwind.css` and the junction are gitignored — both must be regenerated per
  clone before building.
- `AnchoredPopover` and any other **default-only** exports won't appear on the global under
  synth-entry; add a named re-export upstream or exclude them.
