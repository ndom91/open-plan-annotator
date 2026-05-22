const REVIEW_COMMAND = 'open-plan-annotator review "/absolute/path/to/plan.md"';

export const AGENT_SETUP_TEXT = `## Open Plan Annotator

Use Open Plan Annotator when the user wants to review a plan, proposal, implementation strategy, migration path, rollout plan, or other approval-oriented plan before code is written.

For agents without a native Open Plan Annotator integration:

1. Write the plan to a Markdown file on disk.
2. Run:

\`\`\`sh
${REVIEW_COMMAND}
\`\`\`

3. Leave the command running until the user approves or requests changes.
4. If the result is approved, proceed with implementation immediately.
5. If changes are requested, revise the plan using the returned feedback and submit the revised Markdown file for review again.

After approval, do not open another plan review unless the user explicitly asks to revise or re-plan.`;
