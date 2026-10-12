import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { buildDigest, renderDigest } from './content';
import { localDate, type Edition } from './model';

// Sending is explicit; building previews alone never sends mail or creates subscribers.
const recipient = process.argv.find(arg => arg.startsWith('--to='))?.slice(5);
const sender = process.argv.find(arg => arg.startsWith('--from='))?.slice(7);
if (recipient && !sender) throw new Error('Provide --from with a verified SES sender.');
await mkdir('previews', { recursive: true });
const ses = new SESv2Client({ region: 'us-east-2', maxAttempts: 1 });
for (const edition of [
  { level: 'national', timeZone: 'America/Chicago' },
  { level: 'state', state: 'texas', timeZone: 'America/Chicago' },
  { level: 'county', state: 'texas', county: 'potter', timeZone: 'America/Chicago' },
] as Edition[]) {
  const digest = process.argv.includes('--saved') ? JSON.parse(await readFile(`previews/${edition.level}.json`, 'utf8')) : await buildDigest(edition);
  digest.edition = edition;
  digest.catalog = JSON.parse(await readFile('../public/newsletter-catalog.json', 'utf8'));
  const rendered = renderDigest(digest, { date: localDate(edition.timeZone), timeZone: edition.timeZone, preview: true, address: process.env.NEWSLETTER_ADDRESS });
  await writeFile(`previews/${edition.level}.html`, rendered.html);
  await writeFile(`previews/${edition.level}.txt`, rendered.text);
  await writeFile(`previews/${edition.level}.json`, JSON.stringify(digest, null, 2));
  console.log(`${edition.level}: ${digest.sections.reduce((total: number, s: { stories: unknown[] }) => total + s.stories.length, 0)} stories, ${digest.forecasts.length} weather locations`);
  if (recipient) {
    const response = await ses.send(new SendEmailCommand({ FromEmailAddress: `The County Post <${sender}>`, Destination: { ToAddresses: [recipient] }, ReplyToAddresses: ['submissions@thecountypost.com'], Content: { Simple: { Subject: { Data: rendered.subject, Charset: 'UTF-8' }, Body: { Html: { Data: rendered.html, Charset: 'UTF-8' }, Text: { Data: rendered.text, Charset: 'UTF-8' } } } } }));
    console.log(`SES accepted ${edition.level} preview: ${response.MessageId}`);
  }
}
