import type { Metadata } from 'next';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './globals.css';

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
    <html lang="en">
      <body
        suppressHydrationWarning
        className="bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900"
      >
        {children}
      </body>
    </html>
  );
}
