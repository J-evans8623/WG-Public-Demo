// /app/layout.tsx
import React from 'react';
import Head from 'next/head';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import Providers from "./AuthProvider"; 
import '@/app/globals.css';
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/slideshow.css'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="en">
      <Head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf_viewer.min.css"
        />
      </Head>
      <body className="h-screen w-screen overflow-x-hidden bg-[#F9FBFD]">
       <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
