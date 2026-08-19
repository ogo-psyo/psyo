import { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Surface } from '@/components/ui/Surface';

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
      <span className={`ui-decorative-bloom ui-decorative-bloom-${tone}`} aria-hidden="true" />
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
  return <PageHeader className="watercolor-page-hero" title={title} description={caption} aside={aside} />;
}

export function PaperSheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Surface variant="raised" className={`paper-sheet ${className}`.trim()}>{children}</Surface>;
}

export function FloatingNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Surface variant="fancy" className={`floating-note ${className}`.trim()}>{children}</Surface>;
}

export function ActionDock({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`watercolor-action-dock ${className}`.trim()}>{children}</div>;
}
