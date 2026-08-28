import React from 'react';
import { cn } from '../../lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  indicatorClassName?: string;
  isIndeterminate?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  className,
  indicatorClassName,
  isIndeterminate = false,
  ...props
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden rounded bg-surface-subtle border border-border/60',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full transition-all duration-200 ease-out bg-primary',
          isIndeterminate && 'w-1/3 animate-pulse',
          indicatorClassName
        )}
        style={{ width: isIndeterminate ? '100%' : `${clamped}%` }}
      />
    </div>
  );
};
