import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import AdminProtected from "./components/AdminProtected";

import Home from "./pages/Home";
import Queue from "./pages/Queue";
import QueueDetail from "./pages/QueueDetail";
import Documents from "./pages/Documents";
import Market from "./pages/Market";
import MarketDetail from "./pages/MarketDetail";
import Report from "./pages/Report";
import Account from "./pages/Account";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";

import AdminHub from "./pages/admin/AdminHub";
import AdminQueue from "./pages/admin/AdminQueue";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminIssues from "./pages/admin/AdminIssues";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/queue/:id" element={<QueueDetail />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/market" element={<Market />} />
        <Route path="/market/:id" element={<MarketDetail />} />
        <Route path="/report" element={<Report />} />
        <Route path="/account" element={<Account />} />
        <Route path="/help" element={<Help />} />

        <Route path="/admin" element={<AdminHub />} />
        <Route
          path="/admin/queue"
          element={
            <AdminProtected>
              <AdminQueue />
            </AdminProtected>
          }
        />
        <Route
          path="/admin/documents"
          element={
            <AdminProtected>
              <AdminDocuments />
            </AdminProtected>
          }
        />
        <Route
          path="/admin/issues"
          element={
            <AdminProtected>
              <AdminIssues />
            </AdminProtected>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
