# Debug Instructions for Section Dimensions Bug

> **Примечание (2026-04-16):** Все `console.*` в клиенте заменены на структурированный логгер `src/utils/logger.ts`. При добавлении новых точек отладки используйте `logDebug()`, `logError()` и другие функции из модуля.

## Added Logging

### Structured Logger Calls (src/utils/logger.ts):

1. **RoomEditor.tsx** - Section handlers:
   - `logDebug('RoomEditor', 'addSubSection', ...)` - Logs before/after adding section
   - `logDebug('RoomEditor', 'removeSubSection', ...)` - Logs before/after removing section
   - `logDebug('RoomEditor', 'updateSubSection', ...)` - Logs every field update with BEFORE/AFTER states
   - `logDebug('RoomEditor', 'RENDER SubSections', ...)` - Logs what data is being rendered
   - `logDebug('RoomEditor', 'RENDER SUBSECTION', ...)` - Logs each subsection's data during render

2. **ProjectContext.tsx** - Room updates:
   - `logDebug('ProjectContext', 'updateRoom CALL', ...)` - Logs incoming update request
   - `logDebug('ProjectContext', 'updateRoom PREV ROOM', ...)` - Logs previous room state
   - `logDebug('ProjectContext', 'updateRoom AFTER UPDATE', ...)` - Logs result after update

> **Не используйте `console.log` напрямую** — вместо этого импортируйте нужную функцию из `src/utils/logger.ts`:
> ```typescript
> import { logDebug, logError, logWarning } from '../utils/logger';
> logDebug('MyComponent', 'action', { key: value });
> ```

## How to Debug

### Step 1: Open Browser Console
1. Open http://localhost:3993
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Clear console (trash icon)

### Step 2: Reproduce the Bug
1. Create a new room
2. Switch to **Extended mode** (Расширенный режим)
3. Click **"+ Добавить секцию"**
4. Enter dimensions: Length=5, Width=4
5. **Watch the console logs**
6. Click **"+ Добавить секцию"** again
7. Enter dimensions: Length=3, Width=3
8. **Watch the console logs**

### Step 3: Analyze Logs

Look for this pattern in DevTools (grouped collapsed format):

```
▼ 🔍 [12:30:13] [RoomEditor] addSubSection (0ms)
    📦 Данные: { subSectionsCount: 0, ... }
▼ 🔍 [12:30:13] [RoomEditor] addSubSection AFTER (2ms)
    📦 Данные: { subSectionsCount: 1, ... }

▼ 🔍 [12:30:13] [ProjectContext] updateRoom CALL (0ms)
    📦 Данные: { roomId: 'xyz', subSectionsCount: 1, ... }
▼ 🔍 [12:30:14] [ProjectContext] updateRoom AFTER UPDATE (5ms)
    📦 Данные: { newSubSectionsCount: 1, ... }

▼ 🔍 [12:30:14] [RoomEditor] RENDER SubSections (0ms)
    📦 Данные: { count: 1, ... }
```

> Также можно получить историю через `window.debugLogger.getHistory()`.

### What to Look For:

**Good (bug fixed):**
- Each section maintains its own `id`
- `updateSubSection` only updates the section with matching `id`
- BEFORE and AFTER logs show correct data preservation
- Render logs show correct data for each section

**Bad (bug still exists):**
- Section IDs are the same or undefined
- `updateSubSection` updates wrong section
- BEFORE shows correct data but AFTER shows reset data
- Render logs show same data for different sections
- `extendedModeData` count doesn't match `subSections` count

> Для быстрого анализа используйте `window.debugLogger.printHistory()` в DevTools.

## Playwright Test

Run the automated browser test:

```bash
cd /home/asv-spb/Dev/my-coding/repair-calc
npx playwright test tests/e2e/section-dimensions.test.ts --headed
```

This will:
1. Open a real browser
2. Create a room
3. Add sections with different dimensions
4. Verify dimensions are preserved
5. Show you exactly where it fails

## Key Questions to Answer:

1. **When does the bug occur?**
   - On first section add? → Check `addSubSection` logs
   - On second section add? → Check `updateSubSection` logs
   - On typing? → Check input event handlers
   - On blur? → Check `onChange` handlers

2. **What data is corrupted?**
   - All fields reset? → Check state management
   - Only some fields? → Check field-specific handlers
   - Wrong section's data? → Check ID matching logic

3. **Where does corruption happen?**
   - In `RoomEditor`? → Check `[RoomEditor]` logs
   - In `ProjectContext`? → Check `[ProjectContext]` logs
   - During render? → Check `[RENDER]` logs

## Next Steps After Collecting Logs:

1. **Copy console output** to a file
2. **Identify the exact point** where data gets corrupted
3. **Share the logs** for further analysis

## Alternative: Check React DevTools

1. Install **React Developer Tools** extension
2. Open React tab in DevTools
3. Find `RoomEditor` component
4. Inspect `room` prop and `subSections` state
5. Watch how data changes on each interaction
