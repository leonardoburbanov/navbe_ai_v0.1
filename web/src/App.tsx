import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import { AppProviders } from "./ConnectionContext";
import FlowDetailPage from "./pages/FlowDetailPage";
import FlowsPage from "./pages/FlowsPage";
import HomePage from "./pages/HomePage";
import RunDetailPage from "./pages/RunDetailPage";
import RunsPage from "./pages/RunsPage";
import SchedulesPage from "./pages/SchedulesPage";

/** Router + providers for the LAN companion. */
export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="flows" element={<FlowsPage />} />
            <Route path="flows/:id" element={<FlowDetailPage />} />
            <Route path="runs" element={<RunsPage />} />
            <Route path="runs/:id" element={<RunDetailPage />} />
            <Route path="schedules" element={<SchedulesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
