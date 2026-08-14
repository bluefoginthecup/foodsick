"use client";

import { getFirebaseClient } from "./client";

export async function firebaseAuthHeaders() {
  const user = getFirebaseClient()?.auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
