# TimeSheet Pro

Log hours → manager sign-off → share with the client. Built from the "TimeSheet Pro" Claude Design mockup.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Auth + Postgres) · jsPDF · ExcelJS

## Flow

1. **Employee** logs daily hours (weekdays only, any decimal like 7.75) against a category and a project phase.
2. Submission is blocked until every weekday in the period has hours, no day is over 12 h, and every entry has a category and description.
3. **Reporting manager** reviews the queue and either approves or sends it back with a required comment. A returned sheet becomes editable again, and resubmitting bumps the version (v2, v3…).
4. Manager opens **Send to client**: downloads the PDF, emails it to the client contact, then marks it as sent. That closes the period.
5. Every step is written to the audit trail with who and when. Times are shown in IST.

| Employee pages | Manager pages |
| --- | --- |
| Dashboard, Time Entry, Weekly Summary, Timesheet Preview, History, Project & Client | Review Queue, Send to Client, Weekly Summary, Timesheet Preview, History, Project & Client (read-only) |

Periods run from the 28th to the 27th of the next month. Timesheets export as PDF and Excel from Preview and History.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL, publishable key, service role key, SEED_PASSWORD
```

Apply the schema in `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`), then:

```bash
npm run seed   # demo manager + 3 employees with history (password = SEED_PASSWORD)
npm run dev
```

Demo accounts: `lakshmi@timesheet.test` (manager), `harish@`, `sneha@`, `arjun@timesheet.test` (employees).

## Security model

All tables have RLS enabled with **no policies**, so the browser can't read or write them directly. Every query runs server-side
(server components and server actions in `src/lib`) with the service role key, after checking the signed-in user's
ownership or manager relationship. The service role key must never be exposed with a `NEXT_PUBLIC_` prefix.

## Not done yet

- Real email delivery. "Send to client" opens your mail app (`mailto:`) and you attach the PDF yourself. An email provider (e.g. Resend) could send it with the attachment.
- Open sign-up: anyone can register as a manager. Restrict this, for example to an email domain or admin approval, before going live.
