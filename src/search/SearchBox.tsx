// Поле поиска в шапке (клавиша F): подсказки по группам, стрелки ↑ ↓, Enter — открыть, Esc — закрыть.
// Устроено как «поле со списком» (**combobox**): экранный диктор читает выбранную подсказку.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { countryItems, KIND_ICON, loadSearchItems, search, type SearchItem } from './searchIndex';
import { openItem } from './openItem';
import s from './SearchBox.module.css';

export function SearchBox() {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // пока не догрузились города, места и история — ищем по странам
  const [items, setItems] = useState<SearchItem[]>(countryItems);
  const [failed, setFailed] = useState(false);

  const warmUp = () => {
    loadSearchItems()
      .then(setItems)
      .catch(() => setFailed(true));
  };

  const groups = useMemo(() => search(items, q), [items, q]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  useEffect(() => setActive(0), [q]);

  const choose = (item: SearchItem | undefined) => {
    if (!item) return;
    void openItem(item);
    setQ('');
    setOpen(false);
    input.current?.blur();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!flat.length) return;
      e.preventDefault();
      setOpen(true);
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + d + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(flat[active]);
    } else if (e.key === 'Escape') {
      if (open && q) setOpen(false);
      else {
        setQ('');
        input.current?.blur();
      }
    }
  };

  // выбранная стрелками подсказка не уходит за край списка
  useEffect(() => {
    document.getElementById(`${id}-o${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, id]);

  const shown = open && q.trim().length > 0;
  let n = -1;
  return (
    <div className={s.box} role="search">
      <input
        ref={input}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          warmUp();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
        placeholder="Страна, город, место, история…"
        aria-label="Поиск: страны, города, природа, исторические государства. Клавиша F"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown && flat.length > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={shown && flat.length ? `${id}-o${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      <kbd className={s.key} aria-hidden="true">F</kbd>
      {shown ? (
        // mousedown не забирает фокус у поля — иначе список закроется раньше нажатия
        <div className={s.pop} onMouseDown={(e) => e.preventDefault()}>
          <div id={`${id}-list`} role="listbox" aria-label="Подсказки">
            {groups.map((g) => (
              <div key={g.id} role="group" aria-labelledby={`${id}-g-${g.id}`} className={s.group}>
                <div id={`${id}-g-${g.id}`} className={s.groupTitle} role="presentation">
                  <span aria-hidden="true">{g.icon}</span> {g.title}
                </div>
                {g.items.map((it) => {
                  n++;
                  const i = n;
                  return (
                    <div
                      key={it.key}
                      id={`${id}-o${i}`}
                      role="option"
                      aria-selected={i === active}
                      className={s.option}
                      onMouseMove={() => setActive(i)}
                      onClick={() => choose(it)}
                    >
                      <span className={s.icon} aria-hidden="true">{KIND_ICON[it.kind]}</span>
                      <span className={s.text}>
                        <span className={s.title}>{it.title}</span>
                        {it.sub ? <span className={s.sub}>{it.sub}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {!flat.length ? (
            <p className={s.empty} role="status">
              {failed ? 'Не загрузился список городов и мест — ищу только по странам.' : 'Ничего не нашлось. Попробуйте другое написание.'}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
