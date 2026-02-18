import type { Job } from "bullmq";
import { Resend } from "resend";
import type { EmailJobData } from "../types.js";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, html } = job.data;

  console.log(`[email] Processing job ${job.id}: sending to ${to}`);

  if (resend) {
    const { error } = await resend.emails.send({
      from: "Workshop <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`[email] Job ${job.id}: email sent to ${to}`);
  } else {
    // Mock mode — no RESEND_API_KEY set
    console.log(`[email] Job ${job.id}: (mock) would send to ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  HTML length: ${html.length} chars`);

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
