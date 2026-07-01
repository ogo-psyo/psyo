import type { Metadata, Viewport } from 'next';
import './globals.css';

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
  themeColor: '#f7fbf8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        {children}
      </body>
    </html>
  );
}
