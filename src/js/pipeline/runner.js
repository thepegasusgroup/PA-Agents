// ── Pipeline execution engine ──
// Walks a desk pipeline in topological order, dispatching a worker to the desk
// and executing each node's behavior (Gmail fetch/filter/send, Ollama AI calls).
// Results show in the editor's bottom panel; HITL-flagged items push to the
// queue via _pushToHITL (defined in pipeline/hitl.js).

Pipeline._runCurrentPipeline = async function () {
  if (!this._currentObjId) return;
  await this.runDeskPipeline(this._currentObjId);
};

Pipeline._runRoomPipeline = async function () {
  if (!this._currentRoomId) return;
  await this.runRoomPipeline(this._currentRoomId);
};

Pipeline.runDeskPipeline = async function (objId) {
  const pipeline = AppState.pipelines[objId];
  if (!pipeline || pipeline.nodes.length === 0) return;

  const obj = AppState.objects.find(o => o.id === objId);
  if (!obj) return;
  const room = AppState.getRoomAt(obj.gx, obj.gy);
  if (!room) return;

  // Find an idle worker in this room
  const workers = AppState.getWorkersInRoom(room.id);
  const worker = workers.find(w => w.state === 'idle' || w.state === 'walking') || workers[0];
  if (!worker) return;

  // Dispatch worker to desk
  worker.targetX = obj.gx + 0.5;
  worker.targetY = obj.gy + 0.5;
  worker.state = 'walking';

  // Wait for worker to arrive (poll)
  await new Promise(resolve => {
    const check = setInterval(() => {
      const dx = worker.x - worker.targetX;
      const dy = worker.y - worker.targetY;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5 || worker.state === 'sitting' || worker.state === 'working') {
        clearInterval(check);
        resolve();
      }
    }, 100);
    // Safety timeout
    setTimeout(() => { clearInterval(check); resolve(); }, 10000);
  });

  worker.seatObj = obj;
  worker.state = 'working';
  if (typeof Reports !== 'undefined') Reports.log('worker', `${worker.name} sat down at desk #${objId}`);

  // Build execution order from connections (topological sort)
  const execOrder = this._topologicalSort(pipeline);

  // Execute each node
  let context = {};
  for (const node of execOrder) {
    worker.taskLabel = node.label + '...';
    Grid._updateWorkerPanel();

    try {
      context = await this._executeNode(node, context);
      if (typeof Reports !== 'undefined') Reports.log('pipeline', `✓ ${node.label} complete`);
    } catch (err) {
      console.error('Pipeline node error:', node.label, err);
      if (typeof Reports !== 'undefined') Reports.log('pipeline', `✗ ${node.label} failed: ${err.message}`, 'error');
      worker.taskLabel = 'Error: ' + (err.message || err);
      await new Promise(r => setTimeout(r, 2000));
      break;
    }

    // Brief pause between nodes for visual feedback
    await new Promise(r => setTimeout(r, 500));
  }

  // Done — release worker
  worker.state = 'idle';
  worker.taskLabel = null;
  worker.seatObj = null;
  Grid._updateWorkerPanel();

  // Show results
  this._lastContext = context;
  this._showResults(context);
};

Pipeline.runRoomPipeline = async function (roomId) {
  const rp = AppState.roomPipelines[roomId];
  if (!rp || !rp.deskOrder || rp.deskOrder.length === 0) return;

  for (const objId of rp.deskOrder) {
    await this.runDeskPipeline(objId);
  }
};

Pipeline._topologicalSort = function (pipeline) {
  // Simple: follow connections from nodes with no inputs first
  const visited = new Set();
  const result = [];

  const visit = (nodeId) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    // Visit dependencies first
    for (const conn of pipeline.connections) {
      if (conn.toId === nodeId) visit(conn.fromId);
    }
    const node = pipeline.nodes.find(n => n.id === nodeId);
    if (node) result.push(node);
  };

  // Start from nodes with no outgoing connections (sinks), or just visit all
  for (const node of pipeline.nodes) {
    visit(node.id);
  }
  return result;
};

Pipeline._executeNode = async function (node, context) {
  const api = window.electronAPI?.gmail;

  switch (node.type) {
    case 'gmail_fetch': {
      if (!api) {
        throw new Error('Gmail API not available');
      }
      const auth = await api.isAuthenticated();
      if (!auth) {
        // Don't auto-open popup — user must sign in via the Comms panel first
        throw new Error('Gmail not authenticated — sign in via the phone app first');
      }
      const result = await api.listMessages(node.params.maxResults || 10);
      if (!result.success) throw new Error(result.error || 'Failed to fetch');
      context.emails = result.data;
      console.log('[Pipeline] Fetched', result.data.length, 'emails');
      if (typeof Reports !== 'undefined') {
        Reports.log('gmail', `Fetched ${result.data.length} emails`);
        Reports.setEmails(result.data);
      }
      return context;
    }

    case 'gmail_read': {
      if (!api) throw new Error('Gmail API not available');
      if (context.emails && context.emails.length > 0) {
        const first = context.emails[0];
        const result = await api.getMessage(first.id);
        if (result.success) {
          context.currentEmail = result.data;
          console.log('[Pipeline] Read email:', result.data.subject);
        }
      }
      return context;
    }

    case 'gmail_filter': {
      if (!context.emails) return context;
      const field = node.params.field || 'from';
      const contains = (node.params.contains || '').toLowerCase();
      if (!contains) return context;
      context.matched = context.emails.filter(e => {
        const val = (e[field] || '').toLowerCase();
        return val.includes(contains);
      });
      context.unmatched = context.emails.filter(e => {
        const val = (e[field] || '').toLowerCase();
        return !val.includes(contains);
      });
      console.log('[Pipeline] Filtered:', context.matched.length, 'matched');
      return context;
    }

    case 'gmail_send':
    case 'gmail_reply':
      console.log('[Pipeline] Send/Reply not yet implemented');
      return context;

    // ── AI Nodes ──
    case 'ai_classify': {
      const ollama = window.electronAPI?.ollama;
      if (!ollama) throw new Error('Ollama API not available');

      const avail = await ollama.isAvailable();
      if (!avail.available) throw new Error('Ollama not running. Start it with: ollama serve');

      const emails = context.emails || [];
      if (emails.length === 0) return context;

      const categories = node.params.categories || 'important, routine, spam';
      const memory = this._getWorkerMemory();
      const memoryContext = memory.length > 0
        ? '\n\nHere are examples of past classifications the user corrected:\n' +
          memory.slice(-10).map(m => `- "${m.subject}" from ${m.from} → user said: ${m.correction}`).join('\n')
        : '';

      // Batch all emails into one prompt
      const emailList = emails.slice(0, 10).map((e, i) =>
        `${i + 1}. From: ${e.from || 'unknown'} | Subject: ${e.subject || '(none)'} | Snippet: ${(e.snippet || '').substring(0, 100)}`
      ).join('\n');

      const prompt = `/no_think\nClassify each email into one of these categories: ${categories}
${memoryContext}

Emails:
${emailList}

Respond with ONLY a numbered list like:
1. category
2. category
...
Nothing else.`;

      const result = await ollama.generate(prompt, { temperature: 0.1, maxTokens: 200 });
      if (!result.success) throw new Error(result.error);

      // Parse response
      const lines = result.data.response.split('\n').filter(l => l.trim());
      context.classified = [];
      for (let i = 0; i < emails.slice(0, 10).length; i++) {
        const email = emails[i];
        let classification = 'routine';
        if (lines[i]) {
          // Extract category from "1. spam" or "1. important" etc
          const match = lines[i].match(/\d+\.\s*(.+)/);
          classification = match ? match[1].trim().toLowerCase() : lines[i].trim().toLowerCase();
        }
        context.classified.push({ ...email, classification });
        if (typeof Reports !== 'undefined') {
          Reports.log('gmail', `"${email.subject}" → ${classification}`);
        }
      }

      // Push to HITL queue for user review
      this._pushToHITL(context.classified);
      return context;
    }

    case 'ai_summarize': {
      const ollama = window.electronAPI?.ollama;
      if (!ollama) throw new Error('Ollama API not available');

      const emails = context.emails || context.classified || [];
      if (emails.length === 0) return context;

      const style = node.params.style || 'brief';
      const styleInstructions = {
        brief: 'one short sentence each',
        detailed: '2-3 sentences each',
        'bullet-points': '2-3 bullet points each',
      };

      // Batch into one prompt
      const emailList = emails.slice(0, 8).map((e, i) =>
        `${i + 1}. From: ${e.from || 'unknown'} | Subject: ${e.subject || '(none)'} | Content: ${(e.snippet || '').substring(0, 150)}`
      ).join('\n');

      const prompt = `/no_think\nSummarize each email (${styleInstructions[style]}):

${emailList}

Respond with a numbered list of summaries:`;

      const result = await ollama.generate(prompt, { temperature: 0.2, maxTokens: 800 });
      if (!result.success) throw new Error(result.error);

      const lines = result.data.response.split(/\n(?=\d+\.)/).filter(l => l.trim());
      context.summaries = [];
      for (let i = 0; i < emails.slice(0, 8).length; i++) {
        const email = emails[i];
        let summary = '';
        if (lines[i]) {
          const match = lines[i].match(/\d+\.\s*(.+)/s);
          summary = match ? match[1].trim() : lines[i].trim();
        }
        context.summaries.push({ ...email, summary });
      }
      return context;
    }

    case 'ai_decide': {
      const ollama = window.electronAPI?.ollama;
      if (!ollama) throw new Error('Ollama API not available');

      const emails = context.classified || context.emails || [];
      if (emails.length === 0) return context;

      const actions = node.params.actions || 'flag_important, archive, notify_user, draft_reply';
      const memory = this._getWorkerMemory();
      const memoryContext = memory.length > 0
        ? '\n\nPast decisions the user approved or corrected:\n' +
          memory.slice(-8).map(m => `- "${m.subject}" (${m.classification || 'unknown'}) → action: ${m.action || m.correction}`).join('\n')
        : '';

      // Batch into one prompt
      const emailList = emails.slice(0, 10).map((e, i) =>
        `${i + 1}. From: ${e.from || 'unknown'} | Subject: ${e.subject || '(none)'} | Classification: ${e.classification || 'unknown'}`
      ).join('\n');

      const prompt = `/no_think\nFor each email, decide the best action. Choose from: ${actions}
${memoryContext}

Emails:
${emailList}

Respond with ONLY a numbered list like:
1. action
2. action
...
Nothing else.`;

      const result = await ollama.generate(prompt, { temperature: 0.1, maxTokens: 200 });
      if (!result.success) throw new Error(result.error);

      const lines = result.data.response.split('\n').filter(l => l.trim());
      context.actions = [];
      for (let i = 0; i < emails.slice(0, 10).length; i++) {
        const email = emails[i];
        let action = 'archive';
        if (lines[i]) {
          const match = lines[i].match(/\d+\.\s*(.+)/);
          action = match ? match[1].trim().toLowerCase() : lines[i].trim().toLowerCase();
        }
        context.actions.push({ ...email, action });
        if (typeof Reports !== 'undefined') {
          Reports.log('pipeline', `"${email.subject}" → action: ${action}`);
        }
      }

      this._pushToHITL(context.actions);
      return context;
    }

    case 'ai_custom': {
      const ollama = window.electronAPI?.ollama;
      if (!ollama) throw new Error('Ollama API not available');

      const userPrompt = node.params.prompt || '';
      const dataStr = JSON.stringify(context.emails || context.classified || context.summaries || context, null, 2).substring(0, 2000);

      const prompt = `/no_think\n${userPrompt}\n\nData:\n${dataStr}`;
      const result = await ollama.generate(prompt, { temperature: 0.3, maxTokens: 1024 });
      if (!result.success) throw new Error(result.error);

      context.customResult = result.data.response;
      if (typeof Reports !== 'undefined') Reports.log('pipeline', `Custom AI: ${result.data.response.substring(0, 100)}`);
      return context;
    }

    default:
      return context;
  }
};

// ── Results Display ──

Pipeline._showResults = function (context) {
  if (!this.resultsPanel) return;
  this.resultsBody.innerHTML = '';

  const emails = context.matched || context.emails || [];
  if (emails.length === 0) {
    this.resultsBody.innerHTML = '<div style="padding:12px;color:rgba(255,255,255,0.4);font-size:12px;">No results</div>';
    this.resultsPanel.classList.remove('hidden');
    return;
  }

  this._renderEmailList(emails);
  this.resultsPanel.classList.remove('hidden');
};

Pipeline._renderEmailList = function (emails) {
  this.resultsBody.innerHTML = '';
  for (const email of emails) {
    const item = document.createElement('div');
    item.className = 'pe-result-item' + (email.unread ? ' unread' : '');

    // Parse a short date
    let shortDate = '';
    if (email.date) {
      try {
        const d = new Date(email.date);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
          shortDate = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          shortDate = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
      } catch (e) { shortDate = email.date.substring(0, 10); }
    }

    // Clean up "from" — just show name or short email
    let fromDisplay = email.from || '';
    const nameMatch = fromDisplay.match(/^"?([^"<]+)"?\s*</);
    if (nameMatch) fromDisplay = nameMatch[1].trim();
    if (fromDisplay.length > 22) fromDisplay = fromDisplay.substring(0, 20) + '…';

    item.innerHTML = `
      <span class="pe-result-from">${this._esc(fromDisplay)}</span>
      <span class="pe-result-subject">${this._esc(email.subject || '(no subject)')}<span class="pe-result-snippet"> — ${this._esc((email.snippet || '').substring(0, 60))}</span></span>
      <span class="pe-result-date">${this._esc(shortDate)}</span>
    `;

    item.addEventListener('click', () => this._showEmailDetail(email));
    this.resultsBody.appendChild(item);
  }
};

Pipeline._showEmailDetail = async function (email) {
  this.resultsBody.innerHTML = '<div style="padding:12px;color:rgba(255,255,255,0.4);">Loading...</div>';

  // Fetch full email body
  const api = window.electronAPI?.gmail;
  let fullEmail = email;
  if (api && email.id) {
    try {
      const result = await api.getMessage(email.id);
      if (result.success) fullEmail = result.data;
    } catch (e) { /* use what we have */ }
  }

  this.resultsBody.innerHTML = '';

  const back = document.createElement('button');
  back.className = 'pe-result-back';
  back.textContent = '← Back to list';
  back.addEventListener('click', () => this._showResults(this._lastContext));
  this.resultsBody.appendChild(back);

  const header = document.createElement('div');
  header.className = 'pe-result-detail-header';
  header.innerHTML = `
    <strong>${this._esc(fullEmail.subject || '(no subject)')}</strong>
    <div>From: ${this._esc(fullEmail.from || '')}${fullEmail.to ? ' → ' + this._esc(fullEmail.to) : ''}</div>
    <div>${this._esc(fullEmail.date || '')}</div>
  `;
  this.resultsBody.appendChild(header);

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'pe-result-detail';
  renderEmailSecure(bodyWrap, fullEmail.body, fullEmail.snippet);
  this.resultsBody.appendChild(bodyWrap);
};
