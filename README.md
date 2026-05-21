## Collector App

Next.js + Tailwind app for:

- Secure login (NextAuth Credentials)
- Applicant submission: image, ID card image, PDF + description
- Metadata stored in **MongoDB**
- Uploaded files stored locally under `uploads/` (dev-friendly)
- **Spaces (team workspaces)**:
  - Every user has a **Personal** workspace by default
  - Users can create multiple **Spaces** (e.g. “Business 1”, “Business 2”)
  - Space admins can generate **invite codes** for teammates to join the same space

## Getting Started

### 1) Configure environment

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Set:

- `MONGODB_URI` (required)
- `NEXTAUTH_SECRET` (required; generate a long random string)
- `NEXTAUTH_URL` (dev: `http://localhost:3000`)

### 2) Install & run

```bash
npm install
npm run dev
```

Open http://localhost:3000

### 3) Use the app

1. Register an account at `/register`
2. Login at `/login`
3. Go to `/dashboard`
4. Use **Workspace** selector:
   - **Personal**: only your own submissions
   - **Spaces**: shared submissions for that business/team
5. To collaborate:
   - Create a space → select it → generate invite code → teammate joins using the code in “Join a space”

## Notes / Production considerations

- Storing uploads on local disk is not suitable for most serverless deployments. For production, use object storage (S3/R2/etc.) or MongoDB GridFS.
- Add role-based authorization if multiple dashboard user roles are needed.
# verify
