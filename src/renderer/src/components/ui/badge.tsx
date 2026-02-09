import * as React from 'react'
import { cn } from '../../lib/cn'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function badgeVariantClasses(variant: BadgeVariant = 'default'): string {
  switch (variant) {
    case 'secondary':
      return 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'
    case 'destructive':
      return 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80'
    case 'outline':
      return 'text-foreground'
    case 'default':
    default:
      return 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80'
  }
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
  return <div className={cn(base, badgeVariantClasses(variant), className)} {...props} />
}

export { Badge }
