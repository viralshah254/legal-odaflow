import { Link, useLocation } from "react-router-dom";
import type { AddinSession } from "../App";

const NAV_ITEMS = [
  { path: "/matter", label: "Matter" },
  { path: "/review", label: "Review" },
  { path: "/playbook", label: "Playbook" },
  { path: "/library", label: "Library" },
  { path: "/copilot", label: "Copilot" },
  { path: "/clauses", label: "Clauses" },
  { path: "/research", label: "Research" },
];

interface Props {
  session: AddinSession;
  onLogout: () => void;
}

export function NavBar({ session, onLogout }: Props) {
  const { pathname } = useLocation();

  return (
    <div className="border-b bg-white shrink-0">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-blue-700">Umbrella Legal AI</span>
        <button onClick={onLogout} className="text-[10px] text-gray-400 hover:text-gray-700">
          Sign out
        </button>
      </div>
      <div className="flex border-t">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex-1 text-center text-[11px] py-2 font-medium transition-colors ${
              pathname === item.path
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
