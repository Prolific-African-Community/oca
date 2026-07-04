import { useEffect } from 'react';
import { cn } from '../ui/cn';
import { PlusIcon } from '../ui/icons';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Right-side slide-over. Replaces full-page CRUD forms. Locks body scroll,
 * closes on Escape / backdrop click. Kept mounted for smooth transitions.
 */
export function Drawer({ open, onClose, title, description, icon, children, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div className={cn('fixed inset-0 z-[100]', open ? '' : 'pointer-events-none')} aria-hidden={!open}>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-ink/25 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
      />
      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-hairline bg-page shadow-lift transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-oca-tint text-oca">{icon}</span>
            )}
            <div>
              <h2 className="text-lg font-medium tracking-tightest text-ink">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-ink/50">{description}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/45 transition-colors hover:bg-cloud hover:text-ink"
          >
            <PlusIcon size={20} className="rotate-45" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer && <div className="border-t border-hairline bg-white/60 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
