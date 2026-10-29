// Викторина: 5 или 10 вопросов четырёх видов, счёт в конце. Карта участвует: показывает ответ,
// а в вопросе «Найди на карте» ответом служит нажатие на страну.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { loadPoints } from '../map/data';
import { PHONE } from '../app/useMedia';
import { KIND_TITLE, makeQuiz, type Question } from './questions';
import s from './Quiz.module.css';

type Answer = { chosen: string; right: boolean };

/** Рамка страны для перелёта; страна через линию перемены дат — окрестность значка */
async function countryBox(iso: string): Promise<[number, number, number, number] | null> {
  const p = (await loadPoints()).features.find((f) => f.properties.iso === iso);
  if (!p) return null;
  const [w, so, e, n] = p.properties.bbox;
  if (e < w || e - w > 200) {
    const [x, y] = p.geometry.coordinates;
    return [x - 30, y - 15, x + 30, y + 15];
  }
  return [w, so, e, n];
}

function verdict(score: number, n: number): string {
  const r = score / n;
  if (r === 1) return 'Без единой ошибки — настоящий географ!';
  if (r >= 0.7) return 'Отличный результат.';
  if (r >= 0.4) return 'Неплохо. Загляните в буклеты стран, где ошиблись.';
  return 'Есть куда расти — попробуйте ещё раз.';
}

export function Quiz() {
  const [phase, setPhase] = useState<'setup' | 'loading' | 'play' | 'done' | 'error'>('setup');
  const [qs, setQs] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const next = useRef<HTMLButtonElement>(null);
  const q = qs[i];
  const answered = answers.length > i;

  const start = (n: number) => {
    setPhase('loading');
    makeQuiz(n).then(
      (list) => {
        setQs(list);
        setI(0);
        setAnswers([]);
        setPhase('play');
      },
      () => setPhase('error'),
    );
  };

  const answer = (chosen: string) => {
    if (!q || answered) return;
    // двойное нажатие на карту не засчитывает второй ответ
    setAnswers((a) => (a.length > i ? a : [...a, { chosen, right: chosen === q.answer }]));
  };

  // после ответа: обводим верную страну (и ошибочно выбранную) и летим к ней
  useEffect(() => {
    const st = useStore.getState();
    if (phase !== 'play' || !q) return;
    if (!answered) {
      st.setHighlight(q.kind === 'history' ? [q.iso] : []);
      if (q.kind === 'history') void countryBox(q.iso).then((b) => b && st.setFlyTo({ bbox: b, zoom: 4 }));
      return;
    }
    const a = answers[i];
    st.setHighlight(q.kind === 'find' && !a.right ? [q.iso, a.chosen] : [q.iso]);
    void countryBox(q.iso).then((b) => b && st.setFlyTo({ bbox: b, zoom: 4.5 }));
    if (matchMedia(PHONE).matches) st.setSheet('half');
    next.current?.focus();
  }, [phase, q, answered, answers, i]);

  // «Найди на карте»: нажатие на карту — ответ; на телефоне опускаем панель, чтобы карта была видна
  useEffect(() => {
    const st = useStore.getState();
    if (phase !== 'play' || q?.kind !== 'find' || answered) return;
    st.setMapPick({ prompt: q.prompt, onPick: (iso) => answer(iso) });
    if (matchMedia(PHONE).matches) st.setSheet('collapsed');
    return () => useStore.getState().setMapPick(null);
    // answer меняется каждый рендер, но читает свежие q и answered через замыкание этого же рендера
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q, answered]);

  // уходя из викторины, возвращаем карту в обычный вид
  useEffect(
    () => () => {
      useStore.getState().setMapPick(null);
      useStore.getState().setHighlight([]);
    },
    [],
  );

  const score = answers.filter((a) => a.right).length;

  if (phase === 'setup' || phase === 'error' || phase === 'loading') {
    return (
      <div className={s.quiz}>
        <h2 className={s.h}>Викторина</h2>
        <p>Четыре вида вопросов: страна по контуру, чья это была земля в прошлом, чем знаменита страна и «найди на карте».</p>
        {phase === 'error' ? <p className={s.bad}>Не получилось составить вопросы — проверьте интернет и попробуйте ещё раз.</p> : null}
        <div className={s.row}>
          <button type="button" className={s.primary} disabled={phase === 'loading'} onClick={() => start(5)}>
            5 вопросов
          </button>
          <button type="button" className={s.primary} disabled={phase === 'loading'} onClick={() => start(10)}>
            10 вопросов
          </button>
        </div>
        {phase === 'loading' ? <p className={s.muted} aria-busy="true">Составляю вопросы…</p> : null}
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className={s.quiz}>
        <h2 className={s.h}>Счёт: {score} из {qs.length}</h2>
        <p>{verdict(score, qs.length)}</p>
        <ol className={s.review}>
          {qs.map((x, k) => (
            <li key={k} className={answers[k]?.right ? s.okLine : s.badLine}>
              <span aria-hidden="true">{answers[k]?.right ? '✓' : '✗'}</span>
              <span>
                <b>{KIND_TITLE[x.kind]}.</b> {x.explain}{' '}
                <a href={`#/country/${x.iso}`}>Буклет страны</a>
              </span>
            </li>
          ))}
        </ol>
        <div className={s.row}>
          <button type="button" className={s.primary} onClick={() => start(qs.length)}>
            Ещё раз
          </button>
          <button type="button" onClick={() => setPhase('setup')}>
            Выбрать число вопросов
          </button>
        </div>
      </div>
    );
  }

  const a = answers[i];
  return (
    <div className={s.quiz}>
      <div className={s.top}>
        <span className={s.kind}>{KIND_TITLE[q.kind]}</span>
        <span className={s.muted}>
          Вопрос {i + 1} из {qs.length} · счёт {score}
        </span>
      </div>
      <div className={s.dots} aria-hidden="true">
        {qs.map((_, k) => (
          <i key={k} className={k < answers.length ? (answers[k].right ? s.dotOk : s.dotBad) : k === i ? s.dotNow : undefined} />
        ))}
      </div>
      <h2 className={s.q}>{q.prompt}</h2>
      {q.path ? (
        <svg className={s.outline} viewBox="0 0 240 180" role="img" aria-label="Контур страны">
          <path d={q.path} />
        </svg>
      ) : null}
      {q.kind === 'find' && !answered ? <p className={s.muted}>Нажмите на страну на карте. Названия на время вопроса скрыты.</p> : null}
      {q.choices.length ? (
        <div className={s.choices}>
          {q.choices.map((c) => {
            const state = !answered ? '' : c.id === q.answer ? s.right : c.id === a.chosen ? s.wrong : s.dim;
            return (
              <button key={c.id} type="button" className={`${s.choice} ${state}`} disabled={answered} onClick={() => answer(c.id)}>
                {c.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {answered ? (
        <div className={`${s.feedback} ${a.right ? s.okBox : s.badBox}`} role="status">
          <b>{a.right ? 'Верно!' : 'Не угадали.'}</b> {q.explain}
        </div>
      ) : null}
      {answered ? (
        <button
          ref={next}
          type="button"
          className={s.primary}
          onClick={() => {
            if (i + 1 < qs.length) setI(i + 1);
            else setPhase('done');
          }}
        >
          {i + 1 < qs.length ? 'Дальше →' : 'Узнать счёт'}
        </button>
      ) : null}
    </div>
  );
}
