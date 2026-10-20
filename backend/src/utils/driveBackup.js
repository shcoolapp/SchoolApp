const { google } = require('googleapis');

// Service account credentials come from environment variables (see .env.example).
// Never commit the JSON key file itself to source control.
function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  return google.drive({ version: 'v3', auth });
}

const BACKUP_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Uploads a buffer (e.g. an .xlsx backup) to the shared Drive folder.
async function uploadToFallbackDrive(buffer, filename) {
  const drive = getDriveClient();
  const { Readable } = require('stream');

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [BACKUP_FOLDER_ID]
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(buffer)
    },
    fields: 'id, webViewLink'
  });

  return res.data; // { id, webViewLink }
}

// Uploads a student's homework file (any type), returns Drive file id + link.
async function uploadHomeworkFile(buffer, filename, mimeType) {
  const drive = getDriveClient();
  const { Readable } = require('stream');

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [BACKUP_FOLDER_ID]
    },
    media: {
      mimeType,
      body: Readable.from(buffer)
    },
    fields: 'id, webViewLink'
  });

  return res.data; // { id, webViewLink }
}

// Deletes a file from Drive by its file ID (used for due-date + grace-period cleanup).
async function deleteFromDrive(fileId) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

module.exports = { uploadToFallbackDrive, uploadHomeworkFile, deleteFromDrive };
