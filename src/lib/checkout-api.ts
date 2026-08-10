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

export async function startAdvertiserCheckout(input: {
  placement: "color-card" | "section-sponsorship";
  billing: "monthly" | "annual";
  counties: Array<{ stateSlug: string; countySlug: string }>;
  customerEmail: string;
  businessName: string;
  creativeAssetKey?: string;
}) {
  return request<CheckoutResponse>("v1/checkout/sessions", {
    method: "POST",
    body: JSON.stringify(input),
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
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error || "Unable to continue to secure checkout.");
  return body as T;
}
