// Просмотр фото на весь экран (PhotoSwipe 5).
// Все ссылки <Photo> внутри контейнера — одна галерея в том порядке, как они стоят на странице:
// обложка, затем фото открытой вкладки. Сам PhotoSwipe (~60 КБ) грузится только при первом открытии.
import { useEffect, type RefObject } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import type PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
import './gallery.css';

/** Подпись: название, страна, автор, лицензия, ссылка на страницу файла на Commons */
function fillCaption(box: HTMLElement, a: HTMLElement | undefined) {
  box.replaceChildren();
  if (!a) return;
  const d = a.dataset;
  const title = document.createElement('strong');
  title.textContent = d.country && d.country !== d.title ? `${d.title} · ${d.country}` : (d.title ?? '');
  const line = document.createElement('span');
  line.textContent = `Фото: ${d.author ?? 'неизвестен'} · ${d.license ?? ''} · `;
  const link = document.createElement('a');
  link.href = d.url ?? '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'страница на Wikimedia Commons';
  line.append(link);
  box.append(title, line);
}

/** `ready` меняется, когда контейнер появился или сменился (например, открыт буклет другой страны) */
export function useGallery(ref: RefObject<HTMLElement>, ready: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lightbox = new PhotoSwipeLightbox({
      gallery: el,
      children: 'a[data-pswp-width]',
      pswpModule: () => import('photoswipe'),
      wheelToZoom: true,
      bgOpacity: 0.94,
      padding: { top: 16, bottom: 84, left: 0, right: 0 },
      showHideAnimationType: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'zoom',
      closeTitle: 'Закрыть (Esc)',
      zoomTitle: 'Увеличить (двойное нажатие)',
      arrowPrevTitle: 'Предыдущее (←)',
      arrowNextTitle: 'Следующее (→)',
      errorMsg: 'Фото не загрузилось',
      indexIndicatorSep: ' из ',
    });
    lightbox.on('uiRegister', () => {
      const pswp = lightbox.pswp as PhotoSwipe;
      pswp.ui?.registerElement({
        name: 'caption',
        appendTo: 'root',
        order: 9,
        isButton: false,
        onInit: (box, p) => {
          box.setAttribute('aria-live', 'polite');
          p.on('change', () => fillCaption(box, p.currSlide?.data.element));
        },
      });
    });
    // пока окно открыто, клавиши — только ему (карта не должна ехать от стрелок)
    lightbox.on('openingAnimationStart', () => document.documentElement.classList.add('pswp-open'));
    lightbox.on('destroy', () => document.documentElement.classList.remove('pswp-open'));
    lightbox.init();
    return () => lightbox.destroy();
  }, [ref, ready]);
}
