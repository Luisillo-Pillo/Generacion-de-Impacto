// Una celda de CSV segura: si empieza con =, +, -, @, tabulador o retorno de carro, Excel y Hojas de cálculo la
// interpretarían como una FÓRMULA (p. ej. =HYPERLINK(...) o =CMD|...), así que se le antepone una comilla simple. Después se
// pone entre comillas dobles (duplicando las que haya), lo que permite comas y saltos de línea dentro de la celda.
export function csvCell(value) {
  let text = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const toCsv = (header, rows) => [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
