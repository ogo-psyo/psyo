import type { Metadata, Viewport } from 'next';
import { Manrope, Unbounded } from 'next/font/google';
import { ReleaseFreshnessGuard } from '@/components/ReleaseFreshnessGuard';
import './globals.css';
import './refinement.css';
import './pouf.css';
import './editorial.css';
import './atmosphere-v4.css';

const manrope = Manrope({
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
  variable: '--font-pouf',
});

const unbounded = Unbounded({
  subsets: ['cyrillic', 'latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-display-cyrillic',
});

export const metadata: Metadata = {
  title: 'Псё — ассистент владельца собаки',
  description: 'План ухода, напоминания и короткая памятка для людей рядом с собакой.',
  applicationName: 'Псё',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Псё', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/icons/pso-icon.svg', type: 'image/svg+xml' },
      { url: '/icons/pso-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/pso-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Псё — ассистент владельца собаки',
    description: 'План ухода, напоминания и короткая памятка для людей рядом с собакой.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3f7f2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${manrope.variable} ${unbounded.variable}`}>
        <span hidden aria-hidden="true" data-psyo-design-contract="living-field-guide-2026-08" />
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        <ReleaseFreshnessGuard />
        {children}
      </body>
    </html>
  );
}
