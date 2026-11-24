import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cloud Cargo — Warehouse Materials Management',
  description:
    'Compact multi-user warehouse materials management with unique section and tracking codes and real-time inventory updates.',
  openGraph: {
    title: 'Cloud Cargo — Warehouse Materials Management',
    description:
      'Compact multi-user warehouse materials management with unique section and tracking codes and real-time inventory updates.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cloud Cargo — Warehouse Materials Management',
    description:
      'Compact multi-user warehouse materials management with unique section and tracking codes and real-time inventory updates.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body
        suppressHydrationWarning
        className="bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900"
      >
        {children}
      </body>
    </html>
  );
}
