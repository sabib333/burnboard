export default function manifest() {
  return {
    name: 'BURNBOARD — No AI. Just Humans Roasting Humans',
    short_name: 'BURNBOARD',
    description: 'The brutal, anonymous social media roast platform. 100% human humor.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: '/og-image.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
