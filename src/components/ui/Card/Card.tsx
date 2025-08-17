// Reusable Card Component
import React, { HTMLAttributes, ReactNode } from 'react';
import './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  description?: string;
}

/**
 * Reusable card component for consistent layout
 */
export const Card: React.FC<CardProps> = ({
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
