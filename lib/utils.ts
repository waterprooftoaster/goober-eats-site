/**
 * @file utils.ts
 * @description Tailwind CSS class merging utility using clsx and tailwind-merge.
 *   Called by: throughout all components
 * @dependencies clsx, tailwind-merge
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
