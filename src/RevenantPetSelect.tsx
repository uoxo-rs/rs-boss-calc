import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { revenantPets } from "./revenants";

type Props = {
  value: number;
  onChange: (value: number) => void;
};

export default function RevenantPetSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const [above, setAbove] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef({ text: "", time: 0 });
  const last = revenantPets.length - 1;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (!open || !list.current) return;
    const option = list.current.children[active] as HTMLElement;
    // Scroll only the options, keeping the surrounding page still.
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.current.scrollTop) list.current.scrollTop = top;
    else if (bottom > list.current.scrollTop + list.current.clientHeight) {
      list.current.scrollTop = bottom - list.current.clientHeight;
    }
  }, [open, active]);

  function show(index = value) {
    const bounds = trigger.current?.getBoundingClientRect();
    if (bounds) {
      const below = window.innerHeight - bounds.bottom;
      setAbove(below < Math.min(320, window.innerHeight * 0.45) && bounds.top > below);
    }
    setActive(index);
    setOpen(true);
    search.current = { text: "", time: 0 };
  }

  function choose(index: number) {
    onChange(index);
    setOpen(false);
    search.current = { text: "", time: 0 };
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event;
    if (key === "Tab") {
      if (open) choose(active);
      return;
    }
    if (key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (event.ctrlKey || event.metaKey) return;
    if (key === "Enter" || (key === " " && (!open || !search.current.text || Date.now() - search.current.time >= 700))) {
      event.preventDefault();
      if (open) choose(active);
      else show();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(key)) {
      event.preventDefault();
      if (open && event.altKey && key === "ArrowUp") {
        choose(active);
        return;
      }
      const current = open ? active : value;
      const next = key === "Home" ? 0 : key === "End" ? last
        : key === "PageDown" ? current + 10 : key === "PageUp" ? current - 10
          : open ? current + (key === "ArrowDown" ? 1 : -1) : current;
      if (open) setActive(Math.max(0, Math.min(last, next)));
      else show(Math.max(0, Math.min(last, next)));
      search.current = { text: "", time: 0 };
      return;
    }
    if (key.length === 1 && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const typed = (now - search.current.time < 700 ? search.current.text : "") + key.toLowerCase();
      const prefix = [...typed].every(character => character === typed[0]) ? typed[0] : typed;
      const start = open ? active : value;
      const indices = Array.from({ length: revenantPets.length }, (_, offset) =>
        (start + offset + (prefix.length === 1 ? 1 : 0)) % revenantPets.length,
      );
      const match = indices.find(index => revenantPets[index].toLowerCase().startsWith(prefix));
      if (!open) show(match ?? value);
      else if (match !== undefined) setActive(match);
      search.current = { text: typed, time: now };
    }
  }

  return (
    <div className="pet-dropdown" ref={container}>
      <button
        ref={trigger}
        type="button"
        id="revenant-pet"
        className="pet-trigger"
        role="combobox"
        aria-labelledby="revenant-pet-label revenant-pet-value"
        aria-describedby="revenant-pet-help"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="revenant-pet-options"
        aria-activedescendant={open ? `revenant-pet-option-${active}` : undefined}
        onClick={() => open ? setOpen(false) : show()}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      >
        <span className="pet-value" id="revenant-pet-value">
          <span>{revenantPets[value]}</span>
          <span className="pet-count">{`${value}/${last}`}</span>
        </span>
        <svg className="pet-chevron" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <ul
        ref={list}
        id="revenant-pet-options"
        className={`pet-options${above ? " pet-options-above" : ""}`}
        role="listbox"
        aria-labelledby="revenant-pet-label"
        hidden={!open}
        onMouseDown={event => event.preventDefault()}
      >
        {revenantPets.map((pet, index) => (
          <li
            key={pet}
            id={`revenant-pet-option-${index}`}
            role="option"
            aria-label={`${pet}, ${index} of ${last} pets unlocked`}
            aria-selected={index === (open ? active : value)}
            className="pet-option"
            onClick={() => {
              choose(index);
              trigger.current?.focus();
            }}
          >
            <span>{pet}</span>
            <span className="pet-count">{`${index}/${last}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
