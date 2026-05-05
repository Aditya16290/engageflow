import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function createSEOBlogPost() {
  const content = `
# Mastering Website Ranking: The 2026 SEO Blueprint

In the rapidly evolving digital landscape, website ranking is no longer just about keywords and backlinks. It's about AI-driven relevance, user experience signals, and technical precision. As we move deeper into 2026, the rules of the game have shifted.

## 1. AI-Powered Content Relevance
Google and other major search engines now use advanced Large Language Models (LLMs) to understand intent better than ever. "Thin" content is a relic of the past. To rank high, your content must:
- Answer multiple related user questions in a single piece.
- Provide unique data or insights that AI cannot easily scrape.
- Use a natural, authoritative voice.

## 2. Core Web Vitals are Non-Negotiable
Speed is no longer an "extra"—it's a requirement. LCP (Largest Contentful Paint), FID (First Input Delay), and CLS (Cumulative Layout Shift) are prime ranking factors. If your site takes more than 2 seconds to load, you are losing positions.

## 3. Topical Authority Over Individual Backlinks
Building a "cluster" of content around a specific niche is more effective than getting random high-authority links. By creating a pillar page and supporting articles, you signal to search engines that you are an expert in that specific domain.

## 4. The Rise of Zero-Click Searches
Optimizing for featured snippets is crucial. Many users get their answers directly from the search results page. By structuring your content with clear H2/H3 tags and concise definitions, you increase your chances of appearing at the very top.

## Conclusion
Website ranking in 2026 requires a holistic approach. Combine technical excellence with deep, AI-resistant expertise, and you'll dominate the search engine result pages (SERPs).
  `;

  try {
    await addDoc(collection(db, 'blogPosts'), {
      title: "Mastering Website Ranking: The 2026 SEO Blueprint",
      excerpt: "Unlock the secrets to dominating Google in 2026 with our comprehensive guide to AI-driven SEO and technical excellence.",
      content: content.trim(),
      tag: "SEO",
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      authorId: "adityakumar16290@gmail.com",
      createdAt: serverTimestamp(),
    });
    console.log("SEO Blog Post created successfully!");
  } catch (e) {
    console.error("Error creating post:", e);
  }
}

createSEOBlogPost();
