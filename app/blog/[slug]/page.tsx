/**
 * @file app/blog/[slug]/page.tsx
 * @description Renders a single blog post.
 * Uses Dynamic Routes [slug] to fetch specific content based on URL.
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { MDXRemote } from 'next-mdx-remote/rsc'; // Requires: npm install next-mdx-remote
import '../blog-styles.css'; 
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

// Define path to content
const POSTS_PATH = path.join(process.cwd(), 'content/posts');

interface Props {
  params: {
    slug: string;
  };
}

/**
 * 1. Generate Static Params (SSG)
 * Tells Next.js to build these pages at build time, not runtime.
 * (new update - implemented static site generation)
 */
export async function generateStaticParams() {
  const files = fs.readdirSync(POSTS_PATH);

  return files.map((filename) => ({
    slug: filename.replace('.mdx', ''),
  }));
}

/**
 * Helper to get post content
 */
function getPost({ slug }: { slug: string }) {
  const markdownFile = fs.readFileSync(path.join(POSTS_PATH, `${slug}.mdx`), 'utf-8');
  const { data: frontmatter, content } = matter(markdownFile);
  return {
    frontmatter,
    content,
    slug,
  };
}

/**
 * 2. Generate Metadata (SEO)
 * Dynamically generates title and description tags for Google.
 * (new update - added dynamic seo metadata)
 */
export async function generateMetadata({ params }: Props) {
  const post = getPost(params);
  
  return {
    title: `${post.frontmatter.title} | WiseGraph`,
    description: post.frontmatter.description,
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      type: 'article',
      publishedTime: post.frontmatter.date,
    }
  };
}

/**
 * 3. The Page Component
 */
export default function BlogPost({ params }: Props) {
  const props = getPost(params);

  return (
    <>
    <SiteHeader/>
    <article className="blog-container" style={{ marginTop: '60px' }}>
      {/* Article Header */}
      <header className="blog-header">
        <div className="blog-meta" style={{ justifyContent: 'center' }}>
           <span className="blog-meta-tag">{props.frontmatter.category || 'Blog'}</span>
           <span className="blog-meta-date">{props.frontmatter.date}</span>
        </div>
        <h1 style={{ marginBottom: '32px' }}>{props.frontmatter.title}</h1>
      </header>

      {/* Article Content (Prose) */}
      <div className="prose" style={{ fontFamily: 'var(--wg-font-serif)', fontSize: '1.125rem', lineHeight: '1.8' }}>
        {/* (new update - rendering mdx content) */}
        <MDXRemote source={props.content} />
      </div>
    </article>
    <SiteFooter/>
    </>
  );
}