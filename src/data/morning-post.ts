import type { NewsletterEdition } from '../lib/newsletter-api';

export const MORNING_POST_TITLE = 'The Morning Post | Free Daily Newsletter';
export const MORNING_POST_DESCRIPTION = 'Start your day with headlines, sports, obituaries and weather. Choose a free national, state or county Morning Post, delivered from 6:15 a.m.';
export const MORNING_POST_GIFT_PATH = '/morning-post#morning-post-gift';
export type EditionChoice = { label: string; edition: Omit<NewsletterEdition, 'timeZone'> };
export const nationalEdition: EditionChoice = { label: 'National edition', edition: { level: 'national' } };
