# Groq sample study setup

The game already sends each collected sample's title, category, and description to the Flask endpoint at `/api/study-sample`. Flask calls Groq and returns the geology explanation to the discovery card. The API key stays on the server; it must not be added to browser JavaScript.

## Configure a local run

1. Create an API key in the [GroqCloud Console](https://console.groq.com/keys).
2. In the project root, create or update `.env` using [.env.example](./.env.example):

   ```dotenv
   GROQ_API_KEY=your_actual_groq_api_key
   GROQ_MODEL=openai/gpt-oss-120b
   ```

3. Restart Flask after changing `.env`.
4. Collect a sample and select **STUDY WITH GROQ AI**.

Do not commit `.env`, paste the key into chat, or place it in `static/game.js`. `.env` is ignored by Git.

## Configure a deployed run

Add `GROQ_API_KEY` and `GROQ_MODEL` as server-side environment variables in the hosting provider's app settings, then redeploy or restart the application. Do not set them in frontend or browser settings.

The previous default, `llama-3.3-70b-versatile`, was retired on August 16, 2026. The default is now Groq's documented replacement, `openai/gpt-oss-120b`. If `GROQ_MODEL` is already set in `.env` or the host, update that override too. See Groq's [active models](https://console.groq.com/docs/models) and [deprecation list](https://console.groq.com/docs/deprecations) before choosing another ID.

## If study still fails

- **401:** Groq rejected the key. Create a fresh key in GroqCloud, replace the server-side `GROQ_API_KEY`, and restart/redeploy.
- **403:** Groq denied access to the key, project, or model. Check the selected Groq project and model permissions, and confirm `GROQ_MODEL` is active.
- **404:** The configured model ID is unavailable; choose an active model and update `GROQ_MODEL`.
- **429:** Check your Groq usage limits or wait for rate limits to reset.

The game returns an error in the sample card when Groq cannot complete the study. A successful response explains what the sample may be, why scientists care, and what a rover could test next.
