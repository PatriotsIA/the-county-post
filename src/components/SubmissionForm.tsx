import type { FormEvent } from "react";
import { useState } from "react";
import type { CountySite } from "../data/counties";
import { sendCountyFormEmail } from "../lib/email";

type Props = {
  county: CountySite;
};

export function SubmissionForm({ county }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    headline: "",
    body: "",
    allowFollowUp: true,
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string>("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");

    try {
      await sendCountyFormEmail({
        county,
        title: form.headline || "Reader submission",
        replyTo: form.email,
        values: {
          name: form.name,
          email: form.email,
          headline: form.headline,
          body: form.body,
          allowFollowUp: form.allowFollowUp,
        },
      });
      setStatus("sent");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Could not send this submission. Please try again.");
    }
  }

  return (
    <section className="section">
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          <p className="kicker">Contribute</p>
          <h2>Send a story to the desk</h2>
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>
      <p className="muted">
        Share local reporting, op-eds, investigations, public notices, or upcoming events. We read every submission for{" "}
        {county.displayName}.
      </p>
      <form className="submission-form" onSubmit={handleSubmit}>
        <label>
          Your name
          <input
            name="name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Pat Jordan"
            required
          />
        </label>
        <label>
          Email for follow-up
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          Headline or topic
          <input
            name="headline"
            value={form.headline}
            onChange={(event) => setForm((prev) => ({ ...prev, headline: event.target.value }))}
            placeholder="School board votes on library updates"
            required
          />
        </label>
        <label>
          Story details
          <textarea
            name="body"
            value={form.body}
            onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
            rows={6}
            placeholder="Key facts, links, quotes, dates, and contacts."
            required
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.allowFollowUp}
            onChange={(event) => setForm((prev) => ({ ...prev, allowFollowUp: event.target.checked }))}
          />
          <span>Editors may contact me for verification</span>
        </label>
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Submit to the newsroom"}
        </button>
        {status === "sent" ? <p className="success">Received. Thank you for sharing your reporting.</p> : null}
        {status === "error" ? <p className="error">{error}</p> : null}
      </form>
    </section>
  );
}
