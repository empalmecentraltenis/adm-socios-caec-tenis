import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parsea una fecha (string YYYY-MM-DD, ISO UTC o Date) a un objeto Date local
 * configurado a las 12:00 (mediodía) para que los husos horarios (ej: UTC-3 en Argentina)
 * no desplacen el día hacia atrás al formatearlo o mostrarlo en pantalla.
 */
export function parseLocalDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return new Date(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate(), 12, 0, 0);
  }
  const dateStr = String(dateInput).split('T')[0];
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  return new Date(dateInput);
}

