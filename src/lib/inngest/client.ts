import { Inngest } from 'inngest';

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'rag-starter-kit',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Define event types
type Events = {
  'document/ingest': {
    data: {
      documentId: string;
      userId: string;
    };
  };
  'document/processed': {
    data: {
      documentId: string;
      userId: string;
      success: boolean;
      error?: string;
    };
  };
};
