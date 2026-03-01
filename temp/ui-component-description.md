# UI Component: "Works and Materials" List Item

## Overview
This is a list item card within a "Работы и материалы" (Works and Materials) section, displaying a service/item called "Выравнивание пола" (Floor leveling).

---

## Visual Elements (left to right)

### 1. Checkbox
- **Appearance**: Blue background with white checkmark
- **State**: Selected/checked
- **Purpose**: Enable/disable this item in calculations

### 2. Settings Icon
- **Appearance**: Gray sliders icon (⚙️)
- **Purpose**: Indicates this item has configurable parameters

### 3. Item Title
- **Text**: "Выравнивание пола"
- **Purpose**: Main label for the service

### 4. Total Price
- **Appearance**: Bold, dark blue text
- **Format**: "6 676 ₽"
- **Purpose**: Sum of labor + materials costs

### 5. Delete Icon
- **Appearance**: Trash can icon, gray color
- **Purpose**: Removes this item from the list

---

## Secondary Row (below title)

| Element | Description |
|---------|-------------|
| Cube Icon + Quantity | Shows "1" (current quantity) |
| Hint Text | "— нажмите для редактирования" (click to edit) |

**Interaction**: This entire row is clickable to open an edit modal/dialog

---

## Price Breakdown (small gray text under total)

| Code | Full Name | Value |
|------|-----------|-------|
| **Р** | Работа (Labor) | 4 176 ₽ |
| **М** | Материалы (Materials) | 2 500 ₽ |

**Separator**: Bullet point (•)

**Formula**: Total = Labor + Materials → 4176 + 2500 = 6676 ₽

---

## Interaction Logic

| Action | Element | Result |
|--------|---------|--------|
| Click | Checkbox | Toggles item inclusion in total calculation |
| Click | Row (cube icon area) | Opens edit dialog for modifying quantity/parameters |
| Click | Trash icon | Deletes the item from the list |

---

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ Works and Materials (Section Header)                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☑️ ⚙️ Выравнивание пола                    6 676 ₽ 🗑️ │
│ │    Р: 4 176 • М: 2 500                                  │
│ │    📦 1 — нажмите для редактирования                    │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Notes for Implementation
- Use a card-style container with rounded corners and light border
- Price should be prominently displayed (bold, larger font, accent color)
- Secondary information (price breakdown) should be smaller and gray
- Interactive elements should have hover states for better UX
- Checkbox state should persist and affect overall calculation totals
