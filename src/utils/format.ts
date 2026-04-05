/**
 * Правильное склонение слов в русском языке.
 * Обрабатывает специальные случаи для чисел 11-19.
 */
export function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  
  // Числа 11-19 всегда используют форму "many"
  if (mod100 >= 11 && mod100 <= 19) return many;
  
  // Числа, оканчивающиеся на 1 (кроме 11) используют форму "one"
  if (mod10 === 1) return one;
  
  // Числа, оканчивающиеся на 2-4 (кроме 12-14) используют форму "few"
  if (mod10 >= 2 && mod10 <= 4) return few;
  
  // Все остальные случаи используют форму "many"
  return many;
}
