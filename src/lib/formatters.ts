/**
 * Formatea un número a moneda argentina ($ 1.234,56)
 */
export const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$ 0,00';
  
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(num);
};

/**
 * Limpia un string de moneda para obtener el valor numérico
 * Ejemplo: "$ 1.234,56" -> 1234.56
 */
export const parseCurrency = (value: string): number => {
  if (!value) return 0;
  // Elimina todo lo que no sea número, coma o punto
  const cleanValue = value.replace(/[^0-9,.-]/g, '');
  // Reemplaza la coma decimal por punto si existe
  const normalizedValue = cleanValue.replace(',', '.');
  
  // Manejo de miles: si hay múltiples puntos, eliminamos todos menos el último si es decimal
  // Pero en es-AR el punto es miles y la coma es decimal.
  // Así que después de normalizar (coma -> punto), el punto es el decimal.
  // Debemos eliminar los puntos que actúan como miles antes de normalizar.
  
  const finalValue = value
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '') // Elimina puntos de miles
    .replace(',', '.'); // Cambia coma decimal por punto
    
  return parseFloat(finalValue) || 0;
};

/**
 * Formateador para inputs (mientras se escribe)
 */
export const formatInputCurrency = (value: string): string => {
  // Solo números
  let clean = value.replace(/\D/g, '');
  if (!clean) return '';
  
  // Convertir a centavos
  const cents = parseInt(clean);
  const total = cents / 100;
  
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(total);
};
