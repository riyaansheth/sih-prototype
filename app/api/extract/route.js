// Live document extraction — the "prove it isn't smoke" path.
// Seeded bidders use fixtures so the demo always works; this endpoint runs a real
// upload through the model and returns whatever it can actually read.

import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROMPT = `You are reading a scanned Indian statutory document submitted with a government tender bid.

Identify the document type, then extract every field you can actually see. Do not guess, do not fill in plausible values: if a field is not legible or not present, omit it.

Return ONLY JSON:
{
  "documentType": "UDYAM_CERTIFICATE" | "GST_REGISTRATION" | "PAN_CARD" | "BIS_LICENCE" | "OEM_AUTHORIZATION" | "INCORPORATION_CERTIFICATE" | "OTHER",
  "fields": { "<fieldName>": "<value as printed>" },
  "identifiers": { "pan": "...", "gstin": "...", "udyamNumber": "...", "cin": "..." },
  "legibility": "GOOD" | "PARTIAL" | "POOR",
  "observations": ["anything that would matter to a verifying officer — an expiry date, a status stamp, an apparent alteration, a missing signature"]
}`;

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY)
    return Response.json({ error: 'OPENAI_API_KEY is not configured on this deployment. Seeded bidders still verify normally.' }, { status: 503 });

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 });
    if (!/^image\//.test(file.type))
      return Response.json({ error: `Live extraction accepts images (PNG/JPG). Received "${file.type || 'unknown'}". Export the certificate page as an image and retry.` }, { status: 415 });

    const dataUri = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: dataUri } },
      ] }],
    });

    return Response.json({
      ...JSON.parse(res.choices[0].message.content),
      fileName: file.name,
      model: process.env.OPENAI_MODEL || 'gpt-5',
      extractedAt: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
