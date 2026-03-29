Must haves:
1. robots.txt — doesn't exist at all. A simple one pointing to your sitemap helps crawlers and is expected.
2. Canonical <link> tag — ?q=merge and ?q=MERGE are technically different URLs. A dynamic canonical tag prevents Google from splitting index authority between them.
3. replaceState vs pushState — currently if you search SELECT then MERGE, the back button doesn't take you back to SELECT. Swapping replaceState → pushState fixes that in ~2 characters.
4. Caching headers in vercel.json — data.json and og-image.png are never going to change between deploys, but there are no cache headers set, so they get re-fetched every time. Easy win for performance (which is a ranking signal).
5. ensure this document itself doesn't deploy

Nice to haves:
- JSON-LD structured data — marking up each command page with schema.org WebApplication or TechArticle structured data is what unlocks rich results / featured snippets in Google. Highest effort but highest reward of anything left.
- No .catch() on the fetch('data.json') call — if the fetch fails, the page silently breaks with no feedback to the user.