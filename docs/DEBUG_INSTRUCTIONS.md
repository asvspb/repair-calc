# Debug Instructions for Section Dimensions Bug

## Added Logging

### Console Logs Added:

1. **RoomEditor.tsx** - Section handlers:
   - `[RoomEditor] addSubSection` - Logs before/after adding section
   - `[RoomEditor] removeSubSection` - Logs before/after removing section
   - `[RoomEditor] updateSubSection` - Logs every field update with BEFORE/AFTER states
   - `[RoomEditor] RENDER - SubSections` - Logs what data is being rendered
   - `[RoomEditor] RENDER - SUBSECTION` - Logs each subsection's data during render

2. **ProjectContext.tsx** - Room updates:
   - `[ProjectContext] updateRoom - CALL` - Logs incoming update request
   - `[ProjectContext] updateRoom - PREV ROOM` - Logs previous room state
   - `[ProjectContext] updateRoom - AFTER UPDATE` - Logs result after update

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

Look for this pattern in logs:

```
[RoomEditor] addSubSection - BEFORE: { subSectionsCount: 0, ... }
[RoomEditor] addSubSection - NEW SECTION: { id: 'abc123', ... }
[RoomEditor] addSubSection - AFTER: { subSectionsCount: 1, ... }

[ProjectContext] updateRoom - CALL: { roomId: 'xyz', subSectionsCount: 1, ... }
[ProjectContext] updateRoom - PREV ROOM: { roomId: 'xyz', subSectionsCount: 0, ... }
[ProjectContext] updateRoom - AFTER UPDATE: { newSubSectionsCount: 1, ... }

[RoomEditor] RENDER - SubSections: { count: 1, ... }
[RoomEditor] RENDER - SUBSECTION: { index: 0, id: 'abc123', length: 5, width: 4 }
```

### What to Look For:

**Good (bug fixed):**
- Each section maintains its own `id`
- `updateSubSection` only updates the section with matching `id`
- `BEFORE` and `AFTER` logs show correct data preservation
- Render logs show correct data for each section

**Bad (bug still exists):**
- Section IDs are the same or undefined
- `updateSubSection` updates wrong section
- `BEFORE` shows correct data but `AFTER` shows reset data
- Render logs show same data for different sections
- `extendedModeData` count doesn't match `subSections` count

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
