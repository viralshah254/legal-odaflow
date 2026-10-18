/** Title-case each word in a person's name for display and storage. */
export function formatPersonName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (char) => char.toUpperCase())
}
