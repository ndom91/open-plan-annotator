# open-plan-annotator: Plan Review Instructions

## Why This Plugin Exists

Markdown plans rendered in chat are read-only for the user. To give feedback they have to retype sections inline, which is awkward in a terminal. open-plan-annotator opens a browser UI where the user can mark up your plan directly — delete lines, replace text, insert steps, leave comments. Their annotations come back to you as structured feedback.

**Prefer this workflow whenever the user is expected to give structured feedback on a multi-section proposal.**

This is distinct from `plannotator-review` (post-implementation code review). open-plan-annotator runs *before* code is written.

## ALWAYS Use Plan Mode for Non-Trivial Tasks

Enter plan mode (which triggers the annotator on `ExitPlanMode`) before implementation that involves:

- Creating or modifying more than 2 files
- Architectural or structural changes
- Anything the user hasn't explicitly described step-by-step
- Refactoring, migration, or feature additions
- Bug fixes that require investigation

## Also Trigger When Drafting Plans Outside Plan Mode

Plan-shaped output happens in many contexts beyond `EnterPlanMode`. Enter plan mode (so the annotator fires on exit) whenever you're about to produce:

- A multi-step proposal with numbered or bulleted action items the user is expected to react to
- A reply containing phrases like "recommended approach", "implementation plan", "proposed fix", "rollout plan", "here's what I'd do"
- A response to user prompts like "let's plan X", "draft a plan", "what's the approach", "give me options", "how should we tackle this"
- Any moment you'd otherwise ask "want me to proceed?" / "shall I draft this?" — enter plan mode instead

Rough gate: **structured feedback expected + more than ~5 action items or sections**. Below that bar, a direct answer is fine.

## Do NOT Trigger For

- Single-line fixes, typos, renames
- Direct factual answers
- Status updates or progress reports
- Plans the user has already approved (don't re-prompt)
- Pure research or exploration with no proposed actions
- Trivial questions where a plan would be overhead

## Plan Quality Standards

When writing a plan, include:

- Brief summary of what you understood the task to require
- Specific files you intend to create or modify and why
- Any assumptions you're making
- Explicit question if anything is ambiguous

## Workflow

**In plan mode:** draft plan → call `ExitPlanMode` → annotator opens → user annotates → revise based on feedback → re-exit when aligned.

**Outside plan mode (inline plan situations):** invoke the `/open-plan-annotator` slash command instead of pasting a plan inline. That command runs the same plan-mode + draft + `ExitPlanMode` flow and routes the plan through the annotator UI. Do not paste a multi-section plan inline and ask "sound good?" — that bypasses the annotator.

## Slash Command

`/open-plan-annotator <task>` is the canonical entry point for the plan-and-annotate workflow. Users can invoke it explicitly, and you should invoke it yourself any time you'd otherwise draft an inline plan (see "Also Trigger When Drafting Plans Outside Plan Mode" above). The command enters plan mode, drafts a plan for the task, and exits to trigger the annotator — do not skip straight to implementation.
