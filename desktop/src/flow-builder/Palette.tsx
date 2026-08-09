import { useMemo, useState } from "react";

const MIME = "application/navbe-step";

interface PaletteProps {
  stepTypes: string[];
  titles?: Record<string, string>;
  onAdd: (stepType: string) => void;
  hidden?: boolean;
}

/** Left rail: search + click/drag catalog step types. */
export default function Palette({ stepTypes, titles = {}, onAdd, hidden }: PaletteProps) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stepTypes;
    return stepTypes.filter((t) => {
      const title = (titles[t] ?? "").toLowerCase();
      return t.toLowerCase().includes(needle) || title.includes(needle);
    });
  }, [stepTypes, titles, q]);

  if (hidden) return null;

  return (
    <aside className="flow-palette">
      <div className="flow-palette__heading">Add a step</div>
      <div className="px-2 pb-2">
        <input
          className="flow-palette__search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search steps…"
        />
      </div>
      <ul className="flow-palette__list">
        {filtered.map((t) => (
          <li key={t}>
            <button
              type="button"
              className="flow-palette__item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(MIME, t);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onAdd(t)}
            >
              <span className="flow-palette__label">{titles[t] ?? humanize(t)}</span>
              <span className="flow-palette__id">{t}</span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="muted text-xs px-2">No matches</li>}
      </ul>
    </aside>
  );
}

/** Turn set_var into "Set var". */
function humanize(stepType: string): string {
  return stepType
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export { MIME as STEP_DRAG_MIME };
