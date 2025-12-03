/**
 * @file app/blog/page.tsx
 * @description The main Blog Listing Page.
 * Fetches MDX files from the file system and displays them in an "Editorial List" layout.
 */
import './blog-styles.css'; // Ensure this path matches your project structure
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter'; // parses frontmatter (yaml) from markdown
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';


// Interface representing the data structure of a blog post
interface BlogPost {
  slug: string;
  frontmatter: {
    title: string;
    description?: string;
    excerpt?: string;
    date: string;
    category?: string;
    tags?: string[];
  };
}

/**
 * Reads all MDX files from the content directory.
 * (new update - implemented file system reading logic)
 * * @returns {BlogPost[]} An array of sorted blog post objects
 */
function getPosts(): BlogPost[] {
  // Define path to content
  const postsDirectory = path.join(process.cwd(), 'content/posts');
  
  // Read directory
  const files = fs.readdirSync(postsDirectory);
  
  const posts = files.map((filename) => {
    // Read individual file content
    const markdownWithMeta = fs.readFileSync(path.join(postsDirectory, filename), 'utf-8');
    
    // Parse frontmatter
    const { data: frontmatter } = matter(markdownWithMeta);
    
    return {
      slug: filename.replace('.mdx', ''),
      frontmatter: frontmatter as BlogPost['frontmatter'],
    };
  });

  // Sort posts by date (Newest first)
  return posts.sort((a, b) => {
    return new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime();
  });
}

/**
 * Main Blog List Component
 */
export default function BlogList() {
  const posts = getPosts();

  return (
    <>
    <SiteHeader/>
    <div className="blog-container">
      {/* Page Header */}
      <header className="blog-header">
        <h1>Knowledge Library</h1>
        <p>Curated insights on learning, memory, and academic success.</p>
      </header>
      
      {/* Blog Posts List */}
      <div className="blog-list">
        {posts.map((post) => (
          /* (new update - applied editorial card styling) */
          <Link href={`/blog/${post.slug}`} key={post.slug} className="blog-card">
            {/* Visual Thumbnail (Placeholder logic - ideally dynamic based on category) */}
            <div className="blog-card-thumb">
               {/* Logic to choose icon based on category could go here */}
               {post.frontmatter.category === 'Spaced Repetition' ? '⚡' : '📚'}
            </div>
            
            {/* Content Body */}
            <div className="blog-card-content">
              <div className="blog-meta">
                <span className="blog-meta-tag">
                  {post.frontmatter.category || 'Article'}
                </span>
                <span className="blog-meta-date">
                  {new Date(post.frontmatter.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              
              <h3 className="blog-card-title">{post.frontmatter.title}</h3>
              
              {/* Fallback to description if excerpt is missing */}
              <p className="blog-card-excerpt">
                {post.frontmatter.excerpt || post.frontmatter.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
    <SiteFooter/>
    </>
  );
}