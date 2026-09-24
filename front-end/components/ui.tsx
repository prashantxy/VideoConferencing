import React from 'react';
import Link from 'next/link';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="ring absolute inline-flex h-full w-full rounded-full bg-signal" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-signal" />
      </span>
      <span className="font-serif text-2xl leading-none tracking-tight">
        Video<em className="text-signal">Meet</em>
      </span>
    </Link>
  );
}

export function OnlinePill({ count }: { count: number | null }) {
  return (
    <span className="label inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5">
      <span className="blink h-1.5 w-1.5 rounded-full bg-live" />
      {count === null ? 'connecting…' : `${count} online now`}
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-signal text-ink hover:bg-cream',
    ghost: 'border border-line-strong text-cream hover:border-cream',
    danger: 'bg-danger/15 text-danger hover:bg-danger hover:text-ink',
  };
  const sizes = { md: 'h-11 px-5 text-sm', lg: 'h-14 px-8 text-base' };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      <input
        className="h-12 w-full rounded-xl border border-line bg-ink-2 px-4 text-cream placeholder:text-muted/60 transition-colors focus:border-signal focus:outline-none"
        {...props}
      />
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}
