import { Navigate, Route, Routes } from "react-router-dom";

import { CablePage } from "./features/cable/CablePage";
import { MaterialsPage } from "./features/materials/MaterialsPage";
import { MotorPage } from "./features/motor/MotorPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { VoltageDropPage } from "./features/voltageDrop/VoltageDropPage";
import { Layout } from "./ui/Layout";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/motor" replace />} />
        <Route path="/motor" element={<MotorPage />} />
        <Route path="/cable" element={<CablePage />} />
        <Route path="/voltage-drop" element={<VoltageDropPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/motor" replace />} />
      </Route>
    </Routes>
  );
}
