# open-plan-annotator: Plan Review Instructions

<!--
Maintainer note: this file's content is mirrored in
`skills/plan-review-triggers/SKILL.md` because Claude Code plugin installs do
not load repo-root markdown — only skills/, commands/, hooks/. Keep both files
in sync when editing trigger rules. Sections that diverge intentionally
(audience, framing) are still close enough that a side-by-side diff catches
drift quickly.
-->

## Why This Plugin Exists

Markdown plans rendered in chat are read-only for the user. To give feedback they have to retype sections inline, which is awkward in a terminal. open-plan-annotator opens a browser UI where the user can mark up your plan directly — delete lines, replace text, insert steps, leave comments. Their annotations come back to you as structured feedback.

**This is the user's required review surface for any multi-section proposal.** Inline plans bypass the tool the user installed and silently lose their preferred feedback workflow.

This is distinct from `plannotator-review` (post-implementation code review). open-plan-annotator runs *before* code is written.

## Hard Rule: Annotator Required When Triggers Match

When any trigger below fires, you MUST route through the annotator. "Prefer" / "consider" do not apply. Inline plans are a bug.

- Assistant-initiated (you decided a plan is needed): call `EnterPlanMode`, draft, then `ExitPlanMode` — this fires the annotator hook.
- User-initiated ("draft a plan", "/plan", etc.): invoke the `/annotate-plan <task>` slash command. It runs the same plan-mode flow.

## Trigger: Mechanical Heuristic

Annotator REQUIRED when the response would contain ANY of:

- 3 or more file paths to be created or modified
- 2 or more option/tradeoff comparisons the user is asked to choose between
- A `Plan:`, `Steps:`, `Concrete changes:`, `Implementation:`, `Approach:`, or similar section header
- A numbered or bulleted list of action items the user is expected to react to
- A multi-section proposal with decision points

This is a hard gate. Count file paths. Count options. If the count crosses the line, you do not get to write the inline response.

## Trigger: Task Shape

Enter plan mode (or invoke the slash command) before any of:

- Creating or modifying more than 2 files
- Architectural or structural changes
- Refactoring, migration, or feature additions
- Bug fixes that require investigation
- Anything the user has not explicitly described step-by-step

## Trigger: Phrase Match

Treat these as plan triggers regardless of length:

- User says "draft a plan", "let's plan X", "what's the approach", "give me options", "how should we tackle this", "what would it look like"
- Your response would contain "recommended approach", "implementation plan", "proposed fix", "rollout plan", "here's what I'd do", or "concrete file changes"
- Any moment you would otherwise ask "want me to proceed?" / "shall I draft this?" / "OK to proceed?" / "sound good?"

## Mixed Signals: Still Trigger

When a user message combines directives ("let's add X", "can we Y") with an exploratory question ("what do you think?"), the annotator still applies. Do NOT collapse into a 2-3 sentence inline response just because one clause was exploratory.

The annotator IS the discussion surface. Tradeoffs, options, and open questions belong inside the plan body where the user can comment on each one — not in flat chat where they would have to retype your bullets to push back. Treat exploratory clauses as "include alternatives in the plan", not "skip the plan".

## Self-Check Before Sending

Before emitting any response, scan it for these strings:

- "Concrete file changes", "Concrete changes", "Plan:", "Steps:", "Implementation:", "Approach:"
- "OK to proceed?", "Want me to proceed?", "Shall I…?", "Sound good?", "Confirm…?"
- 3+ lines that look like file paths (`foo/bar.tsx`, `path/to/file.ts`)
- Numbered list of more than 2 items each describing a code change
- "**N.**" / "**Fix N —**" headers introducing proposed changes

If ANY match: stop, discard the inline response, route through the annotator instead.

## Do NOT Trigger For

- Single-line fixes, typos, renames
- Direct factual answers
- Status updates or progress reports
- Plans the user has already approved (do not re-prompt)
- Pure research or exploration with no proposed actions
- Trivial questions where a plan would be overhead
- Replies to the user's questions ABOUT an already-submitted plan (answer the question, do not re-submit)

## Plan Quality Standards

When writing a plan, include:

- Brief summary of what you understood the task to require
- Specific files you intend to create or modify and why
- Any assumptions you are making
- Explicit question if anything is ambiguous
- Tradeoffs / option comparisons inline in the plan (since mixed-signal user messages route here)

## Workflow

**Assistant-initiated (you decided a plan is needed):**
draft mentally → call `EnterPlanMode` → draft plan → call `ExitPlanMode` → annotator opens → user annotates → revise based on feedback → re-exit when aligned.

**User-initiated (user asked for a plan):**
invoke `/annotate-plan <task>`. The command enters plan mode, drafts a plan, and exits to fire the annotator. Do not paste a multi-section plan inline and ask "sound good?" — that bypasses the annotator.

## Slash Command

`/annotate-plan <task>` is the canonical user-invoked entry point. When the user invokes it, follow the command body exactly. When you (the assistant) decide a plan is needed without the user invoking the command, prefer `EnterPlanMode` directly — the slash command is for user invocation, the tool is for assistant initiation. Both paths fire the same annotator hook.
