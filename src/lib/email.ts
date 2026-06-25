import emailjs from "@emailjs/browser";
import type { CountySite } from "../data/counties";
import { site } from "../data/site";

type FormValue = string | boolean | undefined;

function getEmailConfig() {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

  if (!serviceId || !templateId || !publicKey) {
    throw new Error("EmailJS is not configured. Add VITE_EMAILJS_* values to your .env file.");
  }

  return { serviceId, templateId, publicKey };
}

function formatValue(value: FormValue) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value?.toString().trim() || "Not provided";
}

function buildMessage(title: string, county: CountySite, values: Record<string, FormValue>) {
  const details = Object.entries(values)
    .filter(([key]) => key !== "website")
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join("\n");

  return [
    `Submission type: ${title}`,
    `County: ${county.displayName}, ${county.state.name}`,
    `FIPS: ${county.fips}`,
    "",
    details,
  ].join("\n");
}

export async function sendCountyFormEmail(params: {
  county: CountySite;
  title: string;
  replyTo?: string;
  values: Record<string, FormValue>;
}) {
  const config = getEmailConfig();
  const fromName = String(params.values.name || "Reader");
  const fromEmail = String(params.replyTo || params.values.email || "");

  return emailjs.send(
    config.serviceId,
    config.templateId,
    {
      title: params.title,
      name: fromName,
      email: fromEmail,
      reply_to: fromEmail,
      to_email: site.contact.email,
      county_name: params.county.displayName,
      county_slug: params.county.slug,
      state_name: params.county.state.name,
      state_slug: params.county.state.slug,
      message: buildMessage(params.title, params.county, params.values),
      page_url: window.location.href,
      submitted_at: new Date().toISOString(),
    },
    { publicKey: config.publicKey },
  );
}
