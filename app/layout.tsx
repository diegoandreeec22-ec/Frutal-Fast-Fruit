import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Frutal Fast Fruit', template: '%s · Frutal Fast Fruit' },
  description: 'Encuestas de satisfacción y alertas para Frutal Fast Fruit',
  icons: { icon: '/assets/images/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#2E7D32',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE">
      <body className="font-sans">{children}</body>
    </html>
  );
}
