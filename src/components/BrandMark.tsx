import type { ImgHTMLAttributes } from 'react';

type BrandMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

/** The shared GENR8 brand mark used across product identity surfaces. */
export function BrandMark({ className = '', alt = 'GENR8', ...props }: BrandMarkProps) {
  return (
    <img
      src="/brand/g3d-mark-512.png"
      alt={alt}
      className={`shrink-0 rounded-[26%] bg-[#1b1a1a] object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/15 ${className}`}
      draggable={false}
      {...props}
    />
  );
}
