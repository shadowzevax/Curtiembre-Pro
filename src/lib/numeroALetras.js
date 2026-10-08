// Valor en letras para documentos en pesos colombianos, como se escribe en recibos y cheques:
// 120000 → "CIENTO VEINTE MIL PESOS M/CTE", 1500000 → "UN MILLÓN QUINIENTOS MIL PESOS M/CTE".
const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_VEINTINUEVE = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function decenas(n) {
  if (n < 10) return UNIDADES[n];
  if (n < 30) return DIEZ_A_VEINTINUEVE[n - 10];
  const d = Math.floor(n / 10), u = n % 10;
  return u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d];
}

function centenas(n) {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100), resto = n % 100;
  return [CENTENAS[c], decenas(resto)].filter(Boolean).join(' ');
}

function enteroALetras(n) {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const unidades = n % 1000;
  const partes = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${enteroALetras(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${centenas(miles)} MIL`);
  if (unidades) partes.push(centenas(unidades));
  return partes.join(' ');
}

export function numeroALetras(valor) {
  const total = Math.round((Number(valor) || 0) * 100) / 100;
  const entero = Math.floor(Math.abs(total));
  const centavos = Math.round((Math.abs(total) - entero) * 100);
  let texto = enteroALetras(entero);
  // "UN MILLÓN DE PESOS", pero "UN MILLÓN CIEN MIL PESOS".
  const soloMillones = entero >= 1_000_000 && entero % 1_000_000 === 0;
  texto += entero === 1 ? ' PESO' : soloMillones ? ' DE PESOS' : ' PESOS';
  if (centavos) texto += ` CON ${String(centavos).padStart(2, '0')}/100`;
  return `${texto} M/CTE`;
}
