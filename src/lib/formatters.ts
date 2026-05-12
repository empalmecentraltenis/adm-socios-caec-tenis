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
export const parseCurrency = (value: string | number): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Elimina todo lo que no sea número, coma o punto
  // Primero eliminamos los puntos de miles (que en es-AR son puntos)
  // Pero ojo, si el usuario pegó algo con punto decimal, esto lo rompe.
  // Vamos a ser más inteligentes: si hay una coma, los puntos son miles.
  let cleanValue = value.toString().replace(/\$/g, '').replace(/\s/g, '').replace(/\u00A0/g, '');
  
  if (cleanValue.includes(',')) {
    // Es formato es-AR: punto es miles, coma es decimal
    cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
  }
  
  return parseFloat(cleanValue) || 0;
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
