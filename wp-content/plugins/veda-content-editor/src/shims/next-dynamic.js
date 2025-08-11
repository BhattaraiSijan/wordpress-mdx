// src/shims/next-dynamic.js
import React from 'react';

/**
 * Minimal compatible implementation of next/dynamic for client-side bundles.
 * Usage: dynamic(() => import('./MyComp'), { ssr: false, loading: () => <div/> })
 */
export default function dynamic(importFn, options = {}) {
  // Return a component that uses React.lazy + Suspense to load the chunk
  function DynamicComponent(props) {
    const LazyComp = React.useMemo(() => React.lazy(() => importFn()), [importFn]);

    // if `options.loading` is provided, use it as fallback, otherwise null
    const Fallback = options.loading || null;

    return React.createElement(
      React.Suspense,
      { fallback: Fallback ? React.createElement(Fallback) : null },
      React.createElement(LazyComp, props)
    );
  }

  // Provide a .displayName for easier debugging
  DynamicComponent.displayName = options.displayName || 'DynamicComponent';
  return DynamicComponent;
}
