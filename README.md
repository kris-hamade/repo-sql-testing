# repo-sql-testing

A Node.js project that uses SQLite database and GitHub Actions to process GitHub issues for creating and updating user records. When an issue is opened, the workflow automatically processes it, validates the data, stores it in SQLite, and closes the issue.

## Features

- **Create Records**: Submit a GitHub issue to create a new user record in the database
- **Update Records**: Submit a GitHub issue to update your existing record (authorization required)
- **Automatic Processing**: GitHub Actions workflow processes issues automatically on open
- **Data Validation**: Validates required fields and ensures users can only update their own records
- **Auto-Close**: Issues are automatically closed after successful processing

## Setup

### Prerequisites

- Node.js 20 or higher
- npm or yarn
- GitHub repository with Actions enabled

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd repo-sql-testing
```

2. Install dependencies:
```bash
npm install
```

3. The database will be automatically created on first run. The database file `data.db` will be created in the project root.

**Note**: The `data.db` file is tracked in git and will be committed to the repository. The GitHub Actions workflow automatically commits database changes after processing each issue.

## Database Schema

The SQLite database contains a `users` table with the following schema:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  options TEXT,
  github_username TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Fields

- `id`: Auto-incrementing primary key
- `name`: User's name (required)
- `state`: User's state (required)
- `options`: Dropdown selection (stored as text/JSON)
- `github_username`: GitHub username of the creator/updater
- `created_at`: Timestamp when record was created
- `updated_at`: Timestamp when record was last updated

## Usage

### Creating a Record

1. Go to the Issues tab in your GitHub repository
2. Click "New Issue"
3. Select the "Create Record" template
4. Fill in the form:
   - **Name**: Your name
   - **State**: Your state
   - **Options**: Select an option from the dropdown
5. Submit the issue

The GitHub Action will:
- Parse the issue data
- Validate required fields
- Create a new record in the database
- Post a success comment with the record ID
- Close the issue automatically

### Updating a Record

1. Go to the Issues tab in your GitHub repository
2. Click "New Issue"
3. Select the "Update Record" template
4. Fill in the form:
   - **Record ID**: The ID of your record (you can only update your own records)
   - **Name**: Your updated name
   - **State**: Your updated state
   - **Options**: Select an updated option
5. Submit the issue

The GitHub Action will:
- Parse the issue data
- Validate that the record exists
- Verify that you are the author of the record (authorization check)
- Update the record in the database
- Post a success comment
- Close the issue automatically

**Important**: You can only update records that you created. The system validates that the issue author matches the `github_username` of the record.

## GitHub Actions Workflow

The workflow (`.github/workflows/process-issues.yml`) is triggered when an issue is opened. It:

1. Checks out the repository
2. Sets up Node.js
3. Installs dependencies
4. Runs the processing script
5. Commits database changes back to the repository

### Workflow Permissions

The workflow requires the following permissions:
- `issues: write` - To post comments and close issues
- `contents: write` - To commit database changes

## Project Structure

```
repo-sql-testing/
├── .github/
│   ├── workflows/
│   │   └── process-issues.yml    # GitHub Actions workflow
│   └── ISSUE_TEMPLATE/
│       ├── create-record.yml     # Create record issue template
│       └── update-record.yml     # Update record issue template
├── db.js                          # Database operations module
├── issue-parser.js                # Issue body parsing and validation
├── process-issue.js               # Main processing script
├── package.json                   # Node.js dependencies
├── data.db                        # SQLite database (created automatically)
└── README.md                      # This file
```

## Local Development

### Testing Database Operations

You can test the database module locally:

```bash
node -e "const db = require('./db'); db.initDatabase(); console.log('Database initialized');"
```

### Testing Issue Processing

To test issue processing locally, you can create a test script or use the process script with mock data. Note that the script expects GitHub Actions environment variables.

## Error Handling

If processing fails, the workflow will:
- Post an error comment on the issue explaining what went wrong
- Leave the issue open so you can fix and resubmit
- Log errors for debugging

Common errors:
- **Validation failed**: Missing required fields or invalid data format
- **Record not found**: Trying to update a non-existent record ID
- **Unauthorized**: Trying to update someone else's record
- **Parse error**: Issue body format is invalid

## License

ISC
