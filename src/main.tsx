import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@/lib/queryClient";
import { AppProviders } from "@/components/AppProviders";
import App from "./App";
import "./i18n";
import "./styles.css";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppProviders>
          <App />
        </AppProviders>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
