import type {
  BillingCadence,
  CountyPlacement,
  SponsorableFeed,
  StatePlacement,
} from "../data/ad-pricing";

export type CountyPopulation = {
  county: string;
  countySlug: string;
  state: string;
  stateSlug: string;
  fips: string;
  population: number;
  estimateVintage: number;
  rateTier: string;
};

type UploadResponse = {
  assetKey: string;
  upload: {
    url: string;
    fields: Record<string, string>;
  };
};

type CheckoutResponse = {
  url: string;
};

type CheckoutContact = {
  billing: BillingCadence;
  customerEmail: string;
  businessName: string;
  referredBy?: string;
  creativeAssetKey?: string;
  bannerCreativeAssetKey?: string;
};

export type AdvertiserCheckoutInput = CheckoutContact &
  (
    | {
        scope: "county";
        placement: CountyPlacement;
        counties: Array<{ stateSlug: string; countySlug: string }>;
      }
    | {
        scope: "state";
        placement: StatePlacement;
        states: string[];
        feeds?: SponsorableFeed[];
      }
  );

export async function fetchCountyPopulation(stateSlug: string, countySlug: string) {
  return request<CountyPopulation>(`v1/counties/${stateSlug}/${countySlug}/population`);
}

export async function uploadAdCreative(file: File) {
  const upload = await request<UploadResponse>("v1/advertising/creatives/upload", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
  });
  const formData = new FormData();
  Object.entries(upload.upload.fields).forEach(([name, value]) => formData.append(name, value));
  formData.append("file", file);

  const response = await fetch(upload.upload.url, { method: "POST", body: formData });
  if (!response.ok) throw new Error("Your ad creative could not be uploaded. Please try again.");
  return upload.assetKey;
}

let currentAttempt: { hash: string; id: string } | undefined;

export async function startAdvertiserCheckout(input: AdvertiserCheckoutInput) {
  // Keep only an opaque attempt ID and a hash in storage, never contact details.
  // An unchanged retry reuses the server's saved quote and Stripe session.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const storageKey = "county-post-advertising-attempt";
  let attempt = currentAttempt;
  try { attempt = JSON.parse(sessionStorage.getItem(storageKey) || "null") || currentAttempt; } catch { /* storage may be blocked */ }
  if (attempt?.hash !== hash) attempt = { hash, id: crypto.randomUUID() };
  try { sessionStorage.setItem(storageKey, JSON.stringify(attempt)); } catch { /* in-memory retries still use the fallback below */ }
  currentAttempt = attempt;
  const checkoutRequestId = attempt.id;
  try {
    return await request<CheckoutResponse>("v1/checkout/sessions", {
      method: "POST", body: JSON.stringify({ ...input, checkoutRequestId }),
    });
  } catch (error) {
    // Only a provider-confirmed expiry permits a fresh attempt. A timeout or
    // ambiguous old attempt must keep the same reference for reconciliation.
    if (error instanceof CheckoutRequestError && error.code === "checkout_expired") {
      currentAttempt = undefined;
      try { sessionStorage.removeItem(storageKey); } catch { /* blocked storage */ }
    }
    throw error;
  }
}

export function fetchAdvertiserPaymentStatus(orderId: string) {
  return request<{ status: "paid" | "pending" | "expired" }>("v1/checkout/status", {
    method: "POST", body: JSON.stringify({ orderId }),
  });
}

async function request<T>(path: string, init?: RequestInit) {
  const baseUrl = import.meta.env.VITE_NEWS_API_URL;
  if (!baseUrl) throw new Error("Payments are not configured yet.");

  const response = await fetch(new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`), {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!response.ok) throw new CheckoutRequestError(body.error || "Unable to continue to secure checkout.", body.code);
  return body as T;
}

class CheckoutRequestError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}
