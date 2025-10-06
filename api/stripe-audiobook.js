import Stripe from "stripe";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details.email;
    const items = session.display_items || [];

    // Check if audiobook was purchased
    const hasAudiobook = items.some((item) =>
      (item.custom?.name || "").toLowerCase().includes("audiobook")
    );

    if (hasAudiobook) {
      const token = Math.random().toString(36).substring(2, 10);

      // Read + update user data
      const filePath = path.join(process.cwd(), "data", "users.json");
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      data[token] = { email, created_at: new Date().toISOString() };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      const feedUrl = `https://${process.env.VERCEL_URL}/api/feed?token=${token}`;

      // Send email via Vercel's SMTP-compatible mail relay (or Gmail if you prefer)
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const message = {
        from: `"Nathan Larson" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Field Notes Audiobook 🎧",
        text: `Hi there,\n\nHere’s your private audiobook feed:\n${feedUrl}\n\nAdd it to Apple Podcasts or Spotify.\n\nEnjoy,\nNathan`,
      };

      await transporter.sendMail(message);
    }
  }

  res.status(200).json({ received: true });
}

export const config = {
  api: {
    bodyParser: false, // Stripe requires raw body for signature verification
  },
};
