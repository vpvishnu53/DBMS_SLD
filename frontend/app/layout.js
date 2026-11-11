import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'Lumina · Smart Streetlight Management',
  description: 'Smart Streetlight Management System — Next.js + Node.js + Oracle',
};

export const viewport = { themeColor: '#09090b' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
