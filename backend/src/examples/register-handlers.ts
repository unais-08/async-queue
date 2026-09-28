import { register } from '../handlers';
import { generatePdfHandler } from './generate-pdf.handler';

// An application imports its handlers and registers only the job types it owns.
register('generate_pdf', generatePdfHandler);
