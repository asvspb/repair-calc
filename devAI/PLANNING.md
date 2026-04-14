# Planning - Repair Calculator (Fix Typing Error)

## Goal
Fix a TypeScript narrowing error in `BackupManager.tsx` where the `error` property was not recognized in the `else` block of an `if (result.success)` check.

## Proposed Changes
- Refactor `handleFileSelect` in `BackupManager.tsx` to use more robust type narrowing.
- Use `in` operator for discriminated unions when property-based narrowing is needed.
- Fix type signature of `handleLoadTemplate` in `RoomEditor.tsx` to match `WorkTemplatePickerModal` props.
- Fix type narrowing for `SaveResult` in `WorkTemplateSaveButton.tsx`.

## Verification Plan
- [x] Manual verification of code structure.
- [ ] Automated tests (failed due to Node version issue in environment).

## Status
- **2026-04-14**:
    - Fixed `BackupManager.tsx` (typing narrowing).
    - Fixed `RoomEditor.tsx` (type mismatch in `onSelect`).
    - Fixed `WorkTemplateSaveButton.tsx` (typing narrowing).
    - All reported TypeScript errors at these locations resolved.
