import { useEffect, useRef, useState } from "react";
import { bosses } from "./data";
import { matchesBossSearch } from "./boss-search";

const options = bosses.map((boss, index) => ({ name: boss.name, index }))
  .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

export default function BossSelect({ value, onChange }: {
  value: number;
  onChange: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const matches = options.filter(({ name }) => matchesBossSearch(name, query));

  useEffect(() => {
    if (!open) return;
    const option = list.current?.children[active] as HTMLElement | undefined;
    if (!option || !list.current) return;
    const bottom = option.offsetTop + option.offsetHeight;
    if (option.offsetTop < list.current.scrollTop) list.current.scrollTop = option.offsetTop;
    else if (bottom > list.current.scrollTop + list.current.clientHeight) {
      list.current.scrollTop = bottom - list.current.clientHeight;
    }
  }, [open, active, query]);

  function show() {
    setActive(Math.max(0, matches.findIndex(option => option.index === value)));
    setOpen(true);
  }

  function choose(index: number) {
    onChange(index);
    setOpen(false);
  }

  return (
    <div className="pet-dropdown boss-dropdown">
      <input
        ref={input}
        id="boss"
        role="combobox"
        autoComplete="off"
        placeholder="Select or search bosses…"
        value={open ? query : bosses[value]?.name ?? ""}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="boss-options"
        aria-activedescendant={open && matches[active] ? `boss-option-${matches[active].index}` : undefined}
        onFocus={show}
        onClick={() => { if (!open) show(); }}
        onBlur={() => setOpen(false)}
        onChange={event => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
            else setActive(previous => Math.max(0, Math.min(matches.length - 1, previous + (event.key === "ArrowDown" ? 1 : -1))));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (open && matches[active]) choose(matches[active].index);
            else if (!open) show();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      />
      <button type="button" className="boss-dropdown-toggle" aria-label={open ? "Close boss list" : "Open boss list"}
        tabIndex={-1} onMouseDown={event => event.preventDefault()}
        onClick={() => {
          if (open) setOpen(false);
          else { input.current?.focus(); show(); }
        }}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <ul ref={list} id="boss-options" className="pet-options" role="listbox" aria-label="Bosses" hidden={!open}
        onMouseDown={event => event.preventDefault()}>
        {matches.map(({ name, index }, position) => (
          <li id={`boss-option-${index}`} key={index} role="option" aria-selected={index === value}
            className={`pet-option${position === active ? " boss-option-active" : ""}`}
            onClick={() => choose(index)}>{name}</li>
        ))}
        {matches.length === 0 && <li className="boss-no-matches" role="presentation">No matching bosses</li>}
      </ul>
      <span className="route-sr-only" role="status">{open ? `${matches.length} matching options` : ""}</span>
    </div>
  );
}
