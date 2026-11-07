import type { Metadata, Viewport } from 'next';
import { googleFontsUrls } from '@surface-studio/engine';
import '@surface-studio/studio/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Surface Studio',
  description: 'Turn short writing into images of words written, painted and printed on real surfaces.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

const UI_FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,650&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {[UI_FONTS, ...googleFontsUrls()].map((href) => <link key={href} rel="stylesheet" href={href} />)}
      </head>
      <body>{children}</body>
    </html>
  );
}
