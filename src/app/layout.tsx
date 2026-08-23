import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mega Miya - AI Code Review Tool',
  description: 'AI-powered GitHub code review tool that provides intelligent feedback on pull requests',
  keywords: ['code review', 'AI', 'GitHub', 'pull request', 'software development'],
  authors: [{ name: 'Ismoil', url: 'https://github.com/ismoil793' }],
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
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  );
}
