import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mega-Miya — Open-source AI code review',
    short_name: 'Mega-Miya',
    description: 'Context-aware, self-hosted AI code review for GitHub pull requests.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7faf8',
    theme_color: '#168447',
    icons: [
      { src: '/favicon/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/favicon/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
