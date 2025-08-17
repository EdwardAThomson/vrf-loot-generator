// Reusable Input Component
import React, { InputHTMLAttributes } from 'react';
import './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
}

/**
 * Reusable input component with label and error handling
 */
export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  disabled = false,
  error = null,
  className = '',
  ...props
}) => {
  const inputClass = [
    'form-input',
    error ? 'form-input-error' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label}
        </label>
      )}
      <input
        type={type}
        className={inputClass}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        {...props}
      />
      {error && (
        <div className="form-error">
          {error}
        </div>
      )}
    </div>
  );
};
