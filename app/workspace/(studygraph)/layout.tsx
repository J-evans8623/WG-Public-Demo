// File: app/workspace/layout.tsx
import { ReactNode } from 'react';
import { Metadata } from 'next';

// This metadata applies to ALL pages within /workspace
export const metadata: Metadata = {
  title: {
    // "absolute" ignores the template set in the root layout.
    // The browser tab will simply say "WiseGraph App" (or whatever you prefer)
    absolute: 'WiseGraph.app', 
  },
};

export default function StudygraphLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}