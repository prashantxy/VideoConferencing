import React from 'react';
import Link from 'next/link';
import { Heart, Video } from 'lucide-react';

export function AppIcon({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center bg-gradient-to-b from-[#3a3a3d] to-[#0c0c0e] text-[#f5f5f7] shadow-[inset_0_1px_0_rgb(255_255_255/0.22),inset_0_0_0_1px_rgb(255_255_255/0.08),0_8px_24px_-6px_rgb(0_0_0/0.8)]"
      style={{ width: size, height: size, borderRadius: size * 0.2237 }}
    >
      <Video style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={2} fill="currentColor" />
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="pressable inline-flex items-center gap-2.5 rounded-xl">
      <AppIcon size={28} />
      <span className="text-[17px] font-semibold tracking-[-0.01em]">VibeCall</span>
    </Link>
  );
}

/** Full-width translucent navigation bar; content scrolls underneath it. */
export function NavBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-separator bg-canvas/60 backdrop-blur-2xl backdrop-saturate-150">
      <nav className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-5">
        <Logo />
        <div className="flex items-center gap-2">{children}</div>
      </nav>
    </header>
  );
}

/** Eyebrow + headline + intro: the opening of every page section. */
export function SectionHeader({
  eyebrow, title, intro, align = 'center', as: Heading = 'h2',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: 'center' | 'left';
  as?: 'h1' | 'h2';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Heading className="large-title text-silver mt-3 text-[clamp(2rem,4.5vw,3rem)]">{title}</Heading>
      {intro && <p className="mt-4 text-pretty text-[17px] leading-relaxed text-label-2">{intro}</p>}
    </div>
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
  filled: 'bg-accent text-on-accent hover:bg-white',
  gray: 'bg-fill text-label hover:bg-fill-hover',
  glass: 'glass-chip text-label hover:bg-fill-hover',
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

// Titanium finishes: natural, blue, desert, black. Distinct, but never loud.
const avatarFinishes = [
  'from-[#9a958e] to-[#4d4a46]',
  'from-[#6f7a8c] to-[#2f3640]',
  'from-[#a8927b] to-[#54473a]',
  'from-[#5c5c61] to-[#232326]',
];

/** Contact-style monogram with a stable finish per name. */
export function Avatar({ name, size = 40, className = '' }: { name: string; size?: number; className?: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] ${avatarFinishes[hash % avatarFinishes.length]} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

/** Monochrome glass tile holding a glyph. */
export function IconTile({ icon: Icon, className = '' }: { icon: React.ElementType; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-fill text-label shadow-[inset_0_1px_0_rgb(255_255_255/0.12),inset_0_0_0_1px_rgb(255_255_255/0.06)] ${className}`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}

// Donation page (Buy Me a Coffee, Ko-fi, GitHub Sponsors, ...). Nothing renders when unset.
export const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL || '';

/** Opens the donation page in a new tab; hidden when NEXT_PUBLIC_SUPPORT_URL is unset. */
export function SupportButton({ className = '' }: { className?: string }) {
  if (!SUPPORT_URL) return null;
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Support VibeCall"
      className={`pressable inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3 text-[15px] font-semibold text-label hover:bg-fill-hover sm:px-4 ${className}`}
    >
      <Heart className="h-4 w-4 text-red" fill="currentColor" />
      <span className="hidden sm:inline">Support</span>
    </a>
  );
}
