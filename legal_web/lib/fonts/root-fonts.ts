/** Dev uses system fonts only (no Google CDN). Prod loads Inter + script fonts. */
export async function getBodyFontClassName(): Promise<string> {
  if (process.env.NODE_ENV === "development") {
    return "font-sans"
  }

  const [{ interFontVariable }, { productionFontVariables }] = await Promise.all([
    import("./inter-font"),
    import("./production-fonts"),
  ])

  return `${interFontVariable} ${productionFontVariables} font-sans`
}
