/**
 * Parse and validate GitHub issue body data
 */

/**
 * Parse issue body to extract form data
 * Supports both YAML frontmatter and markdown table formats
 * @param {string} body - Issue body text
 * @returns {Object} Parsed data with type, name, state, options, and recordId (for updates)
 */
function parseIssueBody(body) {
  if (!body || typeof body !== 'string') {
    throw new Error('Issue body is empty or invalid');
  }

  const trimmedBody = body.trim();
  
  // Try to parse YAML frontmatter first
  if (trimmedBody.startsWith('---')) {
    return parseYAMLFrontmatter(trimmedBody);
  }
  
  // Otherwise, parse markdown format
  return parseMarkdownFormat(trimmedBody);
}

/**
 * Parse YAML frontmatter format
 * @param {string} body - Issue body with YAML frontmatter
 * @returns {Object} Parsed data
 */
function parseYAMLFrontmatter(body) {
  const yamlMatch = body.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!yamlMatch) {
    throw new Error('Invalid YAML frontmatter format');
  }

  const yamlContent = yamlMatch[1];
  const data = {};
  
  // Simple YAML parsing (for PoC - could use yaml library for production)
  const lines = yamlContent.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      data[key] = value;
    }
  }

  return normalizeParsedData(data);
}

/**
 * Parse markdown format (from GitHub issue forms)
 * @param {string} body - Issue body in markdown format
 * @returns {Object} Parsed data
 */
function parseMarkdownFormat(body) {
  const data = {};
  
  // Extract values from markdown format like:
  // ### Name
  // value
  // ### State
  // value
  // etc.
  
  const patterns = {
    name: /###\s*Name\s*\n([^\n]+)/i,
    state: /###\s*State\s*\n([^\n]+)/i,
    options: /###\s*Options?\s*\n([^\n]+)/i,
    recordId: /###\s*Record\s*ID\s*\n([^\n]+)/i,
    record_id: /###\s*Record\s*ID\s*\n([^\n]+)/i,
    id: /###\s*ID\s*\n([^\n]+)/i
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = body.match(pattern);
    if (match) {
      data[key] = match[1].trim();
    }
  }

  return normalizeParsedData(data);
}

/**
 * Normalize parsed data and determine issue type
 * @param {Object} data - Raw parsed data
 * @returns {Object} Normalized data with type field
 */
function normalizeParsedData(data) {
  const normalized = {
    type: data.recordId || data.record_id || data.id ? 'update' : 'create',
    name: data.name || '',
    state: data.state || '',
    options: data.options || '',
    recordId: data.recordId || data.record_id || data.id || null
  };

  // Convert recordId to number if present
  if (normalized.recordId) {
    const id = parseInt(normalized.recordId, 10);
    if (isNaN(id)) {
      throw new Error(`Invalid record ID: ${normalized.recordId}`);
    }
    normalized.recordId = id;
  }

  return normalized;
}

/**
 * Validate parsed issue data
 * @param {Object} parsedData - Parsed issue data
 * @param {string} issueType - Expected issue type ('create' or 'update')
 * @returns {Object} Validation result with isValid and errors
 */
function validateIssueData(parsedData, issueType) {
  const errors = [];

  // Validate type matches
  if (parsedData.type !== issueType) {
    errors.push(`Issue type mismatch: expected ${issueType}, got ${parsedData.type}`);
  }

  // Validate required fields
  if (!parsedData.name || parsedData.name.trim() === '') {
    errors.push('Name is required');
  }

  if (!parsedData.state || parsedData.state.trim() === '') {
    errors.push('State is required');
  }

  // For update, recordId is required
  if (issueType === 'update') {
    if (!parsedData.recordId || isNaN(parsedData.recordId)) {
      errors.push('Record ID is required for updates');
    }
  }

  // Validate options (should be a valid JSON string or comma-separated values)
  if (parsedData.options && parsedData.options.trim() !== '') {
    try {
      // Try to parse as JSON
      JSON.parse(parsedData.options);
    } catch (e) {
      // If not JSON, assume it's a simple string (valid)
      // Could add more validation here if needed
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Detect issue type from issue title or labels
 * @param {string} title - Issue title
 * @param {Array} labels - Issue labels
 * @returns {string} 'create' or 'update'
 */
function detectIssueType(title, labels = []) {
  const titleLower = (title || '').toLowerCase();
  const labelNames = labels.map(l => typeof l === 'string' ? l.toLowerCase() : l.name?.toLowerCase() || '');

  // Check labels first
  if (labelNames.includes('update') || labelNames.includes('update-record')) {
    return 'update';
  }
  if (labelNames.includes('create') || labelNames.includes('create-record')) {
    return 'create';
  }

  // Check title
  if (titleLower.includes('[update]') || titleLower.startsWith('update:')) {
    return 'update';
  }
  if (titleLower.includes('[create]') || titleLower.startsWith('create:')) {
    return 'create';
  }

  // Default to create if cannot determine
  return 'create';
}

module.exports = {
  parseIssueBody,
  validateIssueData,
  detectIssueType
};

