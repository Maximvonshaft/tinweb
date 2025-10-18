import { forwardRef } from 'react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-transform duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--accent)] text-white hover:brightness-110',
  outline: 'border border-[var(--line)] bg-transparent text-[var(--fg)] hover:bg-[var(--hover)]',
  ghost: 'bg-transparent text-[var(--fg-2)] hover:bg-[var(--hover)]',
  danger: 'bg-[var(--danger)] text-white hover:brightness-110',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', ...props },
  ref,
) {
  return <button ref={ref} className={clsx(baseClasses, variantClasses[variant], className)} {...props} />;
});
