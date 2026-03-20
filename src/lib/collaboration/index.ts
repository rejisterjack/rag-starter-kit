/**
 * Collaboration Module
 *
 * Collaborative features for the RAG chatbot.
 */

// Sharing
// Comments
// Annotations
// Mentions
export {
  type Annotation,
  addAnnotation,
  addComment,
  type Comment,
  createShareLink,
  deleteComment,
  getAnnotations,
  getComments,
  getConversationByShareToken,
  getUnreadMentions,
  listShareLinks,
  type Mention,
  markMentionsAsRead,
  processMentions,
  resolveComment,
  revokeShareLink,
  type ShareLink,
  type SharePermissions,
} from './sharing';
