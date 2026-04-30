import { useTheme } from "./ThemeProvider.tsx";

export function ShortcutBar() {
  const { dark } = useTheme();
  const barClass = dark
    ? "bg-paper-edge/95 text-ink-secondary shadow-[0_10px_32px_oklch(0_0_0/0.4),inset_0_1px_0_oklch(1_0_0/0.05)]"
    : "bg-[oklch(0.18_0.005_260/0.92)] text-white/75 shadow-[0_10px_32px_oklch(0_0_0/0.35),inset_0_1px_0_oklch(1_0_0/0.06)]";
  const promptClass = dark ? "text-ink" : "text-white";
  return (
    <div
      className={`fixed bottom-5 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-4 rounded-full px-4 py-2 text-[12.5px] backdrop-blur-xl md:flex ${barClass}`}
    >
      <span className={promptClass}>Select any text to annotate</span>
      <Shortcut label="delete" keys={["D"]} dark={dark} />
      <Shortcut label="replace" keys={["R"]} dark={dark} />
      <Shortcut label="insert" keys={["N"]} dark={dark} />
      <Shortcut label="comment" keys={["C"]} dark={dark} />
    </div>
  );
}

function Shortcut({ label, keys, dark }: { label: string; keys: string[]; dark: boolean }) {
  const kbdClass = dark
    ? "shortcut-key"
    : "shortcut-key !bg-white/10 !text-white shadow-[inset_0_-1px_0_oklch(0_0_0/0.3),inset_0_1px_0_oklch(1_0_0/0.08)]";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {keys.map((key) => (
        <kbd key={key} className={kbdClass}>
          {key}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}
