# Aurora Senior Portal

This project keeps class metadata and text records in Supabase, while uploaded resource/assignment files are stored in Google Drive.

## Google Drive setup

The app uses Google's OAuth 2.0 web-server flow with the narrow `drive.file` scope. The website never receives or stores the Google refresh token in browser code. Vercel stores it as an environment variable, and serverless endpoints exchange it for short-lived access tokens when they need to create/delete Drive files.

### 1. Create a Google Cloud project

1. Open Google Cloud Console.
2. Create a project for this school portal.
3. Enable **Google Drive API** for the project.
4. Configure the OAuth consent screen.
5. Add the `https://www.googleapis.com/auth/drive.file` scope.
6. Create an OAuth client of type **Web application**.
7. Add this exact authorized redirect URI:

   `https://YOUR-DOMAIN.vercel.app/api/drive/oauth-callback`

Replace `YOUR-DOMAIN.vercel.app` with the real Vercel domain. For local development, you can create a separate OAuth client/redirect URI for localhost if needed.

For a one-account school project, publish the OAuth app when you are ready for the year-long deployment. Google documents that external OAuth clients left in **Testing** have refresh tokens that expire after 7 days; production publishing avoids that testing-only lifetime. The `drive.file` scope is the recommended narrow, non-sensitive Drive scope for files used by an app.

### 2. Add Vercel environment variables

Add these to the Vercel project:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_REFRESH_TOKEN`
- optionally `GOOGLE_DRIVE_FOLDER_ID`

Do not commit the values to Git.

### 3. Generate the refresh token

After deploying with the first three variables configured, open:

`https://YOUR-DOMAIN.vercel.app/api/drive/oauth-start`

Sign into the dedicated Google account and approve Drive access. The callback page displays a refresh token once. Copy it into Vercel as `GOOGLE_REFRESH_TOKEN`, then redeploy.

### 4. How uploads work

Supabase still stores rows such as assignment/resource title, category, description, dates, completion data, and help requests. Only the binary files are moved to Drive.

Large files do **not** pass through a Vercel function. The site asks the backend for a Google Drive resumable-upload session, then the browser uploads the selected file directly to that Google session URL. This avoids Vercel's 4.5 MB function request-body limit.

After the upload finishes, the backend makes the file readable by anyone with the link and returns the Drive URL. That URL is what gets stored in Supabase's existing `file_url` column.

Deleting a resource or assignment also attempts to delete its corresponding Drive file.

## Important storage note

A normal personal Google account's Drive is not unlimited. The free account has a finite storage quota, so this avoids paying for Supabase Storage but does not create unlimited storage. Keep an eye on the Drive account's storage usage during the school year.
