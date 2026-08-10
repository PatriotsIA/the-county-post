import type { FormEvent } from "react";
import { useRef, useState } from "react";
import type { CountySite } from "../data/counties";
import { site } from "../data/site";
import { sendStoryFormEmailFromForm } from "../lib/email";

export function ClassifiedSubmissionForm({ county }: { county: CountySite }) {
  const [form, setForm] = useState({ name: "", email: "", title: "", price: "", contact: "", details: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const image = formRef.current?.elements.namedItem("classified_image") as HTMLInputElement | null;
    const file = image?.files?.[0];

    if (file && !["image/jpeg", "image/png"].includes(file.type)) {
      setStatus("error");
      setError("Please upload a JPEG or PNG image.");
      return;
    }

    setStatus("sending");
    setError("");
    try {
      if (!formRef.current) throw new Error("The submission form is unavailable. Please try again.");
      await sendStoryFormEmailFromForm(formRef.current);
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
      <p className="muted">
        Upon Approval &amp; Payment your classified will be listed upon the county in which you submitted the classified. You will receive the Payment Link and Confirmation to the email provided in your submission.
      </p>
      <form ref={formRef} className="submission-form" encType="multipart/form-data" onSubmit={submit}>
        <input type="hidden" name="title" value={`Classified: ${form.title}`} />
        <input type="hidden" name="reply_to" value={form.email} />
        <input type="hidden" name="to_email" value={site.contact.email} />
        <input type="hidden" name="county_name" value={county.displayName} />
        <input type="hidden" name="county_slug" value={county.slug} />
        <input type="hidden" name="state_name" value={county.state.name} />
        <input type="hidden" name="state_slug" value={county.state.slug} />
        <input type="hidden" name="submission_scope" value={county.displayName} />
        <input type="hidden" name="submission_level" value="county" />
        <input
          type="hidden"
          name="message"
          value={[
            `Submission type: Classified: ${form.title}`,
            `Submission scope: ${county.displayName}`,
            `County: ${county.displayName}, ${county.state.name}`,
            `FIPS: ${county.fips}`,
            "",
            `name: ${form.name || "Not provided"}`,
            `email: ${form.email || "Not provided"}`,
            `title: ${form.title || "Not provided"}`,
            `price: ${form.price || "Not provided"}`,
            `contact: ${form.contact || "Not provided"}`,
            `details: ${form.details || "Not provided"}`,
          ].join("\n")}
        />
        <label>
          Your name
          <input name="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
        </label>
        <label>
          Listing title
          <input name="listing_title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="For sale: 2017 pickup truck" required />
        </label>
        <label>
          Price or terms
          <input name="price" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="$8,500 or best offer" required />
        </label>
        <label>
          Contact information for the listing
          <input name="contact" value={form.contact} onChange={(event) => setForm((current) => ({ ...current, contact: event.target.value }))} placeholder="Phone number or email" required />
        </label>
        <label>
          Listing details
          <textarea name="details" value={form.details} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} rows={6} required />
        </label>
        <label>
          Listing image (optional)
          <input name="classified_image" type="file" accept="image/jpeg,image/png" />
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
