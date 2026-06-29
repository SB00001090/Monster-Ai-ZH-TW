/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  console.log("[generateImage] Starting image generation");
  console.log("[generateImage] Forge API URL configured:", !!ENV.forgeApiUrl);
  console.log("[generateImage] Forge API Key configured:", !!ENV.forgeApiKey);
  
  if (!ENV.forgeApiUrl) {
    console.error("[generateImage] Missing BUILT_IN_FORGE_API_URL");
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    console.error("[generateImage] Missing BUILT_IN_FORGE_API_KEY");
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  const requestBody = {
    prompt: options.prompt,
    original_images: options.originalImages || [],
  };
  
  console.log("[generateImage] Making API request to:", fullUrl);
  console.log("[generateImage] Request body:", JSON.stringify(requestBody).substring(0, 100));
  
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  
  console.log("[generateImage] API response status:", response.status);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[ImageGeneration] API Error: ${response.status}`, detail);
    throw new Error(
      `Image generation failed: ${response.status} ${response.statusText}`
    );
  }

  let result;
  try {
    result = (await response.json()) as {
      image: {
        b64Json: string;
        mimeType: string;
      };
    };
  } catch (parseError) {
    console.error("[ImageGeneration] JSON parse error", parseError);
    throw new Error("Invalid response format from image API");
  }

  if (!result?.image?.b64Json) {
    console.error("[ImageGeneration] Missing image data", result);
    throw new Error("Image generation API returned no image data");
  }

  const base64Data = result.image.b64Json;
  const buffer = Buffer.from(base64Data, "base64");

  // Save to S3
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    result.image.mimeType
  );
  return {
    url,
  };
}
