import React from 'react';

const SoftwareSchema = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'WiseGraph',
    url: 'https://wisegraph.app',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'All', 
    description: 'A visual study planner that uses AI to turn notes into concept maps, quizzes, and spaced repetition schedules.',
    browserRequirements: 'Requires JavaScript. Works on Chrome, Firefox, Safari, Edge.',
    softwareVersion: '1.0',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      name: 'Free Tier',
    },
    featureList: [
      'AI Quiz and Flash card Generation',
      'Concept Mapping',
      'AI summary notes',
      'Spaced Repetition Study Planner',
      'Real-time Collaboration',
      '5-Minute Micro-Lessons'
    ],
    screenshot: 'https://wisegraph.app/brand/hero-shot-highest-res.png', 
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default SoftwareSchema;