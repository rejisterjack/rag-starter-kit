/**
 * Collaboration Module
 * 
 * Collaborative features for the RAG chatbot.
 */

// Sharing
export {
  createShareLink,
  getConversationByShareToken,
  revokeShareLink,
  listShareLinks,
  type ShareLink,
  type SharePermissions,
} from './sharing';

// Comments
export {
  addComment,
  getComments,
  resolveComment,
  deleteComment,
  type Comment,
} from './sharing';

// Annotations
export {
  addAnnotation,
  getAnnotations,
  type Annotation,
} from './sharing';

// Mentions
export {
  processMentions,
  getUnreadMentions,
  markMentionsAsRead,
  type Mention,
} from './sharing';
