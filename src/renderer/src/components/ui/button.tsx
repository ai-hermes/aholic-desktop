import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../../lib/cn'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

function buttonVariantClasses(variant: ButtonVariant = 'default'): string {
  switch (variant) {
    case 'destructive':
      return 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
    case 'outline':
      return 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
    case 'secondary':
      return 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
    case 'ghost':
      return 'hover:bg-accent hover:text-accent-foreground'
    case 'link':
      return 'text-primary underline-offset-4 hover:underline'
    case 'default':
    default:
      return 'bg-primary text-primary-foreground hover:bg-primary/90'
  }
}

function buttonSizeClasses(size: ButtonSize = 'default'): string {
  switch (size) {
    case 'sm':
      return 'h-9 rounded-md px-3'
    case 'lg':
      return 'h-11 rounded-md px-8'
    case 'icon':
      return 'h-10 w-10'
    case 'default':
    default:
      return 'h-10 px-4 py-2'
  }
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const base =
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
    const classes = cn(base, buttonVariantClasses(variant), buttonSizeClasses(size), className)
    return <Comp className={classes} ref={ref} {...props} />
  }
)

Button.displayName = 'Button'

export { Button }
