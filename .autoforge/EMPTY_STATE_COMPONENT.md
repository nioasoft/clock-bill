# EmptyState Component Documentation

## Overview
The EmptyState component is a reusable UI component for displaying empty states in lists and tables. It provides a consistent visual experience when there's no data to display.

## Location
`components/ui/empty-state.tsx`

## Features
- ✅ Optional icon display (from lucide-react)
- ✅ Required message text
- ✅ Optional description text
- ✅ Optional action button (with click handler or href)
- ✅ Full RTL support (Hebrew)
- ✅ Responsive design
- ✅ TypeScript types
- ✅ Matches existing design system (orange theme)

## Props

```typescript
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon        // Icon component to display above the message
  message: string          // Main message to display (required)
  description?: string     // Optional description text
  actionLabel?: string     // Optional action button label
  onAction?: () => void    // Optional action button click handler
  actionHref?: string      // Optional action button href (renders as Link)
  className?: string       // Optional custom className
}
```

## Usage Examples

### Basic Usage (message only)
```tsx
import { EmptyState } from "@/components/ui/empty-state"

<EmptyState message="אין נתונים" />
```

### With Icon
```tsx
import { EmptyState } from "@/components/ui/empty-state"
import { Users } from "lucide-react"

<EmptyState
  icon={Users}
  message="אין לקוחות עדיין"
/>
```

### With Icon and Description
```tsx
import { EmptyState } from "@/components/ui/empty-state"
import { Users } from "lucide-react"

<EmptyState
  icon={Users}
  message="אין לקוחות עדיין"
  description="צור לקוח ראשון כדי להתחיל"
/>
```

### With Action Button
```tsx
import { EmptyState } from "@/components/ui/empty-state"
import { FolderOpen } from "lucide-react"

<EmptyState
  icon={FolderOpen}
  message="אין פרויקטים עדיין"
  description="צור פרויקט ראשון כדי להתחיל"
  actionLabel="צור פרויקט"
  onAction={() => setShowForm(true)}
/>
```

### With Action Link
```tsx
import { EmptyState } from "@/components/ui/empty-state"
import { Inbox } from "lucide-react"

<EmptyState
  icon={Inbox}
  message="אין נתונים"
  description="עבור אל דף הלקוחות כדי ליצור לקוח ראשון"
  actionLabel="עבור ללקוחות"
  actionHref="/clients"
/>
```

### With Custom ClassName
```tsx
import { EmptyState } from "@/components/ui/empty-state"
import { Users } from "lucide-react"

<EmptyState
  icon={Users}
  message="אין לקוחות"
  className="min-h-[400px]"
/>
```

## Implementation in Pages

The EmptyState component is now used in:

1. **Clients Page** (`app/clients/page.tsx`)
   - Shows when no clients exist
   - Icon: Users
   - Action: "הוסף לקוח ראשון"

2. **Projects Page** (`app/projects/page.tsx`)
   - Shows when no projects exist
   - Icon: FolderOpen
   - Action: "צור פרויקט"

3. **Entries Page** (`app/entries/page.tsx`)
   - Shows when no time entries exist
   - Icon: Clock
   - Action: "רשום זמן ראשון"

## Design Specifications

### Visual Design
- **Icon Container**: 64x64px circle with orange-100 background
- **Icon Size**: 32x32px with orange-600 color
- **Message**: text-lg, font-medium, gray-900
- **Description**: text-sm, gray-500, max-width-md
- **Spacing**: Center-aligned with proper RTL margins

### RTL Support
- `dir="rtl"` set on the container
- All text aligns correctly for Hebrew
- Icons and buttons positioned correctly for RTL

### Accessibility
- Semantic HTML structure
- Proper heading hierarchy (message as main text)
- Focus states on action buttons
- ARIA-friendly (uses standard HTML elements)

## Testing

To test the EmptyState component:

1. Navigate to a page with empty data (e.g., /clients with no clients)
2. Verify the empty state is displayed
3. Check that the icon, message, and description are visible
4. Verify the action button works (click or navigate)
5. Check RTL layout is correct (text aligned right)
6. Verify responsive design on mobile

## Future Enhancements

Possible improvements:
- Add animation options
- Support for custom illustrations (beyond icons)
- Multiple action buttons
- Different size variants
- Theme variants

## Related Components

- Button (`components/ui/button.tsx`)
- Card (`components/ui/card.tsx`)
- Other lucide-react icons
