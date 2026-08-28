import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'blue';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-surface-subtle text-foreground border-border',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    destructive: 'bg-rose-50 text-rose-700 border-rose-200',
    outline: 'bg-transparent text-muted-foreground border-border',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border leading-tight',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
