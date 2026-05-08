---
description: Draft a plan and open it in the annotator UI for user review
argument-hint: [task description]
---

The user wants a plan drafted and reviewed via the open-plan-annotator UI before any implementation. This is required, not optional.

**Task to plan:** $ARGUMENTS

Steps:

1. Enter plan mode (`EnterPlanMode`).
2. Investigate the codebase as needed to draft a concrete plan. Include:
   - Brief summary of what you understood the task to require
   - Specific files you intend to create or modify and why
   - Any assumptions you are making
   - Tradeoffs and option comparisons inline (do NOT pull these into chat — they belong in the plan body where the user can comment on each one)
   - Explicit questions if anything is ambiguous
3. Call `ExitPlanMode` with the plan. This triggers the open-plan-annotator browser UI.
4. The user will annotate the plan (deletions, replacements, insertions, comments) in the browser.
5. If the user denies with annotations, revise the plan based on their feedback and re-exit plan mode.
6. Only begin implementation after the user approves.

Hard rules:

- Do not skip plan mode.
- Do not paste a plan inline and ask "sound good?" — that bypasses the annotator UI the user installed this plugin for.
- Do not collapse into a 2-3 sentence inline response just because the user message contains an exploratory clause like "what do you think?" alongside directive items. Mixed signals still route through the annotator.
- Self-check the response before sending: if it contains a "Plan:" / "Steps:" / "Concrete changes:" header, 3+ file paths, or ends with "OK to proceed?" — discard and route through the annotator instead.
