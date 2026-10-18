/** Maps tour id to tutorials.labels.* i18n key suffix */
export function getTourLabelKey(tourId: string): string {
  const suffix = tourId
    .replace(/^app\./, "")
    .replace(/^consumer\./, "consumer_")
    .replace(/\./g, "_")
  return `labels.${suffix}`
}
