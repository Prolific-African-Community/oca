import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../ui/cn';
import { Kbd } from '../ui/Kbd';
import { SearchIcon, ArrowIcon } from '../ui/icons';

export type CommandGroup = 'Navigation' | 'Actions' | 'Compte';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  group?: CommandGroup;
  icon?: React.ReactNode;
  perform: () => void;
}

interface CommandApi {
  open: boolean;
  setOpen: (v: boolean) => void;
  register: (id: string, cmds: Command[]) => () => void;
  count: number;
}

const CommandContext = createContext<CommandApi>({
  open: false,
  setOpen: () => {},
  register: () => () => {},
  count: 0,
});

export const useCommand = () => useContext(CommandContext);

/** Register contextual commands for the lifetime of a component. */
export function useRegisterCommands(id: string, commands: Command[], deps: unknown[]) {
  const { register } = useCommand();
  useEffect(() => {
    const un = register(id, commands);
    return un;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const GROUP_ORDER: CommandGroup[] = ['Navigation', 'Actions', 'Compte'];

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [registry, setRegistry] = useState<Record<string, Command[]>>({});

  const register = useCallback((id: string, cmds: Command[]) => {
    setRegistry((prev) => ({ ...prev, [id]: cmds }));
    return () =>
      setRegistry((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
  }, []);

  const commands = useMemo(() => Object.values(registry).flat(), [registry]);
  const count = commands.length;

  useEffect(() => {
    if (count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  return (
    <CommandContext.Provider value={{ open, setOpen, register, count }}>
      {children}
      <CommandPalette commands={commands} open={open} onClose={() => setOpen(false)} />
    </CommandContext.Provider>
  );
}

function CommandPalette({
  commands,
  open,
  onClose,
}: {
  commands: Command[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      (c.label + ' ' + (c.keywords ?? '') + ' ' + (c.hint ?? '')).toLowerCase().includes(q)
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map<CommandGroup, Command[]>();
    for (const c of filtered) {
      const g = c.group ?? 'Actions';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [filtered]);

  // flat order matching visual order for keyboard nav
  const flat = useMemo(() => grouped.flatMap((s) => s.items), [grouped]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const run = useCallback(
    (cmd?: Command) => {
      if (!cmd) return;
      onClose();
      // let the palette close before navigating / opening a drawer
      setTimeout(() => cmd.perform(), 10);
    },
    [onClose]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(flat[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let idx = -1;

  return (
    <div
      className={cn('fixed inset-0 z-[130] flex items-start justify-center px-4 pt-[14vh]', open ? '' : 'pointer-events-none')}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cn('absolute inset-0 bg-ink/25 backdrop-blur-sm transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        onKeyDown={onKeyDown}
        className={cn(
          'relative w-full max-w-xl overflow-hidden rounded-2xl border border-hairline bg-white/90 shadow-lift backdrop-blur-2xl transition-all duration-200',
          open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.98] opacity-0'
        )}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4">
          <SearchIcon size={19} className="text-ink/35" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher ou lancer une action…"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink/35 focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {flat.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink/40">Aucun résultat pour « {query} »</p>
          )}
          {grouped.map((section) => (
            <div key={section.group} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink/35">
                {section.group}
              </p>
              {section.items.map((cmd) => {
                idx++;
                const current = idx;
                const isActive = current === active;
                return (
                  <button
                    key={cmd.id}
                    data-index={current}
                    onMouseMove={() => setActive(current)}
                    onClick={() => run(cmd)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      isActive ? 'bg-oca-tint text-oca' : 'text-ink/70'
                    )}
                  >
                    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', isActive ? 'bg-white/70 text-oca' : 'bg-cloud text-ink/50')}>
                      {cmd.icon ?? <ArrowIcon size={16} />}
                    </span>
                    <span className="flex-1 text-[14px] font-medium">{cmd.label}</span>
                    {cmd.hint && <span className="text-xs text-ink/40">{cmd.hint}</span>}
                    {isActive && <ArrowIcon size={15} className="text-oca/60" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-hairline px-4 py-2.5 text-[11px] text-ink/40">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> ouvrir</span>
          <span className="ml-auto flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        </div>
      </div>
    </div>
  );
}
