import React from 'react';
import './ForumPost.css';

export interface Tag {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'accent';
}

export interface ForumPostData {
  id: string;
  title: string;
  tags: Tag[];
  author: string;
  timeAgo: string;
  replyCount: number;
}

interface ForumPostProps {
  post: ForumPostData;
  onPostClick?: (postId: string) => void;
}

interface ForumListProps {
  posts: ForumPostData[];
  onPostClick?: (postId: string) => void;
  onNewPost?: () => void;
  onFilterByMap?: () => void;
}

export const ForumPost: React.FC<ForumPostProps> = ({ post, onPostClick }) => {
  const handlePostClick = () => {
    if (onPostClick) {
      onPostClick(post.id);
    }
  };

  return (
    <div className="forum-post" onClick={handlePostClick}>
      <div className="tag-container">
        {post.tags.map((tag) => (
          <span key={tag.id} className={`tag tag-${tag.type}`}>
            {tag.label}
          </span>
        ))}
      </div>
      <div className="post-title">{post.title}</div>
      <div className="post-meta">
        <span>
          Posted by <span className="author">{post.author}</span> • {post.timeAgo}
        </span>
        <span className="replies">
          {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
        </span>
      </div>
    </div>
  );
};

export const ForumList: React.FC<ForumListProps> = ({
  posts,
  onPostClick,
  onNewPost,
  onFilterByMap,
}) => {
  return (
    <div className="forum-container">
      <div className="forum-header">
        <h1>Discussion Forum</h1>
        <p>Color-coded tags for quick map/concept identification with minimal vertical space</p>
      </div>

      <div className="forum-posts">
        {posts.map((post) => (
          <ForumPost
            key={post.id}
            post={post}
            onPostClick={onPostClick}
          />
        ))}
      </div>

      <div className="forum-actions">
        <button className="btn btn-primary" onClick={onNewPost}>
          + New Post
        </button>
        <button className="btn btn-secondary" onClick={onFilterByMap}>
          Filter by Map
        </button>
      </div>
    </div>
  );
};

// Example usage component
export const ForumExample: React.FC = () => {
  const samplePosts: ForumPostData[] = [
    {
      id: '1',
      title: 'Can anyone remember the source our professor gave for this?',
      tags: [
        { id: '1', label: 'Understanding Families in Contemporary Society', type: 'primary' },
        { id: '2', label: 'The Impact of Family Structure on Child Development', type: 'secondary' },
      ],
      author: 'Sarah M.',
      timeAgo: '2 hours ago',
      replyCount: 2,
    },
    {
      id: '2',
      title: 'Confused about the intersectionality framework discussion',
      tags: [
        { id: '3', label: 'Understanding Families in Contemporary Society', type: 'primary' },
        { id: '4', label: 'Gender Dynamics in Domestic Violence', type: 'secondary' },
      ],
      author: 'Alex K.',
      timeAgo: '4 hours ago',
      replyCount: 1,
    },
    {
      id: '3',
      title: 'Are there any recent studies on income inequality and family stability?',
      tags: [
        { id: '5', label: 'Understanding Families in Contemporary Society', type: 'primary' },
        { id: '6', label: 'The Role of Socioeconomic Factors', type: 'secondary' },
        { id: '7', label: 'Research', type: 'accent' },
      ],
      author: 'Jordan P.',
      timeAgo: '6 hours ago',
      replyCount: 0,
    },
    {
      id: '4',
      title: 'What are the most effective family therapy approaches mentioned in class?',
      tags: [
        { id: '8', label: 'Understanding Families in Contemporary Society', type: 'primary' },
        { id: '9', label: 'Intervention Strategies', type: 'secondary' },
        { id: '10', label: 'Discussion', type: 'accent' },
      ],
      author: 'Taylor S.',
      timeAgo: '8 hours ago',
      replyCount: 3,
    },
  ];

  const handlePostClick = (postId: string) => {
    console.log('Post clicked:', postId);
    // Handle post click - navigate to post detail, open modal, etc.
  };

  const handleNewPost = () => {
    console.log('New post clicked');
    // Handle new post creation
  };

  const handleFilterByMap = () => {
    console.log('Filter by map clicked');
    // Handle filtering logic
  };

  return (
    <ForumList
      posts={samplePosts}
      onPostClick={handlePostClick}
      onNewPost={handleNewPost}
      onFilterByMap={handleFilterByMap}
    />
  );
};