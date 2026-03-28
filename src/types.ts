export interface Post {
  platform: string;
  type: 'post' | 'thread' | 'article';
  schedule?: string;
  tags?: string[];
  status: 'pending' | 'published' | 'draft';
  title?: string;
  content: string;
  thread?: string[];
  file: string;
}
