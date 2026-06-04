import { ReactNode } from 'react';

type Tone = 'rose' | 'blue' | 'green' | 'gold' | 'neutral';

type WatercolorScreenProps = {
  eyebrow: string;
  title: string;
  caption?: string;
  tone?: Tone;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function WatercolorScreen({ eyebrow, title, caption, tone = 'neutral', aside, children, className = '' }: WatercolorScreenProps) {
  return (
    <section className={`watercolor-screen wc-${tone} ${className}`.trim()}>
      <WatercolorPageHero eyebrow={eyebrow} title={title} caption={caption} aside={aside} />
      <div className="watercolor-content">{children}</div>
    </section>
  );
}

type WatercolorPageHeroProps = {
  eyebrow: string;
  title: string;
  caption?: string;
  aside?: ReactNode;
};

export function WatercolorPageHero({ eyebrow: _eyebrow, title, caption, aside }: WatercolorPageHeroProps) {
  return (
    <article className="watercolor-page-hero">
      <div>
        <h2>{title}</h2>
        {caption && <p>{caption}</p>}
      </div>
      {aside && <div className="watercolor-page-hero-aside">{aside}</div>}
    </article>
  );
}

export function PaperSheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`paper-sheet ${className}`.trim()}>{children}</article>;
}

export function FloatingNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`floating-note ${className}`.trim()}>{children}</article>;
}

export function ActionDock({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`watercolor-action-dock ${className}`.trim()}>{children}</div>;
}
