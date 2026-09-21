import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export function useGuestIdentity() {
  const [guestId, setGuestId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    // 1. Handle UUID (Persistence)
    let id = localStorage.getItem("foldex_guest_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("foldex_guest_id", id);
    }
    setGuestId(id);

    // 2. Handle Fingerprint (Security/Anti-Abuse)
    const setFp = async () => {
      const fpPromise = FingerprintJS.load();
      const fp = await fpPromise;
      const result = await fp.get();
      setFingerprint(result.visitorId);
    };
    setFp();
  }, []);

  return { guestId, fingerprint };
}
