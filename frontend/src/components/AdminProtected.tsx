import { Navigate } from "react-router-dom";
import { tokens } from "../api/client";
import type { ReactNode } from "react";

// Guards admin module pages — redirects to the admin hub (login) if no token.
export default function AdminProtected({ children }: { children: ReactNode }) {
  if (!tokens.admin()) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
