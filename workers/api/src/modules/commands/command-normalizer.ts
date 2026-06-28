const numberWords: Record<string, number> = {
  cero: 0, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  treinta: 30, cuarenta: 40, cincuenta: 50
};

export const stripAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normalizeCommandText = (value: string) =>
  stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9:+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const parseSpanishNumber = (value: string) => {
  const parts = normalizeCommandText(value).split(/\s+y\s+|\s+/);
  if (parts.length === 1) return numberWords[parts[0] ?? ""];
  const values = parts.map((part) => numberWords[part]).filter((part): part is number => part !== undefined);
  return values.length === parts.length ? values.reduce((sum, part) => sum + part, 0) : undefined;
};
