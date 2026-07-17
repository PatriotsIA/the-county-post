import type { FormEvent } from "react";
import { useState } from "react";
import type { CountySite } from "../data/counties";
import { sendStoryFormEmail } from "../lib/email";

export function ClassifiedSubmissionForm({ county }: { county: CountySite }) {
  const [form, setForm] = useState({ name: "", email: "", title: "", price: "", contact: "", details: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      await sendStoryFormEmail({
        scope: { level: "county", label: county.displayName, county },
        title: `Classified: ${form.title}`,
        replyTo: form.email,
        values: {
          ...form,
          submissionType: "classified",
          countyName: county.displayName,
          stateName: county.state.name,
        },
      });
      setStatus("sent");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Could not send this classified. Please try again.");
    }
  }

  return (
    <section className="section">
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          <p className="kicker">County classifieds</p>
          <h2>Submit a listing</h2>
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>
      <p className="muted">Submit a local listing for editorial review before it appears in {county.displayName} classifieds.</p>
      <form className="submission-form" onSubmit={submit}>
        <label>
          Your name
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
        </label>
        <label>
          Listing title
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="For sale: 2017 pickup truck" required />
        </label>
        <label>
          Price or terms
          <input value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="$8,500 or best offer" required />
        </label>
        <label>
          Contact information for the listing
          <input value={form.contact} onChange={(event) => setForm((current) => ({ ...current, contact: event.target.value }))} placeholder="Phone number or email" required />
        </label>
        <label>
          Listing details
          <textarea value={form.details} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} rows={6} required />
        </label>
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Submit classified"}
        </button>
        {status === "sent" ? <p className="success">Received. The county desk will review your listing.</p> : null}
        {status === "error" ? <p className="error">{error}</p> : null}
      </form>
    </section>
  );
}
