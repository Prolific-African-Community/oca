import { useEffect, useRef } from 'react';

/**
 * Subtle pointer parallax. Attach the returned ref to a container;
 * children with `data-depth="N"` translate by N * pointer offset.
 * Depth is a small multiplier (e.g. 6, 14, 22). Disabled for touch /
 * reduced-motion so it never feels gadgety.
 */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;

    let raf = 0;
    const layers = Array.from(
      el.querySelectorAll<HTMLElement>('[data-depth]')
    );

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        layers.forEach((layer) => {
          const depth = Number(layer.dataset.depth || 0);
          layer.style.transform = `translate3d(${(-dx * depth).toFixed(2)}px, ${(-dy * depth).toFixed(2)}px, 0)`;
        });
      });
    };

    const reset = () => {
      cancelAnimationFrame(raf);
      layers.forEach((layer) => (layer.style.transform = 'translate3d(0,0,0)'));
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', reset);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', reset);
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
