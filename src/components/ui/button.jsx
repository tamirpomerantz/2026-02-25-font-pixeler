import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = {
  default:
    'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 rounded-[var(--radius-md)]',
  outline:
    'border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-muted)]/20 rounded-[var(--radius-md)]',
  ghost: 'hover:bg-[var(--color-muted)]/20 rounded-[var(--radius-md)]',
}

const sizeVariants = {
  default: 'h-9 px-4 py-2 text-sm font-medium',
  sm: 'h-8 px-3 text-sm',
  lg: 'h-10 px-6 text-sm',
  icon: 'h-9 w-9',
}

export const Button = forwardRef(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? 'span' : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          buttonVariants[variant] || buttonVariants.default,
          sizeVariants[size] || sizeVariants.default,
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
