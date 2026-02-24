# open-plan-annotator: Plan Review Instructions

## ALWAYS Use Plan Mode for Non-Trivial Tasks

Before beginning any implementation that involves:
- Creating or modifying more than 2 files
- Architectural or structural changes
- Anything the user hasn't explicitly described step-by-step
- Refactoring, migration, or feature additions
- Bug fixes that require investigation

You MUST use plan mode to present your approach first.

## Why This Matters

The user has installed the open-plan-annotator plugin specifically to review and annotate your plans before you write code. Skipping plan mode bypasses this workflow entirely and removes the user's ability to give structured feedback.

## Plan Quality Standards

When writing a plan, include:
- A brief summary of what you understood the task to require
- The specific files you intend to create or modify and why
- Any assumptions you are making
- An explicit question if anything is ambiguous

## When Plan Mode Is Optional

For truly trivial tasks (fix a typo, rename a single variable, answer a factual question), plan mode is not required. When in doubt, use it anyway — the user can always approve immediately.
