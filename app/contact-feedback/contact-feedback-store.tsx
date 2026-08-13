"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RegionalContact } from "../regional-contacts";

export type ContactFeedbackReason = "wrong_phone" | "outdated" | "wrong_office" | "other";

export type ContactFeedback = {
  id: string;
  region: string;
  contact: Pick<RegionalContact, "kind" | "name" | "phone" | "sourceUrl">;
  reason: ContactFeedbackReason;
  note: string;
  status: "submitted" | "resolved";
  createdAt: string;
};

type ContactFeedbackStoreValue = {
  feedback: ContactFeedback[];
  submitContactFeedback: (input: Omit<ContactFeedback, "id" | "status" | "createdAt">) => ContactFeedback;
};

const STORAGE_KEY = "foodsick.contact-feedback";
const ContactFeedbackStore = createContext<ContactFeedbackStoreValue | null>(null);

export function ContactFeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<ContactFeedback[]>([]);
  const [restored, setRestored] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) setFeedback(parsed as ContactFeedback[]);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setRestored(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (restored) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(feedback));
  }, [feedback, restored]);

  const value = useMemo<ContactFeedbackStoreValue>(() => ({
    feedback,
    submitContactFeedback(input) {
      const item: ContactFeedback = {
        ...input,
        id: `contact_feedback_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        status: "submitted",
        createdAt: new Date().toISOString(),
      };
      setFeedback((current) => [item, ...current]);
      return item;
    },
  }), [feedback]);

  return <ContactFeedbackStore.Provider value={value}>{children}</ContactFeedbackStore.Provider>;
}

export function useContactFeedback() {
  const value = useContext(ContactFeedbackStore);
  if (!value) throw new Error("useContactFeedback must be used inside ContactFeedbackProvider");
  return value;
}
