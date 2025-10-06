import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const { token } = req.query;
  const filePath = path.join(process.cwd(), "data", "users.json");
  const users = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (!users[token]) {
    res.status(403).send("Invalid token");
    return;
  }

  const tracks = [
    { title: "Introduction", url: "https://www.dropbox.com/s/abc123/intro.mp3?dl=1" },
    { title: "Chapter 1", url: "https://www.dropbox.com/s/def456/ch1.mp3?dl=1" },
    { title: "Chapter 2", url: "https://www.dropbox.com/s/ghi789/ch2.mp3?dl=1" },
  ];

  res.setHeader("Content-Type", "application/rss+xml");

  const rss = `
    <?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Field Notes Audiobook</title>
        <link>https://nathanlarson.com</link>
        <description>Private feed for Field Notes audiobook listeners.</description>
        ${tracks
          .map(
            (t) => `
            <item>
              <title>${t.title}</title>
              <enclosure url="${t.url}" type="audio/mpeg"/>
              <guid>${t.url}</guid>
            </item>`
          )
          .join("")}
      </channel>
    </rss>
  `;

  res.send(rss);
}
