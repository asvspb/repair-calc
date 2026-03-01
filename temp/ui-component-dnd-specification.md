# UI Component Specification: Draggable "Works and Materials" List Item

## Overview
Updated specification for list item cards in the "Работы и материалы" (Works and Materials) section with Drag-and-Drop (DnD) functionality for reordering items.

---

## Updated Visual Elements (left to right)

### 1. [NEW] Drag Handle Icon
| Property | Description |
|----------|-------------|
| **Appearance** | 6-dot grid icon (⠿) or 3 horizontal lines (≡), light gray color |
| **Cursor** | `grab` on hover (open hand), `grabbing` while dragging (closed fist) |
| **Purpose** | Dedicated zone for grabbing the card to reorder. Prevents accidental swipes or conflicts with clickable areas on mobile devices. |

> **Note**: The remaining elements (Checkbox, Settings Icon, Title, Total Price, Delete) shift slightly to the right to accommodate the drag handle.

---

## Component States

For intuitive UX, visual feedback must be added for each interaction state:

### 1. Normal (Default)
- Standard appearance with light border
- No special effects

### 2. Hover (Drag Handle)
- Drag handle icon darkens slightly
- Cursor changes to `grab`

### 3. Dragging (In Progress)
| Visual Change | Description |
|---------------|-------------|
| **Elevation** | Card "lifts" with increased `box-shadow` |
| **Background** | Slightly brighter or transparent (`opacity ~90%`) |
| **Cursor** | `grabbing` |

### 4. Drop Placeholder (Target Zone)
- Dashed border or semi-transparent silhouette appears at the drop location
- Shows where the card will be inserted upon release

---

## Updated Interaction Logic

| Action | Element | Result |
|--------|---------|--------|
| **Press/Hold** | Drag Handle Icon | Activates drag mode (entering Dragging state) |
| **Move** | Card (in Dragging state) | Moves card through list, displacing other elements (showing Placeholder) |
| **Release** | Card (in Dragging state) | Drops card at new position, updates order (saves to state/database) |
| **Click** | Checkbox | Toggles item inclusion in calculations |
| **Click** | Row (cube icon area) | Opens edit modal/dialog |
| **Click** | Trash Icon | Deletes item from list |

---

## Updated Component Hierarchy

```
┌───────────────────────────────────────────────────────────────┐
│ Works and Materials (Section Header)                          │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ⠿ ☑️ ⚙️ Выравнивание пола                    6 676 ₽ 🗑️ │
│ │       Р: 4 176 • М: 2 500                                 │
│ │       📦 1 — нажмите для редактирования                   │
│ └───────────────────────────────────────────────────────────┘ │
│ ┌ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ┐ │
│ │ (Drop Placeholder) - Зона, куда опустится элемент         │ │
│ └ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ┘ │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ⠿ ☑️ ⚙️ Другая работа                        1 000 ₽ 🗑️ │
│ │ ...                                                       │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## Development Notes & Recommendations

### 1. Library Selection

| Framework | Recommended Library |
|-----------|---------------------|
| **React** | `dnd-kit` (modern standard) or `react-beautiful-dnd` (legacy) |
| **Vue** | `VueDraggable` (based on Sortable.js) |
| **Vanilla JS** | `Sortable.js` or native HTML5 Drag & Drop API |

---

### 2. Touch Screen Considerations

⚠️ **Critical**: Use a dedicated **Drag Handle** (⠿).

**Why?**
- Making the entire card draggable via long-press conflicts with page scrolling on mobile devices.
- A dedicated drag handle resolves this conflict.

**Implementation:**
```css
.drag-handle {
  touch-action: none; /* Prevents browser handling of touch gestures */
}
```

---

### 3. Animation Guidelines

Add smooth animations for a polished, "premium" feel:

| Event | Animation Type |
|-------|----------------|
| Card lift/drop | Spring animation |
| Elements displacing | Smooth transition |
| Card returning to place (cancel) | Spring animation |

**Example (CSS):**
```css
.card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card.dragging {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
```

---

### 4. Accessibility (A11y)

Ensure keyboard users can reorder items:

| Key | Action |
|-----|--------|
| `Tab` | Focus on drag handle button |
| `Space` | Select/grab the item |
| `↑` / `↓` (Arrow Keys) | Move item up/down in list |
| `Enter` / `Space` | Drop item at new position |

**Screen Reader Support:**
Use `aria-live` to announce position changes:
```
"Выравнивание пола перемещено на позицию 2"
```

**ARIA Attributes:**
```html
<div 
  role="listitem" 
  aria-grabbed="false" 
  aria-describedby="drag-instructions"
>
  <!-- card content -->
</div>
```

---

## Implementation Checklist

- [ ] Add drag handle icon (⠿ or ≡) to the left of each card
- [ ] Implement drag state management (normal, hover, dragging, placeholder)
- [ ] Add visual feedback for each state (shadow, opacity, cursor)
- [ ] Integrate DnD library (dnd-kit, VueDraggable, etc.)
- [ ] Add touch support with `touch-action: none` on drag handle
- [ ] Implement smooth spring animations for drag/displace events
- [ ] Add keyboard navigation (Tab, Space, Arrow Keys)
- [ ] Add ARIA attributes and `aria-live` announcements
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Test with screen readers (NVDA, VoiceOver)

---

## Visual Reference

```
Normal State:
┌─────────────────────────────────────────────────────────┐
│ ⠿ ☑️ ⚙️ Название                    6 676 ₽ 🗑️        │
│       breakdown...                                      │
└─────────────────────────────────────────────────────────┘

Dragging State:
      ┌─────────────────────────────────────────────────┐
      │ ⠿ ☑️ ⚙️ Название (в процессе)    6 676 ₽ 🗑️  │  ← lifted with shadow
      │       breakdown...                              │
      └─────────────────────────────────────────────────┘
┌ - - - - - - - - - - - - - - - - - - - - - - - - - - - ┐
│ DROP PLACEHOLDER                                      │
└ - - - - - - - - - - - - - - - - - - - - - - - - - - - ┘
```
