// Предохранитель: если карта упала (ошибка WebGL, сбой библиотеки), остальной сайт — буклеты, поиск — продолжает работать.
import { Component, type ReactNode } from 'react';
import s from './MapView.module.css';

type State = { error: string | null };

export class MapErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(e: Error): State {
    return { error: e.message };
  }

  componentDidCatch(e: Error) {
    console.error('Карта упала:', e);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={s.map}>
        <div className={s.crash} role="alert">
          <p>Карта не смогла открыться. Буклеты и поиск работают.</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Попробовать ещё раз
          </button>
        </div>
      </div>
    );
  }
}
