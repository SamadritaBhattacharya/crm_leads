"use client";

import { useState, useCallback, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { useRouter } from "next/navigation";

import { getFirebaseAuth } from "@/lib/firebase/config";
import { setSession, clearSession } from "@/lib/auth/session";

type AuthStatus = "idle" | "loading" | "authenticated" | "error";

/**
 * Exchanges a Firebase ID token with the FastAPI backend for our JWT cookies.
 * Returns the user display info for the session cookie.
 */
async function exchangeToken(idToken: string) {
  const res = await fetch("/api/auth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Token exchange failed");
  }
  return res.json() as Promise<{ username: string; role: string; fullName: string }>;
}

export function useFirebaseAuth() {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      if (user) {
        setStatus("authenticated");
      } else {
        setStatus("idle");
      }
    });
    return unsubscribe;
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setStatus("loading");
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const result = await exchangeToken(idToken);
      setSession({ username: result.username, role: result.role as "admin" | "staff", fullName: result.fullName ?? "" });
      setStatus("authenticated");
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      setStatus("error");
      return false;
    }
  }, []);

  const signupWithEmail = useCallback(async (email: string, password: string) => {
    setStatus("loading");
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const result = await exchangeToken(idToken);
      setSession({ username: result.username, role: result.role as "admin" | "staff", fullName: result.fullName ?? "" });
      setStatus("authenticated");
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signup failed";
      setError(message);
      setStatus("error");
      return false;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      const result = await exchangeToken(idToken);
      setSession({ username: result.username, role: result.role as "admin" | "staff", fullName: result.fullName ?? "" });
      setStatus("authenticated");
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
      setStatus("error");
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
    clearSession();
    await fetch("/api/auth/logout", { method: "POST" });
    setStatus("idle");
    router.push("/login");
  }, [router]);

  return { status, error, loginWithEmail, signupWithEmail, loginWithGoogle, logout, setError };
}
