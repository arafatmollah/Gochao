import { GITHUB_OWNER, GITHUB_REPO } from './app-update';

/**
 * Feedback report builder. The app has no backend, so reports are submitted
 * by opening a prefilled GitHub issue (or copying the text) — the review
 * step shows the exact title and body first, so nothing is ever shared
 * blindly.
 */

export const FEEDBACK_CATEGORIES = ['bug', 'suggestion'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface FeedbackDeviceInfo {
  appVersion: string;
  brand: string | null;
  model: string | null;
  os: string;
  locale: string;
  theme: string;
}

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  includeDiagnostics: boolean;
  info: FeedbackDeviceInfo;
}

export interface FeedbackReport {
  title: string;
  body: string;
}

function describeDevice(info: FeedbackDeviceInfo): string {
  const device = [info.brand, info.model].filter((part) => part && part.trim() !== '').join(' ');
  return [
    `App version: ${info.appVersion}`,
    `Device: ${device === '' ? 'Unknown' : device}`,
    `OS: ${info.os}`,
    `Language: ${info.locale}`,
    `Theme: ${info.theme}`,
  ].join('\n');
}

/** Exact title + body the user reviews before anything is shared. */
export function buildFeedbackReport(input: FeedbackInput): FeedbackReport {
  const message = input.message.trim();
  const title = `[${input.category === 'bug' ? 'Bug' : 'Suggestion'}] ${message.split('\n')[0]?.slice(0, 60) ?? 'Gochao feedback'}`;
  const body = input.includeDiagnostics
    ? `${message}\n\n---\n${describeDevice(input.info)}`
    : message;
  return { title, body };
}

/** Prefilled GitHub issue URL used as the no-backend submit channel. */
export function feedbackIssueUrl(report: FeedbackReport): string {
  const params = new URLSearchParams({ title: report.title, body: report.body });
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new?${params.toString()}`;
}
