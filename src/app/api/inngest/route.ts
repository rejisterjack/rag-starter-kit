import { serve } from 'inngest/next';

import { inngest } from '@/lib/inngest/client';
import {
  bulkIngestJob,
  cleanupStaleJobs,
  nightlyDbCleanupJob,
  processDocumentJob,
  retryIngestionJob,
} from '@/lib/inngest/functions';

// Create an API that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processDocumentJob,
    retryIngestionJob,
    bulkIngestJob,
    cleanupStaleJobs,
    nightlyDbCleanupJob,
  ],
});
