
'use client';

import React from 'react';
import ClientLayout from '@/app/(test-Study-resource)/layout' 
// 
if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    logOnDifferentValues: true,
  });
}

export default function TestPage() {
  return <ClientLayout />;
}
