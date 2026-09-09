import React from 'react';

/**
 * The app's only loading animation. Styles live in index.css (.loader).
 *
 * size: 'md' (default) | 'sm' for inline use inside buttons and cells.
 * onDark: use on dark surfaces, e.g. the SQL editor.
 */
export default function Loader({ size = 'md', onDark = false, className = '', label = 'Loading' }) {
  const classes = [
    'loader',
    size === 'sm' ? 'loader--sm' : '',
    onDark ? 'loader--on-dark' : '',
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes} role="status" aria-label={label} />;
}
