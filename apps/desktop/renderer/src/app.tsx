import { HashRouter } from "react-router-dom";

import { AppRouter } from "./router";
import { isBridgeAvailable } from "./bridge/client";
import { ErrorBanner } from "./ui/ErrorBanner";

export function App() {
  const bridgeOk = isBridgeAvailable();

  return (
    <HashRouter>
      {!bridgeOk && (
        <ErrorBanner
          title="ElektroPlan köprüsü bulunamadı"
          message="Electron köprüsü bulunamadı. Uygulamayı Electron üzerinden başlatın."
        />
      )}
      <AppRouter />
    </HashRouter>
  );
}
