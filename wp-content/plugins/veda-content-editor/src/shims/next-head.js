// src/shims/next-head.js
import React from 'react';

/**
 * Minimal next/head shim — does not render head content in the body.
 * The real Next Head manipulates <head>; for WP admin/editor we don't need that.
 */
export default function Head({ children }) {
  // Optionally: you could append to document.head here for meta/title, but safest is to no-op.
  return null;
}
