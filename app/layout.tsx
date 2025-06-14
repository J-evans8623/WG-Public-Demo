// /app/layout.tsx
import React from 'react';
import '@/app/globals.css';
import Head from 'next/head';
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/slideshow.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <Head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf_viewer.min.css"
        />
      </Head>
      <body className="h-screen w-screen overflow-x-hidden bg-[#F9FBFD]">
        {children}
      </body>
    </html>
  );
}
