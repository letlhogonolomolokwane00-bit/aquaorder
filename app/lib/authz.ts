"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "OWNER" | "DRIVER";

type AuthzState = {
  loading: boolean;
  user: User | null;
  role: UserRole | null;
  error: string | null;
  accessDenied: boolean;
};

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (data?.isActive === false) return null;
  const role = data?.role;
  if (role === "OWNER" || role === "DRIVER") {
    return role;
  }
  return null;
}

export function useRequireRole(requiredRole: UserRole, redirectPath: string) {
  const router = useRouter();
  const [state, setState] = useState<AuthzState>({
    loading: true,
    user: null,
    role: null,
    error: null,
    accessDenied: false,
  });

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      if (!user) {
        setState({
          loading: true,
          user: null,
          role: null,
          error: null,
          accessDenied: false,
        });
        router.replace(redirectPath);
        return;
      }

      setState({
        loading: true,
        user,
        role: null,
        error: null,
        accessDenied: false,
      });

      try {
        const role = await getUserRole(user.uid);
        if (!role || role !== requiredRole) {
          await signOut(auth);
          if (!isMounted) return;
          setState({
            loading: false,
            user: null,
            role: null,
            error: "Access denied for this area.",
            accessDenied: true,
          });
          router.replace(redirectPath);
          return;
        }

        setState({
          loading: false,
          user,
          role,
          error: null,
          accessDenied: false,
        });
      } catch (error) {
        await signOut(auth);
        if (!isMounted) return;
        setState({
          loading: false,
          user: null,
          role: null,
          error: error instanceof Error ? error.message : "Access check failed.",
          accessDenied: true,
        });
        router.replace(redirectPath);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [redirectPath, requiredRole, router]);

  return state;
}
