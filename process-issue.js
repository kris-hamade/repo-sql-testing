const core = require('@actions/core');
const github = require('@actions/github');
const { initDatabase, createRecord, updateRecord, getRecord, closeDatabase } = require('./db');
const { parseIssueBody, validateIssueData, detectIssueType } = require('./issue-parser');

/**
 * Main function to process a GitHub issue
 */
async function processIssue() {
  try {
    // Get GitHub token and context
    // Try to get from input first (for testing), then from environment variable
    const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GitHub token is required. Set github-token input or GITHUB_TOKEN environment variable.');
    }
    const octokit = github.getOctokit(token);
    const context = github.context;

    // Get issue data
    const issue = context.payload.issue;
    if (!issue) {
      throw new Error('No issue found in context');
    }

    const issueNumber = issue.number;
    const issueTitle = issue.title;
    const issueBody = issue.body;
    const issueAuthor = issue.user.login;
    const issueLabels = issue.labels || [];

    core.info(`Processing issue #${issueNumber} by ${issueAuthor}`);

    // Detect issue type
    const issueType = detectIssueType(issueTitle, issueLabels);
    core.info(`Detected issue type: ${issueType}`);

    // Parse issue body
    let parsedData;
    try {
      parsedData = parseIssueBody(issueBody);
      core.info(`Parsed data: ${JSON.stringify(parsedData, null, 2)}`);
    } catch (error) {
      await postComment(octokit, issueNumber, `❌ Error parsing issue body: ${error.message}`);
      core.setFailed(`Failed to parse issue body: ${error.message}`);
      return;
    }

    // Validate parsed data
    const validation = validateIssueData(parsedData, issueType);
    if (!validation.isValid) {
      const errorMsg = `❌ Validation failed:\n${validation.errors.map(e => `- ${e}`).join('\n')}`;
      await postComment(octokit, issueNumber, errorMsg);
      core.setFailed(`Validation failed: ${validation.errors.join(', ')}`);
      return;
    }

    // Initialize database
    initDatabase();

    let result;
    let successMessage;

    // Process based on issue type
    if (issueType === 'create') {
      // Create new record
      try {
        result = createRecord(
          parsedData.name.trim(),
          parsedData.state.trim(),
          parsedData.options ? parsedData.options.trim() : null,
          issueAuthor
        );
        successMessage = `✅ Successfully created record!\n\n` +
          `**Record ID:** ${result.id}\n` +
          `**Name:** ${result.name}\n` +
          `**State:** ${result.state}\n` +
          `**Options:** ${result.options || 'None'}\n` +
          `**Created:** ${result.created_at}`;
      } catch (error) {
        await postComment(octokit, issueNumber, `❌ Error creating record: ${error.message}`);
        core.setFailed(`Failed to create record: ${error.message}`);
        return;
      }
    } else if (issueType === 'update') {
      // Update existing record
      try {
        // Verify record exists
        const existingRecord = getRecord(parsedData.recordId);
        if (!existingRecord) {
          await postComment(octokit, issueNumber, `❌ Record with ID ${parsedData.recordId} not found`);
          core.setFailed(`Record not found: ${parsedData.recordId}`);
          return;
        }

        // Update record (validation for author match happens in updateRecord)
        result = updateRecord(
          parsedData.recordId,
          parsedData.name.trim(),
          parsedData.state.trim(),
          parsedData.options ? parsedData.options.trim() : null,
          issueAuthor
        );
        successMessage = `✅ Successfully updated record!\n\n` +
          `**Record ID:** ${result.id}\n` +
          `**Name:** ${result.name}\n` +
          `**State:** ${result.state}\n` +
          `**Options:** ${result.options || 'None'}\n` +
          `**Updated:** ${result.updated_at}`;
      } catch (error) {
        await postComment(octokit, issueNumber, `❌ Error updating record: ${error.message}`);
        core.setFailed(`Failed to update record: ${error.message}`);
        return;
      }
    } else {
      throw new Error(`Unknown issue type: ${issueType}`);
    }

    // Post success comment
    await postComment(octokit, issueNumber, successMessage);

    // Close the issue
    await closeIssue(octokit, issueNumber);

    core.info('Issue processed successfully');
    core.setOutput('record-id', result.id);
    core.setOutput('action', issueType);

  } catch (error) {
    core.setFailed(`Unexpected error: ${error.message}`);
    throw error;
  } finally {
    // Close database connection
    closeDatabase();
  }
}

/**
 * Post a comment on the issue
 * @param {Object} octokit - GitHub API client
 * @param {number} issueNumber - Issue number
 * @param {string} message - Comment message
 */
async function postComment(octokit, issueNumber, message) {
  const context = github.context;
  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    body: message
  });
}

/**
 * Close the issue
 * @param {Object} octokit - GitHub API client
 * @param {number} issueNumber - Issue number
 */
async function closeIssue(octokit, issueNumber) {
  const context = github.context;
  await octokit.rest.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    state: 'closed'
  });
}

// Run if executed directly
if (require.main === module) {
  processIssue().catch(error => {
    core.setFailed(error.message);
    process.exit(1);
  });
}

module.exports = { processIssue };

