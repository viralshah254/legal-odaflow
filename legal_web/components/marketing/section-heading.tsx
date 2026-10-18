export function SectionHeading({
  eyebrow,
  title,
  copy,
  tone = "dark",
  align = "center",
}: {
  eyebrow: string
  title: string
  copy?: string
  tone?: "dark" | "light"
  align?: "center" | "left"
}) {
  const light = tone === "light"
  const centered = align === "center"
  return (
    <div className={`mb-12 max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>
      <p className={`mb-4 text-xs font-semibold uppercase tracking-[.18em] ${light ? "text-blue-300" : "text-blue-700"}`}>{eyebrow}</p>
      <h2 className={`text-4xl font-semibold tracking-[-.055em] sm:text-5xl ${light ? "text-white" : "text-slate-950"}`}>{title}</h2>
      {copy && <p className={`mt-5 text-lg leading-8 ${light ? "text-slate-300" : "text-slate-600"}`}>{copy}</p>}
    </div>
  )
}
