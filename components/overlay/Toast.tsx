import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { cn } from '../ui/cn';
import { CheckIcon, BellIcon } from '../ui/icons';

type Tone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

interface ToastApi {
  toast: (t: { title: string; description?: string; tone?: Tone }) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

const toneStyles: Record<Tone, { ring: string; icon: React.ReactNode }> = {
  success: { ring: 'bg-emerald-50 text-emerald-600', icon: <CheckIcon size={17} /> },
  error: { ring: 'bg-red-50 text-red-600', icon: <BellIcon size={17} /> },
  info: { ring: 'bg-oca-tint text-oca', icon: <BellIcon size={17} /> },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const toast = useCallback((t: { title: string; description?: string; tone?: Tone }) => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { id, tone: 'info', ...t }]);
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[120] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-2xl border border-hairline bg-white/90 p-4 shadow-lift backdrop-blur-xl"
            role="status"
          >
            <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl', toneStyles[t.tone].ring)}>
              {toneStyles[t.tone].icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-ink/50">{t.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
