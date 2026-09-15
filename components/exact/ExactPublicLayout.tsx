import Link from 'next/link';
import type { ReactNode } from 'react';

/** The same visual primitives on read-only public/support routes; no private navigation or data. */
export function ExactPublicLayout({ children }: { children: ReactNode }) {
  return <main id="pso-exact-interface" className="exact-interface exact-static">
    <header className="exact-header"><Link className="brand" href="/">Псё</Link><Link className="text-button" href="/">В приложение</Link></header>
    <section id="pso-exact-content"><div className="page exact-extension exact-public">{children}</div></section>
  </main>;
}
