import Link from "next/link"
import { marketingContent } from "@/content/marketing"

export function CinematicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12 sm:py-14">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:gap-10 sm:px-6 md:grid-cols-2 lg:grid-cols-6 lg:px-8 xl:px-12">
        <div className="lg:col-span-1">
          <p className="text-xl font-semibold text-slate-950">Umbrella</p>
          <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">Intelligent legal workspaces for people, lawyers and teams.</p>
        </div>
        {Object.entries(marketingContent.footer).map(([name, links]) => (
          <div key={name}>
            <h3 className="text-sm font-semibold capitalize text-slate-950">{name}</h3>
            <ul className="mt-4 space-y-2.5">
              {links.map((link) => (
                <li key={link.label}>
                  {"disabled" in link && link.disabled ? (
                    <span className="text-sm text-slate-400" title="Coming soon">{link.label}</span>
                  ) : (
                    <Link href={("href" in link && link.href) || "#"} className="text-sm text-slate-500 hover:text-blue-700">{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t px-4 pt-6 text-xs text-slate-400 sm:mt-12 sm:flex-row sm:justify-between sm:px-6 lg:px-8 xl:px-12">
        <span>© {new Date().getFullYear()} Umbrella by OkayLegal.ai</span>
        <span>Legal information and workflow tools—not legal advice.</span>
      </div>
    </footer>
  )
}
