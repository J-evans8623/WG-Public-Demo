// app/about/page.tsx

import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

/**
 * @file app/about/page.tsx
 * @description Informational page for the "About Us" route.
 * Provides the company mission statement and contact information.
 * Acts as a central hub for general inquiries via the 'hello' email alias.
 */

export default function AboutPage() {
  return (
    <div className="wg-page">
      <SiteHeader />
      
      <main style={{ 
        minHeight: '70vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        textAlign: 'center',
        padding: '60px 24px'
      }}>
        
        {/* Hero / Mission */}
        <div style={{ maxWidth: '640px', marginBottom: '64px' }}>
          <h1 style={{ 
            fontFamily: 'Crimson Text, serif', 
            fontSize: '3rem', 
            marginBottom: '24px',
            color: '#2c3e50',
            lineHeight: 1.1
          }}>
            About Wisegraph
          </h1>
          <p style={{ 
            fontSize: '1.2rem', 
            lineHeight: 1.6,
            color: '#546b81'
          }}>
            We are building the future of AI-assisted learning. Our mission is to end the cycle of cramming by turning chaotic study materials into clear, navigable knowledge maps.
          </p>
        </div>

        {/* Divider */}
        <div style={{ 
          width: '60px', 
          height: '2px', 
          backgroundColor: '#E2E4E7', 
          marginBottom: '64px' 
        }}></div>

        {/* Contact Section */}
        <div style={{ maxWidth: '500px' }}>
          <h2 style={{ 
            fontFamily: 'Crimson Text, serif', 
            fontSize: '2rem', 
            marginBottom: '16px',
            color: '#2c3e50' 
          }}>
            Get in Touch
          </h2>
          <p style={{ 
            fontSize: '1.05rem', 
            color: '#546b81',
            lineHeight: 1.6,
            marginBottom: '24px'
          }}>
            Have questions about our platform, pricing, or partnership opportunities? We’d love to hear from you.
          </p>
          
          <a 
            href="mailto:hello@wisegraph.app"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#E34432', // Brand accent red
              textDecoration: 'none',
              borderBottom: '2px solid rgba(227, 68, 50, 0.2)',
              paddingBottom: '2px',
              transition: 'border-color 0.2s ease'
            }}
          >
            hello@wisegraph.app
          </a>
        </div>

      </main>
      
      <SiteFooter />
    </div>
  );
}