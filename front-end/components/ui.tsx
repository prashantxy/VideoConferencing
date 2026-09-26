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

export const GITHUB_URL = 'https://github.com/prashantxy/VibeCall';
export const X_URL = 'https://x.com/pdubey1924';

// Brand marks as inline SVG (lucide has no X logo, and its GitHub icon is deprecated).
function GitHubMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.82 1.19 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function XMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}

/** Icon links to the source code and the maker's X profile. */
export function SocialLinks({ className = '' }: { className?: string }) {
  const links = [
    { href: GITHUB_URL, label: 'VibeCall on GitHub', Icon: GitHubMark },
    { href: X_URL, label: 'Prashant on X', Icon: XMark },
  ];
  return (
    <div className={`flex items-center ${className}`}>
      {links.map(({ href, label, Icon }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="pressable flex h-9 w-9 items-center justify-center rounded-full text-label-2 hover:bg-fill hover:text-label"
        >
          <Icon className="h-[18px] w-[18px]" />
        </a>
      ))}
    </div>
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

// Donation page; NEXT_PUBLIC_SUPPORT_URL overrides it.
export const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL || 'https://buymeacoffee.com/moralizer_19';

/** Opens the donation page in a new tab. */
export function SupportButton({ className = '' }: { className?: string }) {
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
