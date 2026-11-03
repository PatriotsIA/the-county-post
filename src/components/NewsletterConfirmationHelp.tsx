export function NewsletterConfirmationHelp({ gift = false }: { gift?: boolean }) {
  return <div className="newsletter-confirmation-help">
    <p><strong>{gift ? 'Ask the recipient to check their email.' : 'Check your email to finish signing up.'}</strong> Look for The County Post at <strong>newsletters@thecountypost.com</strong> in the inbox. If it is missing, check <strong>Spam or Junk</strong>.</p>
    <ol>
      <li>Open the email and click its confirmation link.</li>
      <li>On The County Post website, click <strong>Confirm subscription</strong>. Wait for the confirmation message.</li>
    </ol>
    <p>If the email landed in Spam or Junk, mark it as <strong>Not spam</strong> and add newsletters@thecountypost.com to your contacts.</p>
    <p>The link is valid for 48 hours. We send one follow-up after 24 hours if confirmation is still pending. If the link expires, submit the signup form again for a new link.</p>
  </div>;
}
