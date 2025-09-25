/***********************************************************************************************
 * @file app/signin/page.tsx
 * @description
 *   Server component for the WiseGraph sign-in page. Styles are provided via a CSS Module so
 *   the page can be rendered on the server without styled-jsx (which is client-only).
 *   A small client child (<SignInClient />) handles NextAuth sign-in and returnTo logic.
 ***********************************************************************************************/

import React from "react";
import { Inter, Crimson_Text } from "next/font/google";
import SignInClient from "./SignInClient";
import styles from "./singnin.module.css";

const inter = Inter({ subsets: ["latin"], weight: ["400"] });
const crimson = Crimson_Text({ subsets: ["latin"], weight: ["400", "600"] });

export const metadata = {
  title: "WiseGraph - Sign in",
  viewport: { width: "device-width", initialScale: 1 },
};

export default function SignInPage() {
  return (
    <div className={styles.pageRoot}>
      <main className={styles.mainContent}>
        <h1 className={`${styles.wordmark} ${crimson.className}`}>WiseGraph</h1>
        <p className={`${styles.subtitle} ${inter.className}`}>Sign in to continue</p>

        {/* Client-only logic for NextAuth sign-in */}
        <SignInClient className={`${styles.googleBtn} ${inter.className}`} />

        <a href="#" className={`${styles.schoolLink} ${inter.className}`} aria-label="Use school email">
          Use school email
        </a>
      </main>

      <footer className={styles.footer}>
        <a href="#" aria-label="Privacy">Privacy</a> · <a href="#" aria-label="Terms">Terms</a>
      </footer>
    </div>
  );
}
