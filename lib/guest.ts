import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

const GUEST_ID_KEY = "generative_guest_id";

export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function clearGuestId() {
  localStorage.removeItem(GUEST_ID_KEY);
}

export function useGuestId() {
  const [guestId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getGuestId(),
  );

  return guestId;
}
