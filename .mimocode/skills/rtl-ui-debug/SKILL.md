---
name: rtl-ui-debug
description: Debug and fix RTL (right-to-left) Hebrew text alignment issues in clock-bill UI components, especially Radix UI primitives and nested component trees.
---

# RTL UI Debug

Systematic workflow for diagnosing and fixing Hebrew RTL text alignment issues in clock-bill.

## When to trigger

- User reports Hebrew text appearing on the wrong side (left instead of right)
- Dialogs, selects, popovers, or dropdowns have misaligned text
- Nested components break RTL inheritance
- After adding or modifying Radix UI components (Select, Dialog, Popover, etc.)

## Procedure

### 1. Capture the issue

- Ask for or take a screenshot of the misaligned component
- Note which component is affected (Select, Dialog, DropdownMenu, etc.)

### 2. Check Radix Direction propagation

```bash
# Check if DirectionProvider is set up
grep -rn "DirectionProvider\|dir=" app/layout.tsx app/\[locale\]/layout.tsx components/providers.tsx

# Check which Radix primitives are used
grep -rn "@radix-ui/react-" components/ui --include="*.tsx" | grep import | sort -u

# Verify the dir prop reaches the component tree
grep -rn "<Providers" app components
```

Key: `dir="rtl"` must be set on root layout AND passed through Providers to reach Radix portals (Dialog, Select, Popover render outside the tree).

### 3. Check logical CSS properties

All layout CSS must use logical properties for RTL:

| ❌ Physical | ✅ Logical |
|---|---|
| `pl-4`, `pr-4` | `ps-4`, `pe-4` |
| `ml-2`, `mr-2` | `ms-2`, `me-2` |
| `left-0`, `right-0` | `start-0`, `end-0` |
| `text-left`, `text-right` | `text-start`, `text-end` |
| `border-l`, `border-r` | `border-s`, `border-e` |
| `rounded-l`, `rounded-r` | `rounded-s`, `rounded-e` |

```bash
# Find physical properties that should be logical
grep -rn "pl-\|pr-\|ml-\|mr-\|left-\|right-\|text-left\|text-right" components/ app/ --include="*.tsx" | grep -v node_modules | grep -v ".next"
```

### 4. Check nested component RTL breaks

Common RTL breakage points:
- **DropdownMenu / Select content** — renders in a portal, may lose `dir` context
- **Popover content** — same portal issue
- **Sliders** — direction inversion needed
- **Form alignment** — labels, inputs, error messages
- **Tables** — column order
- **Toast notifications** — positioning
- **Navigation** — back/forward arrows may need `scale-x-[-1]`
- **Icons** — directional icons (arrows, chevrons) may need flipping

### 5. Fix and verify

1. Fix the `dir` prop propagation if needed (Providers → layout)
2. Replace physical CSS with logical properties
3. Add `dir` attribute to portal-rendered content if needed
4. Run type-check and lint:
```bash
npx tsc --noEmit
npm run lint
```
5. Visual verification in browser (Hebrew locale)

### 6. Gotchas

- **shadcn/ui components** already use logical properties in most cases — but custom additions may not
- **next-intl** locale routing: Hebrew is default (prefix-less `/`), English is `/en/`
- **Portal components** (Dialog, Select, Popover) render outside the React tree — they need explicit `dir` or `DirectionProvider`
- **`scale-x-[-1]`** is the escape hatch for icons that must visually flip in RTL but have no logical-property equivalent
