export function ShortcutBar() {
  return (
    <div className="font-sans fixed bottom-5 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-3 rounded-md px-3 py-2 text-[12px] backdrop-blur-xl bg-paper border border-rule shadow-[0_4px_16px_rgba(0,0,0,0.18)] text-ink-secondary md:flex">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">Selection</span>
      <div className="w-px h-4 bg-rule" />
      <Shortcut label="delete" keyChar="D" tone="text-redline" />
      <Shortcut label="replace" keyChar="R" tone="text-replace" />
      <Shortcut label="insert" keyChar="S" tone="text-approve" />
      <Shortcut label="comment" keyChar="C" tone="text-margin-note" />
    </div>
  );
}

function Shortcut({ label, keyChar, tone }: { label: string; keyChar: string; tone: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${tone}`}>
      <kbd className="shortcut-key">{keyChar}</kbd>
      <span>{label}</span>
    </span>
  );
}
