// ── Node Type Registry ──
// Static catalog of all node types that can appear in a desk pipeline.
// Each entry describes its label/icon/color, inputs/outputs, and configurable params.
// Used by pipeline/editor.js (to build the palette and render nodes) and
// pipeline/runner.js (to execute each node's behavior in _executeNode).

// Node `icon` fields hold complete <svg> strings from the central Icons library.
// They get embedded directly into the palette chip / node header via innerHTML.
const NodeTypes = {
  gmail_fetch: {
    label: 'Fetch Emails',
    category: 'gmail',
    color: '#dc4e41',
    icon: Icons.mailFetch,
    inputs: [],
    outputs: ['emails'],
    params: [
      { key: 'maxResults', label: 'Max Emails', type: 'number', default: 10 },
      { key: 'query', label: 'Search Query', type: 'text', default: '' },
    ],
  },
  gmail_read: {
    label: 'Read Email',
    category: 'gmail',
    color: '#dc4e41',
    icon: Icons.mailRead,
    inputs: ['email'],
    outputs: ['content'],
    params: [],
  },
  gmail_filter: {
    label: 'Filter',
    category: 'gmail',
    color: '#e8821a',
    icon: Icons.filter,
    inputs: ['emails'],
    outputs: ['matched', 'unmatched'],
    params: [
      { key: 'field', label: 'Filter By', type: 'select', options: ['from', 'subject', 'body'], default: 'from' },
      { key: 'contains', label: 'Contains', type: 'text', default: '' },
    ],
  },
  gmail_send: {
    label: 'Send Email',
    category: 'gmail',
    color: '#5cb85c',
    icon: Icons.send,
    inputs: ['trigger'],
    outputs: ['sent'],
    params: [
      { key: 'to', label: 'To', type: 'text', default: '' },
      { key: 'subject', label: 'Subject', type: 'text', default: '' },
      { key: 'body', label: 'Body', type: 'textarea', default: '' },
    ],
  },
  gmail_reply: {
    label: 'Reply',
    category: 'gmail',
    color: '#4a90c4',
    icon: Icons.reply,
    inputs: ['email'],
    outputs: ['sent'],
    params: [
      { key: 'body', label: 'Reply Body', type: 'textarea', default: '' },
    ],
  },

  // ── AI Nodes ──
  ai_classify: {
    label: 'Classify Email',
    category: 'ai',
    color: '#9b59b6',
    icon: Icons.brain,
    inputs: ['emails'],
    outputs: ['classified'],
    params: [
      { key: 'categories', label: 'Categories', type: 'text', default: 'important, routine, spam' },
    ],
  },
  ai_summarize: {
    label: 'Summarize',
    category: 'ai',
    color: '#9b59b6',
    icon: Icons.list,
    inputs: ['emails'],
    outputs: ['summaries'],
    params: [
      { key: 'style', label: 'Style', type: 'select', options: ['brief', 'detailed', 'bullet-points'], default: 'brief' },
    ],
  },
  ai_decide: {
    label: 'Decide Action',
    category: 'ai',
    color: '#9b59b6',
    icon: Icons.scale,
    inputs: ['emails'],
    outputs: ['actions'],
    params: [
      { key: 'actions', label: 'Possible Actions', type: 'text', default: 'flag_important, archive, notify_user, draft_reply' },
    ],
  },
  ai_custom: {
    label: 'Custom Prompt',
    category: 'ai',
    color: '#9b59b6',
    icon: Icons.chat,
    inputs: ['data'],
    outputs: ['result'],
    params: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', default: 'Analyze the following data and provide insights:' },
    ],
  },
};
