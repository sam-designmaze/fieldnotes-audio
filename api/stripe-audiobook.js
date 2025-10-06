import Stripe from "stripe";
import fs from "fs";
import path from "path";

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

    // Fetch line items to confirm audiobook
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const hasAudiobook = lineItems.data.some((i) =>
      (i.description || "").toLowerCase().includes("audiobook")
    );

    if (hasAudiobook) {
      const token = Math.random().toString(36).substring(2, 10);
      const filePath = path.join(process.cwd(), "data", "users.json");
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      data[token] = { email, created_at: new Date().toISOString() };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      const feedUrl = `https://${process.env.VERCEL_URL}/api/feed?token=${token}`;

      // Notify Zapier webhook
      await fetch(process.env.ZAPIER_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, feed_url: feedUrl })
      });
    }
  }

  res.status(200).json({ received: true });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
