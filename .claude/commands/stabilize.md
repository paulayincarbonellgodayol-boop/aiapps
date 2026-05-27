# Stabilize Architecture

Audit and fix the codebase for bugs, overengineering, and structural instability — **without changing any UI or visual output**.

## Rules (non-negotiable)

1. **UI is frozen.** Do not alter any JSX, HTML structure, CSS classes, Tailwind utilities, color tokens, layout, typography, spacing, or anything a user can see or interact with. If a fix requires touching UI, stop and ask.
2. **No new abstractions.** Do not introduce utilities, helpers, wrappers, or layers that aren't required by the specific problem being fixed.
3. **No speculative changes.** Only fix what is demonstrably broken, duplicated, or unnecessarily complex. Do not refactor "while you're in there."
4. **Smallest diff possible.** Each change must have a clear, single justification.

## Process

1. **Read before touching.** Read every file in the project (excluding `node_modules`, `.next`, `.git`). Form a complete picture before proposing any change.
2. **Identify issues.** For each issue found, classify it:
   - `BUG` — incorrect behavior or runtime error
   - `DUPLICATE` — logic or data defined more than once
   - `OVERENGINEERED` — unnecessary complexity, abstraction, or indirection
   - `UNSTABLE` — fragile coupling, missing error boundary, type unsafety at a boundary
3. **Report findings first.** List all issues with file paths and line numbers before making any edits. Wait for confirmation if $ARGUMENTS contains `--dry-run`, otherwise proceed.
4. **Fix in order:** BUGs first, then DUPLICATEs, then OVERENGINEERED, then UNSTABLE.
5. **Verify build passes** after all changes (`npm run build`). If it fails, fix the build before reporting done.

## What counts as overengineered (examples)

- A component that wraps a single native element with no added behaviour
- An abstraction used in only one place
- A type alias that just renames a primitive
- A helper function whose body is a single expression
- CSS that reimplements what a Tailwind utility already does
- Config files that duplicate values already set by the framework

## Output format

After completing fixes, report:
```
Fixed:
- [BUG] <file>:<line> — <one-line description>
- [DUPLICATE] <file>:<line> — <one-line description>
...

Unchanged (UI frozen):
- <anything you explicitly chose not to touch because it was UI>

Build: ✓ passing
```
