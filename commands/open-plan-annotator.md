---
description: Draft a plan and open it in the annotator UI for user review
argument-hint: [task description]
---

The user wants a plan drafted and reviewed via the open-plan-annotator UI before any implementation.

**Task to plan:** $ARGUMENTS

Steps:

1. Enter plan mode (`EnterPlanMode`).
2. Investigate the codebase as needed to draft a concrete plan. Include:
   - Brief summary of what you understood the task to require
   - Specific files you intend to create or modify and why
   - Any assumptions you're making
   - Explicit questions if anything is ambiguous
3. Call `ExitPlanMode` with the plan. This triggers the open-plan-annotator browser UI.
4. The user will annotate the plan (deletions, replacements, insertions, comments) in the browser.
5. If the user denies with annotations, revise the plan based on their feedback and re-exit plan mode.
6. Only begin implementation after the user approves.

Do not skip plan mode. Do not paste a plan inline and ask "sound good?" — that bypasses the annotator UI the user installed this plugin for.
