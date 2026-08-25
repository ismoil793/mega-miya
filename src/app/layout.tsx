import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const siteUrl = (process.env.NEXTAUTH_URL || 'https://mega-miya.vercel.app').replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Mega-Miya — Open-source AI code review for GitHub',
    template: '%s | Mega-Miya',
  },
  description: 'Self-host a context-aware, open-source AI reviewer for GitHub pull requests. Bring your own OpenAI or Anthropic key and keep control of your infrastructure.',
  applicationName: 'Mega-Miya',
  keywords: ['open source code review', 'AI code review', 'GitHub code review bot', 'self-hosted AI', 'pull request reviewer', 'BYOK AI'],
  authors: [{ name: 'Ismoil', url: 'https://github.com/ismoil793' }],
  creator: 'Ismoil',
  publisher: 'Mega-Miya',
  alternates: { canonical: '/' },
  icons: {
    icon: [
      { url: '/favicon/favicon.ico' },
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Mega-Miya',
    title: 'Mega-Miya — Open-source AI code review for GitHub',
    description: 'Self-host context-aware pull request reviews with your own infrastructure and LLM credentials.',
    images: [{ url: '/favicon/android-chrome-512x512.png', width: 512, height: 512, alt: 'Mega-Miya logo' }],
  },
  twitter: {
    card: 'summary',
    title: 'Mega-Miya — Open-source AI code review for GitHub',
    description: 'Self-host context-aware pull request reviews with your own infrastructure and LLM credentials.',
    images: ['/favicon/android-chrome-512x512.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Mega-Miya',
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Web',
            url: siteUrl,
            description: 'Open-source, context-aware AI code review for GitHub pull requests.',
            codeRepository: 'https://github.com/ismoil793/mega-miya',
            license: 'https://www.gnu.org/licenses/agpl-3.0.html',
            author: { '@type': 'Person', name: 'Ismoil', url: 'https://github.com/ismoil793' },
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', category: 'Self-hosted open-source software' },
          }).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  );
}
