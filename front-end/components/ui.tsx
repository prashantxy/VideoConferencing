import React from 'react';
import Link from 'next/link';
import { Video } from 'lucide-react';

export function AppIcon({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center bg-gradient-to-b from-[#5ac8fa] to-[#0a64f0] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_4px_12px_-2px_rgb(10_100_240/0.45)]"
      style={{ width: size, height: size, borderRadius: size * 0.2237 }}
    >
      <Video style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} fill="currentColor" />
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="pressable inline-flex items-center gap-2.5 rounded-xl">
      <AppIcon size={28} />
      <span className="text-[17px] font-semibold tracking-[-0.01em]">VideoMeet</span>
    </Link>
  );
}

/** Floating translucent navigation bar; content scrolls underneath it. */
export function NavBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-3 z-30 mx-auto w-full max-w-6xl px-4">
      <nav className="glass flex h-14 items-center justify-between rounded-full ps-4 pe-2">
        <Logo />
        <div className="flex items-center gap-2">{children}</div>
      </nav>
    </header>
  );
}

export function OnlinePill({ count, className = '' }: { count: number | null; className?: string }) {
  return (
    <span className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full bg-fill px-3 text-[13px] font-medium text-label-2 ${className}`}>
      <span className="live-dot h-2 w-2 rounded-full bg-green" aria-hidden="true" />
      <span className="tabular">{count === null ? 'Connecting…' : `${count} online`}</span>
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'filled' | 'gray' | 'glass' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
};

const buttonVariants = {
  filled: 'bg-tint text-white hover:brightness-110',
  gray: 'bg-fill text-label hover:bg-fill-hover',
  glass: 'glass-chip text-label hover:brightness-125',
  destructive: 'bg-red text-white hover:brightness-110',
};
const buttonSizes = {
  sm: 'h-9 px-4 text-[15px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-[52px] px-7 text-[17px]',
};

export function Button({ variant = 'filled', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  );
}

/** iOS inset-grouped container: rows separated by hairlines. */
export function Group({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`divide-y divide-separator overflow-hidden rounded-[14px] bg-field ${className}`}>{children}</div>
  );
}

export function FieldRow({
  label,
  trailing,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; trailing?: React.ReactNode }) {
  return (
    <label className="flex min-h-12 items-center gap-3 ps-4 pe-2">
      <span className="w-24 shrink-0 text-[15px] text-label">{label}</span>
      <input
        className="h-12 min-w-0 flex-1 bg-transparent text-base text-label placeholder:text-label-3 focus:outline-none sm:text-[15px]"
        {...props}
      />
      {trailing}
    </label>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

const avatarGradients = [
  'from-[#ff9f0a] to-[#ff375f]',
  'from-[#64d2ff] to-[#0a84ff]',
  'from-[#30d158] to-[#0c9f6f]',
  'from-[#bf5af2] to-[#5e5ce6]',
  'from-[#ffd60a] to-[#ff9f0a]',
  'from-[#ff6482] to-[#bf5af2]',
];

/** Contact-style monogram with a stable gradient per name. */
export function Avatar({ name, size = 40, className = '' }: { name: string; size?: number; className?: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b font-semibold text-white ${avatarGradients[hash % avatarGradients.length]} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

/** Settings-style colored squircle holding a glyph. */
export function IconTile({ icon: Icon, className }: { icon: React.ElementType; className: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-white ${className}`}>
      <Icon className="h-5 w-5" strokeWidth={2} />
    </span>
  );
}
