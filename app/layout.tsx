import type { Metadata, Viewport } from 'next';
import { ReleaseFreshnessGuard } from '@/components/ReleaseFreshnessGuard';
import './globals.css';
import './refinement.css';
import './pouf.css';
import './editorial.css';
import './companion.css';

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
  themeColor: '#fdfcf9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="companion-app">
        <span hidden aria-hidden="true" data-psyo-design-contract="journal-v6-20260906" />
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        <ReleaseFreshnessGuard />
        {children}
      </body>
    </html>
  );
}
