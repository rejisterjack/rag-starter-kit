import { serve } from 'inngest/next';

import { inngest } from '@/lib/inngest/client';
import {
  processDocumentJob,
  retryIngestionJob,
  bulkIngestJob,
  cleanupStaleJobs,
} from '@/lib/inngest/functions';

// Create an API that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processDocumentJob,
    retryIngestionJob,
    bulkIngestJob,
    cleanupStaleJobs,
  ],
});
