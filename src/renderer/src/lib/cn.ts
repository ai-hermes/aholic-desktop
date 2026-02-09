// Simple class name concatenation helper (like Sessionly's cn)
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
