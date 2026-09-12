import Link from 'next/link';
import Image from 'next/image';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang=" en\ className=\scroll-smooth\>
 <body className=\antialiased font-sans text-slate-900 bg-white min-h-screen selection:bg-blue-600 selection:text-white\>
 {children}
 </body>
 </html>
 );
}
