import { Account, Client, Functions, TablesDB } from "appwrite";

export type AppwriteConfig = { endpoint: string; projectId: string };

let services:
  | { client: Client; account: Account; functions: Functions; tables: TablesDB }
  | undefined;

/** Call once at startup, before any other helper in this package. */
export function configureAppwrite({ endpoint, projectId }: AppwriteConfig): void {
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  services = {
    client,
    account: new Account(client),
    functions: new Functions(client),
    tables: new TablesDB(client),
  };
}

export function appwrite() {
  if (!services) throw new Error("Call configureAppwrite() before using @omnium/appwrite.");
  return services;
}
