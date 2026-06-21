import Replicate from "replicate";
import { jsonResponse, readJsonBody } from "./shared.js";

const replicate = new Replicate();
const MODEL_ID =
  "lucataco/ollama-llama3.2-vision-90b:54202b223d5351c5afe5c0c9dba2b3042293b839d022e76f53d66ab30b9dc814";

const COLOR_PROMPT = `
[ROLE]
You are an expert graphic designer specialized in Swiss Style minimalism and advanced color theory.

[TASK]
Analyze the provided image and extract a sophisticated, highly diverse color palette of exactly 6 hex color codes.

[COLOR CONSTRAINTS]
1. MAX VARIANCE: Force high contrast. Select a distinct mix of highlights, mid-tones, and dark shadows. Avoid multiple shades of the same color family.
2. THEMATIC ACCURACY: Do not invent colors. Every tone must strictly stem from the actual atmosphere, lighting, and industrial mood of the scene.
3. PALETTE BALANCE: Deliver a curated combination of dominant ambient colors and striking local accent colors.

[COLOR RULES]
Apply the 60-30-10 color rule throughout the entire interface design:

* 60% Primary Color: Use a dominant base color that defines the overall visual identity and creates consistency across all screens.
* 30% Secondary Color: Use a complementary or contrasting color for larger UI elements, sections, cards, sidebars, and visual hierarchy.
* 10% Accent Color: Reserve a vibrant accent color for important actions, CTAs, active states, highlights, notifications, and key interactive elements.

Ensure the color distribution feels balanced, intentional, and visually harmonious.
The accent color should draw attention without overwhelming the interface.
Maintain sufficient contrast for accessibility and readability while creating a premium, modern, and professional appearance.

Color usage must strictly follow the 60-30-10 principle.
Avoid random color placement. Every color should have a clear purpose within the hierarchy.
The primary color establishes the atmosphere, the secondary color creates depth and structure, and the accent color guides user attention toward the most important interactions.
Use subtle tonal variations of the primary and secondary colors to create depth while preserving a cohesive visual language.


[OUTPUT FORMAT]
- Return ONLY a raw, valid JSON array of strings.
- Example: ["#D9A832", "#3A3A36", "#1F2A30", "#8C7028", "#5C5240", "#A89050"]
- Strict Rule: Absolutely NO intro, NO outro, NO explanations, and NO markdown formatting (DO NOT use \`\`\`json blocks). Just the raw array.
`;

// Einheitliche Fehlerantwort für alle Replicate-Aufrufe.
function replicateError(error, context, message) {
  console.error(`[Replicate] ${context}:`, error);
  return jsonResponse(
    { error: message, details: error?.message || String(error) },
    error?.status || 502,
  );
}

export async function handleReplicateImageToColor(req) {
  const { body, error } = await readJsonBody(req);
  if (error) return error;

  if (!body?.image) {
    return jsonResponse({ error: "Missing required field: image" }, 400);
  }

  try {
    const input = { image: body.image, prompt: COLOR_PROMPT };

    // Stream the response from Replicate
    let output = "";
    for await (const event of replicate.stream(MODEL_ID, { input })) {
      output += event;
    }

    return jsonResponse({ output }, 200);
  } catch (error) {
    return replicateError(
      error,
      "Error during image-to-color",
      "Replicate image-to-color request failed",
    );
  }
}

export async function handleReplicateStartPrediction(req) {
  const { body, error } = await readJsonBody(req);
  if (error) return error;

  if (!body?.input || typeof body.input !== "object") {
    return jsonResponse({ error: "Missing required field: input" }, 400);
  }

  try {
    const prediction = await replicate.predictions.create({ model: MODEL_ID, input: body.input });
    return jsonResponse(prediction, 201);
  } catch (error) {
    return replicateError(error, "Error starting prediction", "Failed to start prediction");
  }
}

export async function handleReplicatePredictionStatus(req) {
  const predictionId = new URL(req.url).pathname.split("/").pop();
  if (!predictionId) {
    return jsonResponse({ error: "Missing prediction id" }, 400);
  }

  try {
    const prediction = await replicate.predictions.get(predictionId);
    return jsonResponse(prediction, 200);
  } catch (error) {
    return replicateError(
      error,
      "Error getting prediction status",
      "Failed to get prediction status",
    );
  }
}
