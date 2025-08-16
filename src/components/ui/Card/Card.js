// Reusable Card Component
import React from 'react';
import './Card.module.css';

/**
 * Reusable card component for consistent layout
 */
export const Card = ({
  children,
  title,
  description,
  className = '',
  ...props
}) => {
  const cardClass = [
    'section',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass} {...props}>
      {(title || description) && (
        <div className="section-header">
          {title && <h2 className="section-title">{title}</h2>}
          {description && <p className="section-description">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
};
