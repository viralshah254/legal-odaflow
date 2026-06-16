/** Shared ARB key sanitization for Flutter gen-l10n. */
function toDartKey(key) {
  const parts = key.split('_')
  return parts
    .map((part, i) => {
      const cleaned = part.replace(/[^a-zA-Z0-9]/g, '')
      if (!cleaned) return ''
      if (i === 0) return cleaned.charAt(0).toLowerCase() + cleaned.slice(1)
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    })
    .join('')
    .replace(/^(\d)/, 'k$1') || 'key'
}

module.exports = { toDartKey }
