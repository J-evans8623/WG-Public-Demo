// components/seo/VideoSchema.tsx
import React from 'react';

const VideoSchema = () => {
  const videoID = "EX8m4dnDy0I";
  // https://www.youtube.com/watch?v=EX8m4dnDy0I
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: 'WiseGraph Demo - How It Works',
    description: 'See how WiseGraph turns chapters into clear concept maps, generates AI quizzes, and prevents cramming via spaced repetition.',
    // Thumbnails are automatically fetched from YouTube structure
    thumbnailUrl: [
      `https://img.youtube.com/vi/${videoID}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${videoID}/hqdefault.jpg`
    ],
    // Updated to Dec 7, 2025
    uploadDate: '2025-12-07T08:00:00+00:00', 
    // Updated to 1 minute 14 seconds
    duration: 'PT1M14S', 
    contentUrl: `https://www.youtube.com/watch?v=${videoID}`,
    embedUrl: `https://www.youtube.com/embed/${videoID}`,
    regionsAllowed: ['US', 'CA', 'GB', 'AU', 'IN', 'EU'] 
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default VideoSchema;