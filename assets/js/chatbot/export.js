// assets/js/chatbot/export.js
// PNEC Helper Bot v3 — Phase 4 conversation export.
//
// Three export formats (chosen via a small dialog):
//   • Markdown (.md) — preserves structure for re-import / sharing
//   • Plain text (.txt) — universal fallback
//   • Standalone HTML (.html) — pretty, printable, brand-styled,
//     opens in any browser even offline. Includes an embedded
//     conversation-style layout so it looks like the chat itself.
//
// The HTML export is the killer feature — gives users a permanent
// record of guidance during a stressful moment, and prints nicely.

function asMarkdown(convo) {
  const out = [];
  out.push(`# ${convo.title || 'Conversation'}`);
  out.push(`\n_Exported ${new Date().toLocaleString()} from PNEC Helper Bot._\n`);
  convo.messages.forEach(m => {
    const who = m.role === 'user' ? '**You**' : '**Helper Bot**';
    const ts  = new Date(m.timestamp).toLocaleString();
    out.push(`\n${who} · _${ts}_\n\n${m.content || ''}`);
    if (Array.isArray(m.citations) && m.citations.length) {
      out.push('\nSources:');
      m.citations.forEach((c, i) => out.push(`  ${i + 1}. ${c.label || c.url}`));
    }
  });
  out.push('\n\n---\nPoway Neighborhood Emergency Corps · powaynec.com');
  return out.join('\n');
}

function asPlainText(convo) {
  const out = [];
  out.push((convo.title || 'Conversation').toUpperCase());
  out.push(''.padEnd(60, '─'));
  out.push(`Exported ${new Date().toLocaleString()} from PNEC Helper Bot.\n`);
  convo.messages.forEach(m => {
    const who = m.role === 'user' ? 'YOU' : 'HELPER BOT';
    const ts  = new Date(m.timestamp).toLocaleString();
    out.push(`[${ts}] ${who}:`);
    out.push((m.content || '').split('\n').map(l => '  ' + l).join('\n'));
    out.push('');
  });
  out.push(''.padEnd(60, '─'));
  out.push('Poway Neighborhood Emergency Corps · powaynec.com');
  return out.join('\n');
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
  );
}

function asStandaloneHtml(convo) {
  const headers = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(convo.title || 'PNEC Conversation')}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#fbf8f1; color:#0a1628; margin:0; padding:40px 20px; }
  .wrap { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 18px; padding: 32px 28px; box-shadow: 0 1px 0 rgba(255,255,255,0.65) inset, 0 8px 22px rgba(20,90,50,0.10), 0 28px 56px rgba(20,90,50,0.12); }
  header { border-bottom: 1px solid rgba(20,90,50,0.18); padding-bottom: 16px; margin-bottom: 22px; }
  header .ribbon { height: 4px; border-radius: 2px; background: linear-gradient(90deg, #145a32 0%, #1e8449 50%, #27ae60 100%); margin-bottom: 14px; }
  header h1 { margin: 0 0 6px; font-size: 1.4rem; font-weight: 800; color: #0a1628; letter-spacing: -0.02em; }
  header .meta { font-size: 0.84rem; color: #5a6975; }
  .msg { display: grid; grid-template-columns: 32px 1fr; gap: 10px; margin-bottom: 18px; }
  .avatar { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px; font-weight: 800; font-size: 0.78rem; flex-shrink: 0; }
  .msg.user .avatar  { background: linear-gradient(135deg, #fef2f2 0%, #fde6e1 100%); color: #c0392b; border: 1px solid rgba(192,57,43,0.20); }
  .msg.bot  .avatar  { background: linear-gradient(135deg, #1e8449 0%, #145a32 100%); color: #fff; }
  .bubble { padding: 10px 14px; border-radius: 14px; line-height: 1.55; font-size: 0.96rem; }
  .msg.user .bubble  { background: linear-gradient(135deg, #1e8449 0%, #145a32 100%); color: #fff; }
  .msg.bot  .bubble  { background: #f4f7f5; color: #0a1628; }
  .meta-row { font-size: 0.74rem; color: #8b96a1; margin-top: 4px; }
  footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid rgba(20,90,50,0.10); text-align: center; font-size: 0.78rem; color: #5a6975; }
  footer a { color: #145a32; text-decoration: none; font-weight: 700; }
  @media print {
    body { background: #fff; padding: 0; }
    .wrap { box-shadow: none; padding: 0; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="ribbon"></div>
      <h1>${escapeHtml(convo.title || 'PNEC Conversation')}</h1>
      <p class="meta">Exported ${escapeHtml(new Date().toLocaleString())} · PNEC Helper Bot</p>
    </header>`;
  const body = convo.messages.map(m => {
    const who = m.role === 'user' ? 'You' : 'Helper Bot';
    const initials = m.role === 'user' ? 'YOU' : 'HB';
    const ts = new Date(m.timestamp).toLocaleString();
    const content = escapeHtml(m.content || '').replace(/\n/g, '<br>');
    return `
    <div class="msg ${m.role === 'user' ? 'user' : 'bot'}">
      <div class="avatar">${initials}</div>
      <div>
        <div class="bubble">${content}</div>
        <div class="meta-row">${escapeHtml(who)} · ${escapeHtml(ts)}</div>
      </div>
    </div>`;
  }).join('');
  const footer = `
    <footer>
      <a href="https://powaynec.com">Poway Neighborhood Emergency Corps</a>
      · Neighbors helping neighbors prepare
    </footer>
  </div>
</body>
</html>`;
  return headers + body + footer;
}

export function exportConversation(convo) {
  if (!convo || !convo.messages?.length) {
    alert('Nothing to export — start a conversation first.');
    return;
  }
  // Tiny in-page picker so we don't add a dependency
  const fmt = (window.prompt(
    "Export as:\n  m = markdown\n  t = plain text\n  h = pretty HTML (recommended)\n",
    'h'
  ) || 'h').toLowerCase().slice(0, 1);
  const title = (convo.title || 'pnec-helper-bot').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  if (fmt === 'm') {
    download(asMarkdown(convo), `${title}.md`, 'text/markdown');
  } else if (fmt === 't') {
    download(asPlainText(convo), `${title}.txt`, 'text/plain');
  } else {
    download(asStandaloneHtml(convo), `${title}.html`, 'text/html');
  }
}

function download(text, filename, mime) {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}
