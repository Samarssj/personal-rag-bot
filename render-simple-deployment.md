# Simplest Render Deployment Plan

## The Short Answer

Yes—use **Render + your own Gemini API key**. You do **not** need MongoDB, a vector database, or an external SQL database for the current portfolio assistant.

The simplest production shape is:

```text
Render Web Service
  ├── React frontend
  ├── Express API
  ├── Gemini API with GEMINI_API_KEY
  └── In-memory temporary uploaded-resume session
```

> Keep the permanent Samar profile in the code, exactly as it works today. An uploaded resume is parsed for that visitor’s current browser session, then discarded. This matches the privacy-first purpose of the app and removes the need for a database and file storage.

## Do You Need a Vector Database?

**No.** The app already uses a small, fixed profile knowledge base and targeted retrieval. A vector database would add deployment complexity without improving this use case much.

Use a vector database only later if you plan to support hundreds of documents, long-term resume storage, semantic search over many files, or a multi-user document library.

## Do You Need SQLite?

**Not for the simplest version.** SQLite is only useful if you want uploaded-resume sessions to survive a Render restart or redeploy.

| Choice | Recommended for this app | What happens to an uploaded resume |
|---|---|---|
| No database | **Recommended now** | Exists only while the visitor’s session is active; it disappears after restart/redeploy. |
| SQLite on a Render disk | Use if temporary sessions must survive restarts | Stored in one local database file. Requires a paid Render persistent disk. |
| Vector database | Not needed now | Adds unnecessary infrastructure for a single-resume session flow. |

Render’s default filesystem is ephemeral, so a SQLite file without a persistent disk is deleted whenever the service restarts or redeploys. Render documents that persistent disks are available for paid web services and preserve local files across redeploys and restarts.[1]

## What Has Already Been Changed

The application has already been converted for this deployment model:

1. The server calls Gemini directly using `GEMINI_API_KEY`.
2. Database-backed resume sessions and managed file storage have been removed.
3. Uploaded resumes are parsed into temporary in-memory sessions only.
4. Managed OAuth, storage, database, and RPC routes have been removed from the production runtime.
5. The portrait now loads from Samar’s existing public portfolio asset.

**The only required secret is `GEMINI_API_KEY`.** A `GITHUB_TOKEN` remains optional if you want to avoid GitHub API rate limits when refreshing the project catalog.

## Render Dashboard Settings

Push the code to a private GitHub repository, then in Render select **New → Web Service** and connect the repository. Render’s Node/Express guide supports deploying a repository this way and lets you use your own build and start commands.[2]

| Render field | Value |
|---|---|
| Language | `Node` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Start command | `pnpm start` |
| Health check path | `/` |
| Node version | `22` |

Add these environment variables in **Environment**:

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key from Google AI Studio / Google Cloud |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22.13.0` |
| `GEMINI_MODEL` | `gemini-3.6-flash` |
| `GITHUB_TOKEN` | Optional; a GitHub personal access token if you want higher GitHub API limits |

Do **not** add `PORT`; Render provides it automatically and the server already reads it.

## If You Choose SQLite Later

Create a paid Render persistent disk, mount it at `/var/data`, and set:

```text
SQLITE_PATH=/var/data/portfolio.sqlite
```

The application must use that path for the SQLite file. Keep one Render instance only, because one SQLite file should not be written by multiple application instances at the same time.

## Deploy It Now

The project includes `render.yaml`. You can deploy it as a Render Blueprint or create a Web Service manually with the settings above:

1. Push this project to a private GitHub repository.
2. In Render, select **New → Blueprint** and choose the repository, or select **New → Web Service** and use the listed commands.
3. Add `GEMINI_API_KEY` in the service’s Environment section.
4. Deploy and open the generated `onrender.com` URL.

This leaves you with a public portfolio chatbot that visitors can use without any platform account or database setup.

## References

[1] [Render: Persistent Disks](https://render.com/docs/disks)

[2] [Render: Deploy a Node Express App](https://render.com/docs/deploy-node-express-app)
