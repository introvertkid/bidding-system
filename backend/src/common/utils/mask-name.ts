// "Nguyễn Văn An" -> "Nguyễn V** A*"
export function maskName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return [first, ...rest.map((word) => word[0] + '*'.repeat(word.length - 1))].join(' ');
}
