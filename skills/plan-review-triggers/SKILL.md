---
name: plan-review-triggers
description: Required reading whenever drafting any multi-step proposal, implementation plan, refactor approach, or response containing file paths and decision points. Use BEFORE writing any response that lists 3+ file paths, 2+ option-tradeoffs, a "Plan:"/"Steps:"/"Concrete changes:" section, or ends with "OK to proceed?" / "sound good?" / "shall I…?". Use whenever the user says "draft a plan", "let's plan X", "what's the approach", "give me options", "how should we tackle this", "what would it look like", or asks for a "recommended approach" / "implementation plan" / "proposed fix" / "rollout plan". Also use when modifying more than 2 files, doing architectural/structural changes, refactoring, migration, feature additions, or investigation-based bug fixes. Routes the response through the open-plan-annotator browser UI instead of pasting plans inline.
---

# Plan Review Triggers

<!--
This skill is the long-form trigger reference for end users who have the
open-plan-annotator plugin installed. The terse always-on reminder lives in
`scripts/session-context.mjs` (injected via the `SessionStart` hook); keep
the two in rough sync when editing trigger rules.
-->

This plugin (open-plan-annotator) installs a hook on `ExitPlanMode` that opens a browser UI where the user marks up plans directly — deletions, replacements, insertions, comments — and returns structured feedback. Inline markdown plans bypass that workflow.

## Hard Rule: Annotator Required When Triggers Match

Inline plans are a bug. When any trigger below fires, route through the annotator:

- Assistant-initiated (you decided a plan is needed): call `EnterPlanMode`, draft, then `ExitPlanMode` — fires the annotator hook.
- User-initiated ("draft a plan", "/plan", etc.): invoke `/annotate-plan <task>`.

## Mechanical Heuristic

Annotator REQUIRED when the response would contain ANY of:

- 3 or more file paths to create or modify
- 2 or more option/tradeoff comparisons for the user to choose between
- A `Plan:`, `Steps:`, `Concrete changes:`, `Implementation:`, `Approach:` section header
- A numbered/bulleted list of action items the user is expected to react to
- A multi-section proposal with decision points

Hard gate. Count file paths. Count options. If the count crosses the line, the inline response is not allowed.

## Task Shape Triggers

- Creating or modifying more than 2 files
- Architectural or structural changes
- Refactoring, migration, or feature additions
- Bug fixes that require investigation
- Anything the user has not explicitly described step-by-step

## Phrase Triggers

- User says "draft a plan", "let's plan X", "what's the approach", "give me options", "how should we tackle this", "what would it look like"
- Response would contain "recommended approach", "implementation plan", "proposed fix", "rollout plan", "here's what I'd do", "concrete file changes"
- Any moment you'd ask "want me to proceed?" / "shall I draft this?" / "OK to proceed?" / "sound good?"

## Mixed Signals Still Trigger

User messages combining directives ("let's add X", "can we Y") with an exploratory clause ("what do you think?") still trigger the annotator. Do NOT collapse into a short inline response because one clause was exploratory.

The annotator IS the discussion surface. Tradeoffs, options, and open questions belong inside the plan body where the user can comment on each one — not in flat chat. Treat exploratory clauses as "include alternatives in the plan", not "skip the plan".

## Self-Check Before Sending

Scan the drafted response for:

- "Concrete file changes", "Concrete changes", "Plan:", "Steps:", "Implementation:", "Approach:"
- "OK to proceed?", "Want me to proceed?", "Shall I…?", "Sound good?", "Confirm…?"
- 3+ lines that look like file paths (`foo/bar.tsx`, `path/to/file.ts`)
- Numbered list of more than 2 items each describing a code change
- "**N.**" / "**Fix N —**" headers introducing proposed changes

ANY match → discard inline response, route through annotator.

## Do NOT Trigger For

- Single-line fixes, typos, renames
- Direct factual answers
- Status updates or progress reports
- Already-approved plans (do not re-prompt)
- Pure research / exploration with no proposed actions
- Trivial questions where a plan is overhead
- Answering questions ABOUT an already-submitted plan (answer the question, do not re-submit)

## Plan Quality Standards

Include in every plan:

- Brief summary of the task as you understood it
- Specific files to create or modify and why
- Assumptions you are making
- Explicit questions if anything is ambiguous
- Tradeoffs / option comparisons inline (since mixed-signal user messages route here)

## Workflow

**Assistant-initiated:** `EnterPlanMode` → draft → `ExitPlanMode` → user annotates → revise on feedback → re-exit when aligned.

**User-initiated:** invoke `/annotate-plan <task>`. Same flow under the hood.

The slash command is for user invocation. When you decide a plan is needed without the user invoking it, prefer `EnterPlanMode` directly. Both paths fire the same annotator hook.

## After Approval

Plan approval is the user's go-ahead to implement. Once `ExitPlanMode` returns an approved decision, immediately start executing the approved plan.

Do not ask for another confirmation, do not say "ready when you are", and do not wait for a separate go-ahead unless the approval response explicitly requests changes or says not to proceed.
