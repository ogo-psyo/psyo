import type { Metadata, Viewport } from 'next';
import { Nunito, Russo_One } from 'next/font/google';
import './globals.css';
import './refinement.css';
import './pouf.css';

const nunito = Nunito({
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
  variable: '--font-pouf',
});

const russo = Russo_One({
  subsets: ['cyrillic', 'latin'],
  weight: '400',
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
  themeColor: '#f0e9ff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${nunito.variable} ${russo.variable}`}>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        {children}
      </body>
    </html>
  );
}
