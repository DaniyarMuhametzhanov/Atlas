import type { PhotoSource } from '../../content/schema';
import { photoFull, photoSrcset } from '../../content';
import s from './Photo.module.css';

type Props = {
  p: PhotoSource;
  alt: string;
  /** подсказка браузеру, какой ширины будет картинка (атрибут sizes) */
  sizes: string;
  /** страна для подписи на весь экран */
  country?: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  className?: string;
};

/**
 * Фото, которое открывается на весь экран (PhotoSwipe, см. useGallery).
 * Ссылка ведёт на самый большой файл — без JavaScript она просто откроет его.
 * Все такие ссылки внутри одного контейнера — одна галерея.
 */
export function Photo({ p, alt, sizes, country, width, height, lazy = true, className }: Props) {
  const full = photoFull(p);
  const small = Math.min(...Object.keys(p.files).map(Number));
  return (
    <a
      className={`${s.photo} ${className ?? ''}`}
      href={full.src}
      data-pswp-width={full.w}
      data-pswp-height={full.h}
      data-title={alt}
      data-country={country}
      data-author={p.author}
      data-license={p.license}
      data-url={p.url}
      aria-label={`${alt} — открыть на весь экран`}
    >
      <picture>
        {p.avif ? <source type="image/avif" srcSet={photoSrcset(p.avif)} sizes={sizes} /> : null}
        <img
          src={import.meta.env.BASE_URL + p.files[String(small)]}
          srcSet={photoSrcset(p.files)}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={lazy ? 'lazy' : undefined}
          decoding="async"
        />
      </picture>
    </a>
  );
}
