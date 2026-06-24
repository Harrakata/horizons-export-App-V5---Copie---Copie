# Gestion PDV — UI Kit (conventions)

A shadcn/ui-style React kit (Radix primitives + Tailwind), themed with CSS-variable
design tokens. Brand accent is teal (`--primary: 174 84% 32%`, #0D9488); brand gradients
pair it with cyan. UI copy is in **French** (the product is a points-de-vente management app).

## Setup & theming
- **Most components need no provider.** Trigger-based overlays (`Dialog`, `Select`,
  `DropdownMenu`, `Popover`) are self-contained via their own Radix Root. Two exceptions:
  wrap tooltips in **`TooltipProvider`** and toasts in **`ToastProvider`** (with a
  `ToastViewport`) — these render blank without their provider.
- The theme is delivered entirely through **CSS custom properties** defined on `:root`
  in `styles.css` (which `@import`s `_ds_bundle.css`). Import `styles.css` once at the app
  root — that is what makes the tokens and component styles resolve. Without it components
  render unstyled.
- **Dark mode**: add `class="dark"` to a wrapping element (e.g. `<html>`); the `.dark`
  block in `styles.css` overrides the same tokens.

## Styling idiom — Tailwind utilities + token colors
Style with **Tailwind utility classes**; every component forwards `className` (merged with
its own classes via `tailwind-merge`, so your classes win on conflict). Use the **token
color families**, never raw hex — they map to the CSS variables above:

| Family | Classes |
|---|---|
| Surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-accent` |
| Brand / actions | `bg-primary` + `text-primary-foreground`, `bg-secondary` + `text-secondary-foreground`, `bg-destructive` + `text-destructive-foreground` |
| Text | `text-foreground`, `text-muted-foreground` |
| Borders / focus | `border-input`, `border`, `ring-ring` |
| Radius | `rounded-md`, `rounded-lg` (driven by `--radius`) |

Component **variants are props, not classes**:
- `Button` — `variant`: `default | secondary | destructive | outline | ghost | link`;
  `size`: `default | sm | lg | icon`. (`asChild` renders the child as the button.)
- `Badge` — `variant`: `default | secondary | destructive | outline`.

## Where the truth lives
- **`styles.css`** (+ its `@import` of `_ds_bundle.css`) — the full token + utility surface.
  Read it before inventing class names.
- **`components/general/<Name>/<Name>.d.ts`** — the prop contract for each component.
- **`components/general/<Name>/<Name>.prompt.md`** — per-component usage notes.

## Idiomatic example
```jsx
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Badge,
} from 'pmu-mali-gestion';

function PdvCard() {
  return (
    <Card className="w-[340px]">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Bamako Centre</CardTitle>
          <Badge>Actif</Badge>
        </div>
        <CardDescription>Agence régionale · Code PDV 0427</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Chiffre du jour : 1 240 500 FCFA
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm">Détails</Button>
        <Button size="sm">Pointer</Button>
      </CardFooter>
    </Card>
  );
}
```

`Dialog` composes `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`,
`DialogDescription`, and `DialogFooter` (all exported). Footer actions stack full-width
below ~640px and become a right-aligned row above it.
