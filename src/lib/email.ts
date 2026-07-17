import emailjs from "@emailjs/browser";
import type { CountySite } from "../data/counties";
import { site } from "../data/site";
import type { StateSite } from "../data/states";

type FormValue = string | boolean | undefined;

function getEmailConfig() {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

  if (!serviceId || !templateId || !publicKey) {
    throw new Error("The submission service is not configured. Please contact the desk directly.");
  }

  return { serviceId, templateId, publicKey };
}

function formatValue(value: FormValue) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value?.toString().trim() || "Not provided";
}

export type SubmissionScope =
  | { level: "county"; label: string; county: CountySite }
  | { level: "state"; label: string; state: StateSite }
  | { level: "national"; label: string };

function buildMessage(title: string, scope: SubmissionScope, values: Record<string, FormValue>) {
  const details = Object.entries(values)
    .filter(([key]) => key !== "website")
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join("\n");

  const scopeDetails =
    scope.level === "county"
      ? [`County: ${scope.county.displayName}, ${scope.county.state.name}`, `FIPS: ${scope.county.fips}`]
      : scope.level === "state"
        ? [`State: ${scope.state.name}`, `State slug: ${scope.state.slug}`]
        : ["Scope: National"];

  return [
    `Submission type: ${title}`,
    `Submission scope: ${scope.label}`,
    ...scopeDetails,
    "",
    details,
  ].join("\n");
}

export async function sendStoryFormEmail(params: {
  scope: SubmissionScope;
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
      county_name: params.scope.level === "county" ? params.scope.county.displayName : "",
      county_slug: params.scope.level === "county" ? params.scope.county.slug : "",
      state_name: params.scope.level === "county" ? params.scope.county.state.name : params.scope.level === "state" ? params.scope.state.name : "",
      state_slug: params.scope.level === "county" ? params.scope.county.state.slug : params.scope.level === "state" ? params.scope.state.slug : "",
      submission_scope: params.scope.label,
      submission_level: params.scope.level,
      message: buildMessage(params.title, params.scope, params.values),
      page_url: window.location.href,
      submitted_at: new Date().toISOString(),
    },
    { publicKey: config.publicKey },
  );
}
