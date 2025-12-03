import React from 'react';

const SoftwareSchema = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'WiseGraph',
    url: 'https://wisegraph.app',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any', 
    
    // UPDATE: Removed "free SaaS" from description
    description: 'WiseGraph is an AI-powered study planner for students. It converts PDFs to summarized notes, flash cards ,quizzes and concept maps, prevents cramming via spaced repetition and utilizes active recall for academic success.',
    
    browserRequirements: 'Requires JavaScript. Works on Chrome, Firefox, Safari, Edge.',
    softwareVersion: '1.0.0',
    
    // CRITICAL UPDATE: The "Offer" section
    offers: {
      '@type': 'Offer',
      price: '0', // The entry price is still 0 (no credit card to start)
      priceCurrency: 'USD',
      name: 'Free Demo', // CHANGED from "Free Tier" to "Free Demo"
      availability: 'https://schema.org/OnlineOnly',
    },
    
    featureList: [
      'AI Quiz and Flash card Generation',
      'Concept Mapping',
      'AI summary notes',
      'Spaced Repetition Study Planner',
      'Real-time Collaboration',
      '5-Minute Micro-Lessons',
      'Active Recall Automation'
    ],
    screenshot: 'https://wisegraph.app/brand/hero-shot-highest-res.png',
    image: 'https://wisegraph.app/brand/logo.png',
    author: {
        '@type': 'Organization',
        name: 'WiseGraph Team',
        url: 'https://wisegraph.app'
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default SoftwareSchema;