// src/shims/next-link.js
import React from 'react';

/**
 * Minimal next/link shim — simply renders an <a> element.
 * It forwards props and children; supports `href`.
 */
export default function Link({ children, href = '#', onClick, ...props }) {
  return React.createElement('a', { href, onClick, ...props }, children);
}
