// ── Secure Email Renderer ──
// Renders HTML email content safely in a sandboxed iframe. Used by:
//   - reports/app_comms.js when the user opens a single email
//   - pipeline/runner.js when fetched-emails results are displayed
// Top-level function (not on Pipeline) so it's reachable from anywhere.

function renderEmailSecure(container, htmlContent, plainFallback) {
  const content = htmlContent || plainFallback || '';

  // If it doesn't look like HTML, just show as plain text
  if (!content.includes('<') || !content.includes('>')) {
    const pre = document.createElement('div');
    pre.className = 'pe-result-detail';
    pre.style.whiteSpace = 'pre-wrap';
    pre.textContent = content;
    container.appendChild(pre);
    return;
  }

  // Sanitize: strip dangerous elements and attributes
  let safe = content;

  // Remove script, iframe, object, embed, form, link, meta, base tags entirely
  safe = safe.replace(/<(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset)[^>]*>[\s\S]*?<\/\1>/gi, '');
  safe = safe.replace(/<(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset)[^>]*\/?>/gi, '');

  // Remove all event handler attributes (on*)
  safe = safe.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  safe = safe.replace(/\s+on\w+\s*=\s*\S+/gi, '');

  // Remove javascript: URLs
  safe = safe.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  safe = safe.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');

  // Block external images by default (tracking pixels) — replace src with data placeholder
  safe = safe.replace(/(<img[^>]*?)src\s*=\s*["']https?:\/\/[^"']*["']/gi,
    '$1src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Crect fill=\'%23ddd\' width=\'16\' height=\'16\'/%3E%3C/svg%3E" data-blocked="true"');

  // Remove style tags that could break out
  safe = safe.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Build sandboxed iframe
  const wrapper = document.createElement('div');
  wrapper.className = 'email-frame-wrap';

  const iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-same-origin'; // No scripts, no forms, no popups
  iframe.setAttribute('csp', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  iframe.style.cssText = 'width:100%;border:none;background:#fff;border-radius:4px;min-height:150px;';

  const srcdoc = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
<style>
  body { font-family: -apple-system, Arial, sans-serif; font-size: 14px; color: #222; padding: 12px; margin: 0; line-height: 1.5; word-break: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #4a90c4; }
  table { max-width: 100%; }
  * { max-width: 100% !important; }
</style></head><body>${safe}</body></html>`;

  iframe.srcdoc = srcdoc;

  // Auto-resize iframe to content height
  iframe.onload = () => {
    try {
      const h = iframe.contentDocument.body.scrollHeight;
      iframe.style.height = Math.min(Math.max(h + 20, 100), 400) + 'px';
    } catch (e) { iframe.style.height = '300px'; }
  };

  wrapper.appendChild(iframe);

  // "Load external images" button
  const imgBtn = document.createElement('button');
  imgBtn.className = 'email-load-images-btn';
  imgBtn.textContent = '🖼️ Load external images';
  imgBtn.addEventListener('click', () => {
    // Re-render with images unblocked
    const unblocked = content
      .replace(/<(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset)[^>]*\/?>/gi, '')
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+on\w+\s*=\s*\S+/gi, '')
      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

    const newSrcdoc = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;">
<style>
  body { font-family: -apple-system, Arial, sans-serif; font-size: 14px; color: #222; padding: 12px; margin: 0; line-height: 1.5; word-break: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #4a90c4; }
  table { max-width: 100%; }
  * { max-width: 100% !important; }
</style></head><body>${unblocked}</body></html>`;
    iframe.srcdoc = newSrcdoc;
    imgBtn.remove();
  });
  wrapper.appendChild(imgBtn);

  container.appendChild(wrapper);
}
