import { useEffect, useRef, useState } from 'react';
import { cn } from '../ui/cn';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** delay in ms for staggered entrances */
  delay?: number;
  /** vertical travel in px */
  y?: number;
  as?: 'div' | 'section' | 'li' | 'span';
}

/**
 * Scroll-reveal wrapper — fades + lifts content into view once,
 * using IntersectionObserver (no dependency). Honours reduced-motion
 * via the global CSS rule that neutralises transitions.
 */
export function Reveal({ children, className, delay = 0, y = 20, as = 'div' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as any;
  return (
    <Tag
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
      }}
      className={cn(
        'transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        shown ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      {children}
    </Tag>
  );
}
