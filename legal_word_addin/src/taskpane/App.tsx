import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import {
  getStoredToken,
  isTokenExpired,
  refreshUmbrellaSession,
  sessionFromToken,
} from "../auth/auth";
import { MatterSelector } from "./pages/MatterSelector";
import { ClauseAssist } from "./pages/ClauseAssist";
import { CopilotPage } from "./pages/CopilotPage";
import { ResearchPage } from "./pages/ResearchPage";
import { ReviewPage } from "./pages/ReviewPage";
import { PlaybookPage } from "./pages/PlaybookPage";
import { DraftLibraryPage } from "./pages/DraftLibraryPage";
import { LoginPage } from "./pages/LoginPage";
import { NavBar } from "./components/NavBar";

export interface AddinSession {
  accessToken: string;
  tenantId: string;
  userId: string;
  displayName: string;
}

export default function App() {
  const [session, setSession] = useState<AddinSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const token = await getStoredToken();
        if (token && !isTokenExpired(token)) {
          setSession(sessionFromToken(token));
        } else {
          const refreshed = await refreshUmbrellaSession();
          if (refreshed) {
            setSession({
              accessToken: refreshed.accessToken,
              tenantId: refreshed.tenantId,
              userId: refreshed.userId,
              displayName: refreshed.displayName,
            });
          }
        }
      } catch {
        // Silently fall through to login
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleLogin = (sess: AddinSession) => setSession(sess);
  const handleLogout = () => setSession(null);

if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto" }} />
        <p style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <NavBar session={session} onLogout={handleLogout} />
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/matter" />} />
          <Route path="/matter" element={<MatterSelector session={session} />} />
          <Route path="/review" element={<ReviewPage session={session} />} />
          <Route path="/playbook" element={<PlaybookPage session={session} />} />
          <Route path="/library" element={<DraftLibraryPage session={session} />} />
          <Route path="/clauses" element={<ClauseAssist session={session} />} />
          <Route path="/copilot" element={<CopilotPage session={session} />} />
          <Route path="/research" element={<ResearchPage session={session} />} />
        </Routes>
      </div>
    </div>
  );
}
