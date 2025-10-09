import Stripe from "stripe";
import getRawBody from "raw-body";
import fs from "fs";
import path from "path";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false, // Important: Stripe requires raw body for signature verification
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // 1️⃣ Get the raw body
    const rawBody = await getRawBody(req);

    // 2️⃣ Get Stripe signature header
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      console.error("No stripe-signature header provided");
      return res.status(400).send("Missing stripe-signature header");
    }

    // 3️⃣ Verify Stripe event
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 4️⃣ Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_details.email;
      console.log("Webhook received for:", email);

      // 5️⃣ Generate unique token
      const token = Math.random().toString(36).substring(2, 10);

      // 6️⃣ Save token to users.json
      const filePath = path.join(process.cwd(), "data", "users.json");
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      data[token] = { email, created_at: new Date().toISOString() };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      // 7️⃣ Build feed URL
      const feedUrl = `https://${process.env.VERCEL_URL}/api/feed?token=${token}`;
      console.log("Feed URL:", feedUrl);

      // 8️⃣ Send to Zapier
      try {
        const response = await fetch(process.env.ZAPIER_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, feed_url: feedUrl }),
        });
        console.log("Sent to Zapier, status:", response.status);
      } catch (err) {
        console.error("Error sending to Zapier:", err.message);
      }
    }

    // 9️⃣ Respond to Stripe
    res.status(200).json({ received: true });

  } catch (err) {
    console.error("Unexpected error:", err.message);
    res.status(500).send("Internal Server Error");
  }
}
