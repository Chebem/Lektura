/**
 * In-memory store for the uploaded PDF, held server-side for the life of the
 * dev server.
 *
 * Why this exists: the provider takes the PDF natively, and re-uploading a
 * multi-megabyte base64 blob on every AI call (translation, each chat turn,
 * flashcards, quiz) would be wasteful. The browser uploads once, gets back an
 * id, and passes that id on subsequent calls.
 *
 * Consistent with the MVP's "no database" rule — this is a Map, and a server
 * restart clears it exactly like a page refresh clears React state.
 */

const documents = new Map();

/** Keep at most this many documents; oldest evicted first. */
const MAX_DOCUMENTS = 8;

export function putDocument({ name, mimeType, data, pageCount }) {
  const id = `doc_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  if (documents.size >= MAX_DOCUMENTS) {
    const oldest = documents.keys().next().value;
    documents.delete(oldest);
  }

  documents.set(id, {
    id,
    name,
    mimeType,
    data,
    pageCount: pageCount ?? null,
    bytes: Math.floor((data.length * 3) / 4),
    uploadedAt: Date.now(),
  });

  return documents.get(id);
}

export function getDocument(id) {
  return documents.get(id) ?? null;
}
