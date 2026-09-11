/** Returns the user's preferred locale variants */
export function getPreferredLocales(): string[] {
  const raw = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || ''
  if (!raw || raw === 'C' || raw === 'POSIX') return []

  // lang[_COUNTRY][.ENCODING][@MODIFIER]
  const match = raw.match(/^([a-zA-Z]+)(?:_([a-zA-Z]+))?(?:\.[^@]+)?(?:@(.+))?$/)
  if (!match) return []

  const [, lang, country, modifier] = match
  const variants: string[] = []

  if (country && modifier) variants.push(`${lang}_${country}@${modifier}`)
  if (country) variants.push(`${lang}_${country}`)
  if (modifier) variants.push(`${lang}@${modifier}`)
  variants.push(lang)

  return variants
}
