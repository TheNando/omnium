import { AppwriteException } from "appwrite";
import { appwrite } from "./client.ts";

export type CurrentUser = { id: string; name: string };

/**
 * Returns the signed-in user, creating an anonymous session first if there is
 * none. The session survives reloads, so the same player comes back.
 */
export async function ensureSession(): Promise<CurrentUser> {
  const { account } = appwrite();
  try {
    const user = await account.get();
    return { id: user.$id, name: user.name };
  } catch (error) {
    if (!(error instanceof AppwriteException) || error.code !== 401) throw error;
  }
  await account.createAnonymousSession();
  const user = await account.get();
  return { id: user.$id, name: user.name };
}

export async function updateName(name: string): Promise<void> {
  await appwrite().account.updateName({ name });
}
