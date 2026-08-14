import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const adminApp = getApps()[0] ?? initializeApp();

export const adminDb = getFirestore(adminApp);

export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : "",
      role: decoded.role === "admin" ? "admin" as const : "user" as const,
    };
  } catch {
    return null;
  }
}

export async function authenticatedAdmin(request: Request) {
  const user = await authenticatedUser(request);
  return user?.role === "admin" ? user : null;
}
