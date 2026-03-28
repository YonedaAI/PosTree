export interface Post {
  platform: string;
  type: 'post' | 'thread' | 'article';
  schedule?: string;
  tags?: string[];
  status: 'pending' | 'published' | 'draft';
  title?: string;
  image?: string;           // URL or local path to attach
  content: string;
  thread?: string[];
  file: string;
}
