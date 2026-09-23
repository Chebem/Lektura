import { handleUpload } from '../../server/handlers.js';
import { createFunction } from './_shared.mjs';

// Returns an upload target. For Gemini this is a resumable-upload URL the
// browser sends bytes to directly, so large PDFs never hit Netlify's ~6MB
// function request-body limit.
export default createFunction(handleUpload);
