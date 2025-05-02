'use client';

import React from 'react';
import ClientLayout from '../../../../archive-v1-bloom/app'; // Import the ClientLayout component

/**WDYR setup (Only in development mode)
if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    logOnDifferentValues: true,
  });
}  */

export default function TestPage() {
  return <ClientLayout />;
}
