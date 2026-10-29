import { COUNTRIES } from '../content';
import { navigate } from '../app/router';
import { useStore, type Theme } from '../store/store';
import { SearchBox } from '../search/SearchBox';
import s from './Header.module.css';

const THEME_NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<Theme, string> = { system: 'Как в системе', light: 'Светлая', dark: 'Тёмная' };
const THEME_ICON: Record<Theme, string> = { system: '🌓', light: '☀️', dark: '🌙' };

export function Header() {
  const theme = useStore((st) => st.theme);
  const setTheme = useStore((st) => st.setTheme);

  const open = (id: string) => navigate({ name: 'country', id });
  const random = () => {
    const pool = COUNTRIES.filter((c) => c.id !== 'ATA' && c.id !== 'ATF');
    open(pool[Math.floor(Math.random() * pool.length)].id);
  };

  return (
    <header className={s.header}>
      <a className={s.logo} href="#/" aria-label="Атлас-путеводитель — на карту мира">
        <span aria-hidden="true">🧭</span>
        <span className={s.logoText}>Атлас</span>
      </a>
      <SearchBox />
      <div className={s.tools}>
        <button type="button" className={s.btn} onClick={random} aria-label="Случайная страна" title="Случайная страна">
          🎲<span className={s.wide}> Случайная</span>
        </button>
        <button
          type="button"
          className={s.btn}
          onClick={() => setTheme(THEME_NEXT[theme])}
          aria-label={`Тема: ${THEME_LABEL[theme]}. Нажмите, чтобы сменить`}
          title={`Тема: ${THEME_LABEL[theme]}`}
        >
          <span aria-hidden="true">{THEME_ICON[theme]}</span>
        </button>
        <a className={s.btn} href="#/sources" title="Источники и лицензии" aria-label="Источники и лицензии">
          ©<span className={s.wide}> Источники</span>
        </a>
      </div>
    </header>
  );
}
