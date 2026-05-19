// ── Worker memory + HITL (Human-In-The-Loop) queue ──
// AI nodes push uncertain classifications/decisions to a review queue.
// User approves or corrects each one; the result feeds back into worker memory
// so future runs can auto-classify confident matches without asking.
// State lives on AppState: _workerMemory[], _hitlQueue[], _reviewedEmailIds{}.

Pipeline._getWorkerMemory = function () {
  // Returns past corrections/decisions stored on AppState
  return AppState._workerMemory || [];
};

Pipeline._addToMemory = function (entry) {
  if (!AppState._workerMemory) AppState._workerMemory = [];
  AppState._workerMemory.push({
    ...entry,
    timestamp: Date.now(),
  });
  // Keep last 100 memories
  if (AppState._workerMemory.length > 100) {
    AppState._workerMemory = AppState._workerMemory.slice(-100);
  }
};

// User corrects a classification or action
Pipeline.correctDecision = function (emailId, correction) {
  const entry = (AppState._hitlQueue || []).find(e => e.id === emailId);
  if (entry) {
    this._addToMemory({
      from: entry.from,
      subject: entry.subject,
      classification: entry.classification,
      action: entry.action,
      correction: correction,
    });
    AppState._reviewedEmailIds[emailId] = correction;
    AppState._hitlQueue = (AppState._hitlQueue || []).filter(e => e.id !== emailId);
    if (typeof Reports !== 'undefined') Reports.log('worker', `User corrected: "${entry.subject}" → ${correction}`);
    if (typeof Todo !== 'undefined') Todo.refresh();
  }
};

// User approves a decision (reinforces it)
Pipeline.approveDecision = function (emailId) {
  const entry = (AppState._hitlQueue || []).find(e => e.id === emailId);
  if (entry) {
    const finalClassification = entry.classification || entry.action;
    this._addToMemory({
      from: entry.from,
      subject: entry.subject,
      classification: entry.classification,
      action: entry.action,
      correction: finalClassification, // approved = correct
    });
    AppState._reviewedEmailIds[emailId] = finalClassification;
    AppState._hitlQueue = (AppState._hitlQueue || []).filter(e => e.id !== emailId);
    if (typeof Reports !== 'undefined') Reports.log('worker', `User approved: "${entry.subject}"`);
    if (typeof Todo !== 'undefined') Todo.refresh();
  }
};

// Fix a past decision (from the history view)
Pipeline.correctPastDecision = function (from, subject, newCorrection) {
  const memory = AppState._workerMemory || [];
  // Find the matching memory entry and update it
  for (let i = memory.length - 1; i >= 0; i--) {
    if (memory[i].from === from && memory[i].subject === subject) {
      memory[i].correction = newCorrection;
      if (typeof Reports !== 'undefined') Reports.log('worker', `Corrected past decision: "${subject}" → ${newCorrection}`);
      break;
    }
  }
  // Also update _reviewedEmailIds if we can match
  for (const [id, val] of Object.entries(AppState._reviewedEmailIds)) {
    // We don't have a direct ID→from mapping here, but the memory correction
    // will affect future LLM prompts which is what matters
  }
  if (typeof Todo !== 'undefined') Todo.refresh();
};

// ── HITL Queue ──

Pipeline._pushToHITL = function (items) {
  if (!AppState._hitlQueue) AppState._hitlQueue = [];
  let newCount = 0;
  for (const item of items) {
    // Skip already-reviewed emails
    if (AppState._reviewedEmailIds[item.id]) continue;
    // Skip if already in queue
    if (AppState._hitlQueue.some(q => q.id === item.id)) continue;
    // Skip if worker memory has a confident match for this sender
    if (this._hasConfidentMatch(item)) continue;
    AppState._hitlQueue.push(item);
    newCount++;
  }
  if (newCount > 0) {
    this._showHITLNotification(newCount);
  }
};

// Check if worker memory already knows how to handle this email
Pipeline._hasConfidentMatch = function (item) {
  const memory = AppState._workerMemory || [];
  if (memory.length < 3) return false; // need some history first

  // Extract sender domain/name
  const from = (item.from || '').toLowerCase();

  // Count how many times this sender was classified the same way
  const senderMemories = memory.filter(m => {
    const mFrom = (m.from || '').toLowerCase();
    // Match by sender email/name
    return from.includes(mFrom.split('<')[0].trim()) ||
           mFrom.includes(from.split('<')[0].trim()) ||
           (mFrom.split('@')[1] && from.includes(mFrom.split('@')[1]));
  });

  if (senderMemories.length >= 2) {
    // Same sender reviewed 2+ times with same result — auto-classify
    const lastCorrection = senderMemories[senderMemories.length - 1].correction;
    const allSame = senderMemories.every(m => m.correction === lastCorrection);
    if (allSame) {
      // Auto-apply without asking
      item.classification = lastCorrection;
      AppState._reviewedEmailIds[item.id] = lastCorrection;
      if (typeof Reports !== 'undefined') {
        Reports.log('worker', `Auto-classified "${item.subject}" as ${lastCorrection} (learned from past)`);
      }
      return true;
    }
  }
  return false;
};

Pipeline._showHITLNotification = function (count) {
  // Update todo panel
  if (typeof Todo !== 'undefined') Todo.refresh();
};

Pipeline.openHITLPanel = function () {
  const queue = AppState._hitlQueue || [];
  if (queue.length === 0) return;

  // Render in the results panel of the pipeline editor
  // If editor isn't open, open the reports panel instead
  if (typeof Reports !== 'undefined') {
    Reports.open();
    Reports.showHITL(queue);
  }
};
