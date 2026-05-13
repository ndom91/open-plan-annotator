#!/usr/bin/env node
// SessionStart hook: inject non-negotiable plan-routing instructions into
// Claude's session context. Returns a JSON `hookSpecificOutput.additionalContext`
// payload that Claude Code reads and injects into the session prompt.
//
// Why this is a hook and not a skill: skills are advisory and load lazily —
// Claude judges relevance from frontmatter and can rationalize past it,
// resulting in inline plans that bypass the annotator. Hook-injected context
// is unconditional and always present, matching the binary nature of the
// "always route plans through annotator" requirement.

const additionalContext = `[open-plan-annotator] This session has the open-plan-annotator plugin installed.

HARD RULE — any response that would contain ANY of the following MUST be routed through EnterPlanMode → ExitPlanMode (which fires the annotator UI):
  • a multi-step proposal
  • 3 or more file paths to create or modify
  • 2 or more option/tradeoff comparisons for the user to choose between
  • a section header like "Plan:" / "Steps:" / "Approach:" / "Implementation:" / "Concrete changes:"
  • a numbered or bulleted list of action items the user is expected to react to
  • a closing question like "OK to proceed?" / "sound good?" / "shall I…?"

Never paste plans inline. The annotator IS the discussion surface — tradeoffs, options, and open questions belong inside the plan body where the user can comment on each one. Mixed-signal user messages (a directive plus "what do you think?") still route through the annotator; the exploratory clause means "include alternatives in the plan", not "skip the plan".

Workflow:
  • Assistant-initiated (you decided a plan is needed): call EnterPlanMode → draft → ExitPlanMode.
  • User-initiated ("draft a plan", "/plan", etc.): invoke /annotate-plan <task>.

After approval: the approved ExitPlanMode response is the user's go-ahead to implement. Do not ask for another confirmation, do not say "ready when you are", and do not wait. Immediately continue with the approved plan unless the approval response explicitly requests changes or says not to proceed.

Full trigger list and self-check rules in skill plan-review-triggers.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
    },
  }),
);
