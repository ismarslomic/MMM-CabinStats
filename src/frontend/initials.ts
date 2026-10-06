/**
 * Initials for the avatar fallback: first letter of the first and last name, upper-cased. Uses code points so
 * names starting with a non-BMP character are not split. Returns `?` when both names are blank.
 */
export function initials(firstName: string, lastName: string): string {
  const letters = [firstName, lastName]
    .map((name) => Array.from(name.trim())[0])
    .filter((letter): letter is string => letter !== undefined)
    .map((letter) => letter.toLocaleUpperCase('nb'))
  return letters.length > 0 ? letters.join('') : '?'
}
