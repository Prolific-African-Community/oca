import { forwardRef, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';

let idCounter = 0;

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

const fieldBase =
  'w-full rounded-card border border-hairline bg-white px-4 text-[15px] text-ink ' +
  'placeholder:text-ink/35 transition-all duration-200 ' +
  'hover:border-ink/20 focus:border-apple focus:outline-none ' +
  'focus:ring-4 focus:ring-apple/15';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, className, type = 'text', id, ...props }, ref) => {
    const autoId = useRef<string>();
    if (!autoId.current) autoId.current = `oca-input-${++idCounter}`;
    const inputId = id ?? autoId.current;
    const [show, setShow] = useState(false);
    const isPassword = type === 'password';
    const resolvedType = isPassword ? (show ? 'text' : 'password') : type;

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-ink/70">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            className={cn(fieldBase, 'h-12', isPassword && 'pr-12', className)}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink/40 transition-colors hover:text-ink/70"
            >
              {show ? <EyeOff /> : <Eye />}
            </button>
          )}
        </div>
        {hint && <p className="text-sm text-ink/45">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.1 13.1 0 0 1-1.67 2.5M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a9 9 0 0 0 5.4-1.6" />
      <path d="m9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M2 2l20 20" />
    </svg>
  );
}
