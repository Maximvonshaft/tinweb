import { forwardRef } from 'react';
import { clsx } from 'clsx';

const baseClasses =
  'w-full border-b border-[var(--line)] bg-transparent px-0 py-2 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--accent)] focus:shadow-[0_1px_0_var(--accent)] placeholder:text-[var(--fg-2)] disabled:cursor-not-allowed disabled:opacity-60';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={clsx(baseClasses, className)} {...props} />;
});
