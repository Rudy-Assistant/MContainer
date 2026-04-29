/**
 * downloadBlob.ts — Single-source-of-truth helper for triggering a browser
 * file download from a Blob. Replaces six near-identical implementations
 * across constructionDocs, photorealCapture, tourVideoRecorder,
 * SettingsMenuControl, and exportGLB.
 *
 * Includes a delayed `revokeObjectURL` so the download has time to start
 * in slower browsers before the URL is invalidated.
 */

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
