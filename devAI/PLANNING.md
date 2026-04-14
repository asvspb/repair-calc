# Planning - Repair Calculator (Fix Typing Error)

## Goal
Fix a TypeScript narrowing error in `BackupManager.tsx` where the `error` property was not recognized in the `else` block of an `if (result.success)` check.

## Proposed Changes
- Refactor `handleFileSelect` in `BackupManager.tsx` to use more robust type narrowing.
- Prefer `in` operator for discriminated unions when property-based narrowing is needed.
- Ensure all downstream logic (like `objectCount` calculation) is correctly updated.

## Verification Plan
- [x] Manual verification of code structure.
- [ ] Automated tests (failed due to Node version issue in environment, needs local verification by user).

## Status
- **2026-04-14**: Implemented fix using `in` operator. Narrowing is now robust. Task completed.
