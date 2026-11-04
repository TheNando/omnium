import { render } from "preact";
import { configureAppwrite } from "@omnium/appwrite";
import { QueryClientProvider, createQueryClient } from "@omnium/query";
import { App } from "./App.tsx";
import "./style.css";

configureAppwrite({
  endpoint: import.meta.env["VITE_APPWRITE_ENDPOINT"],
  projectId: import.meta.env["VITE_APPWRITE_PROJECT_ID"],
});

render(
  <QueryClientProvider client={createQueryClient()}>
    <App />
  </QueryClientProvider>,
  document.getElementById("app")!,
);
