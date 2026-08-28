import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
      secondary: 'bg-surface hover:bg-surface-subtle text-foreground border border-border shadow-2xs',
      outline: 'bg-transparent border border-border text-foreground hover:bg-surface-subtle',
      ghost: 'bg-transparent text-foreground hover:bg-surface-subtle',
      destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 shadow-sm',
      subtle: 'bg-surface-subtle hover:bg-surface-muted text-foreground border border-border/50',
    };

    const sizes = {
      xs: 'h-6 px-2 text-xs rounded-sm gap-1',
      sm: 'h-7 px-2.5 text-xs rounded-sm gap-1.5',
      md: 'h-8 px-3 text-sm rounded gap-2',
      lg: 'h-9 px-4 text-sm rounded-md gap-2',
      icon: 'h-8 w-8 p-0 rounded flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
