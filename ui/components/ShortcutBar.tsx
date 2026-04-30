export function ShortcutBar() {
  return (
    <div className="fixed bottom-5 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-4 rounded-full border border-rule-subtle bg-paper-edge/90 px-4 py-2 text-[11px] text-ink-tertiary shadow-[0_8px_28px_oklch(0_0_0/0.28),inset_0_1px_0_oklch(1_0_0/0.05)] backdrop-blur-xl md:flex">
      <span className="text-ink-secondary">Select any text to annotate</span>
      <Shortcut label="delete" keys={["D"]} />
      <Shortcut label="replace" keys={["R"]} />
      <Shortcut label="insert" keys={["N"]} />
      <Shortcut label="comment" keys={["C"]} />
    </div>
  );
}

function Shortcut({ label, keys }: { label: string; keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {keys.map((key) => (
        <kbd key={key} className="shortcut-key">
          {key}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}
