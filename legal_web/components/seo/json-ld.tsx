type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>
}

/** Renders JSON-LD structured data for search engines. */
export function JsonLd({ data }: JsonLdProps) {
  const payload = Array.isArray(data) ? data : [data]
  return (
    <>
      {payload.map((entry, index) => (
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
          key={index}
          type="application/ld+json"
        />
      ))}
    </>
  )
}
