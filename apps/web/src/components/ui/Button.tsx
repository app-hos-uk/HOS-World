'use client';

import React from 'react';
import Link from 'next/link';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  href?: string;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-hos-gold text-[#1a1406] hover:bg-hos-gold-hover active:bg-hos-gold-hover shadow-sm',
  secondary: 'bg-hos-bg-secondary text-hos-text-secondary border border-hos-border hover:bg-hos-bg-tertiary active:bg-hos-bg-tertiary',
  ghost: 'text-hos-text-secondary hover:text-hos-gold hover:bg-hos-bg-tertiary',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  href,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center gap-2 
    font-medium rounded-lg transition-colors
    disabled:opacity-50 disabled:cursor-not-allowed
  `;
  
  const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;
  
  const content = (
    <>
      {isLoading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </>
  );
  
  if (href && !disabled) {
    return (
      <Link href={href} className={combinedStyles}>
        {content}
      </Link>
    );
  }
  
  return (
    <button
      disabled={disabled || isLoading}
      className={combinedStyles}
      {...props}
    >
      {content}
    </button>
  );
}

// Icon Button variant
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon: React.ReactNode;
  'aria-label': string;
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  icon,
  className = '',
  ...props
}: IconButtonProps) {
  const sizeMap: Record<ButtonSize, string> = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };
  
  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-lg transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]} ${sizeMap[size]} ${className}
      `}
      {...props}
    >
      {icon}
    </button>
  );
}
