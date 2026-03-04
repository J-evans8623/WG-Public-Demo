/***************************************************************************************
 * @file SchoolBanner.tsx
 * @description
 * This component is a specialized marketing utility that renders an infinitely 
 * scrolling marquee of institutional logos using the Framer Motion animation 
 * library. It has been specifically engineered to utilize the Next.js Image 
 * optimization framework, which provides critical benefits such as automatic 
 * resizing, lazy loading, and modern image format conversion (like WebP) to 
 * ensure high-speed page loads and optimal Core Web Vitals. The component 
 * addresses trust-building requirements by showcasing a global user base 
 * of prestigious educational institutions. It maintains a seamless visual 
 * loop by doubling the logo dataset and utilizing hardware-accelerated 
 * CSS transforms for the horizontal translation. The design incorporates 
 * responsive height adjustments and interactive CSS filters to ensure 
 * that the banner remains professional and non-intrusive across various 
 * device form factors, ranging from mobile handsets to high-resolution 
 * desktop displays.
 * * Responsibilities:
 * - Render an infinite horizontal scroll of optimized institutional logos.
 * - Leverage Next.js Image component to solve LCP and bandwidth optimization issues.
 * - Manage smooth animation states and hover-based visual feedback.
 * - Provide a robust social proof anchor for the marketing landing page.
 * * @author System
 * @date 2026
 ***************************************************************************************/

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

/**
 * @interface SchoolLogo
 * @description Defines the structured data required for institutional assets.
 */
interface SchoolLogo {
  name: string;
  url: string;
}

/**
 * @constant SCHOOL_LOGOS
 * @description 
 * Centrally managed array of institutional branding assets. These paths 
 * correlate to the public directory and include a variety of file 
 * formats including SVG, PNG, WebP, and JPG for broad compatibility.
 */
const SCHOOL_LOGOS: SchoolLogo[] = [
  { name: 'Western University', url: '/school-logos/d-western-logo.svg' },
  { name: 'UC San Diego', url: '/school-logos/logo_UCSD.png' },
  { name: 'Memorial University', url: '/school-logos/MUN_Logo_Pantone--800--stratum_web_optimized_png--.webp' },
  { name: 'University of Alberta', url: '/school-logos/ua_logo_green_rgb.png' },
  { name: 'University of Toronto', url: '/school-logos/uoft-logo.svg' },
  { name: 'UT Austin', url: '/school-logos/utexas-primary-horizontal-logo.svg' },
  { name: 'York University', url: '/school-logos/yorku-logo.jpg' },
  {name:'U of Brescia (UNIBS)' , url:'/school-logos/logo_2026_www.png'}
];

/**
 * @function SchoolBanner
 * @description
 * Generates an infinitely scrolling trust banner by mapping over a duplicated 
 * logo array. It utilizes Framer Motion to drive a linear translation from 
 * 0% to -50% of the container width, creating a visual reset that is 
 * imperceptible to the user. Each logo is wrapped in a Next.js Image 
 * component, which optimizes the asset delivery based on the viewport size. 
 * The component also implements edge-fading via linear gradients to ensure 
 * the marquee smoothly enters and exits the visible area of the landing page.
 * A lead-in headline is rendered above the marquee to provide narrative context
 * and reinforce the social proof signal of the institutional logos.
 */
const SchoolBanner: React.FC = () => {
  // 1. Step 1: Duplicate the source array to create the infinite scroll anchor point.
  const infiniteLogos = [...SCHOOL_LOGOS, ...SCHOOL_LOGOS];

  return (
    <div className="flex w-full flex-col items-center bg-white py-12 border-y border-gray-100">

      {/* 2. Step 2: Render the lead-in headline to provide social proof context. */}
      <p className="mb-8 text-sm font-medium uppercase tracking-widest text-gray-400">
        Trusted by students at leading universities worldwide
      </p>

      {/* 3. Step 3: Scrolling marquee container with edge-softening gradients. */}
      <div className="relative flex w-full overflow-hidden">

        {/* Gradient overlays for edge softening. */}
        <div className="absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-white to-transparent pointer-events-none" />

        {/* 4. Step 4: Configure the Framer Motion container for continuous linear movement. */}
        <motion.div
          className="flex space-x-16 items-center whitespace-nowrap"
          animate={{
            x: ['0%', '-50%'],
          }}
          transition={{
            ease: 'linear',
            duration: 35,
            repeat: Infinity,
          }}
        >
          {infiniteLogos.map((logo, index) => (
            <div
              key={`${logo.name}-${index}`}
              className="relative flex flex-shrink-0 items-center justify-center grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100"
            >
              {/* 5. Step 5: Utilize Next.js Image for optimized asset delivery. 
                  We use a fixed height with auto-width (contained) to maintain logo proportions. */}
              <div className="relative h-10 w-32 md:h-14 md:w-40 lg:h-16 lg:w-48">
                <Image
                  src={logo.url}
                  alt={`${logo.name} logo`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 128px, (max-width: 1200px) 160px, 192px"
                  priority={index < 5} // Prioritize first few images to improve LCP
                />
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default SchoolBanner;