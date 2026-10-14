import { buildFeedbackReport, feedbackIssueUrl } from '@/services/feedback';

const INFO = {
  appVersion: '1.0.0',
  brand: 'Google',
  model: 'Pixel 8',
  os: 'Android 15',
  locale: 'en',
  theme: 'dark',
};

describe('feedback report', () => {
  it('builds a titled report with diagnostics for review', () => {
    const report = buildFeedbackReport({
      category: 'bug',
      message: 'Prayer times are an hour late\non my phone.',
      includeDiagnostics: true,
      info: INFO,
    });

    expect(report.title).toBe('[Bug] Prayer times are an hour late');
    expect(report.body).toContain('Prayer times are an hour late\non my phone.');
    expect(report.body).toContain('App version: 1.0.0');
    expect(report.body).toContain('Device: Google Pixel 8');
    expect(report.body).toContain('OS: Android 15');
    expect(report.body).toContain('Theme: dark');
  });

  it('omits diagnostics when toggled off and handles unknown devices', () => {
    const report = buildFeedbackReport({
      category: 'suggestion',
      message: 'Add widgets',
      includeDiagnostics: false,
      info: { ...INFO, brand: null, model: null },
    });

    expect(report.title).toBe('[Suggestion] Add widgets');
    expect(report.body).toBe('Add widgets');
  });

  it('builds a prefilled GitHub issue URL', () => {
    const url = feedbackIssueUrl({ title: '[Bug] X', body: 'a\nb' });

    expect(url).toBe(
      'https://github.com/arafatmollah/Gochao/issues/new?title=%5BBug%5D+X&body=a%0Ab',
    );
  });
});
