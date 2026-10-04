/** Генерация дефолтного названия для импорта */
export function getDefaultImportName(): string {
  const date = new Date();
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `Импорт от ${day}.${month}.${year}`;
}
