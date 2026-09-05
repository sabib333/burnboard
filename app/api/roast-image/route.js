import { NextResponse } from 'next/server';
import { generateVisionRoast } from '@/lib/ai/provider';

/**
 * POST /api/roast-image
 *
 * Accepts a multipart form upload with an image file.
 * Uses the AI provider abstraction (Gemini Vision when configured) to
 * generate a savage roast in Bangla + English mix. All provider calls are
 * centralized in lib/ai/provider.js — this route only prepares input and
 * shapes output.
 *
 * Body (FormData):
 *   - image: File (required)
 *   - target_username: string (optional)
 *   - savage_level: 'mild' | 'savage' | 'toxic' | 'bangla' (optional, default 'savage')
 *
 * Response:
 *   { success: true, roast: string, level: string }
 */

export async function POST(req) {
  try {

    const formData = await req.formData();
    const imageFile = formData.get('image');
    const targetUsername = formData.get('target_username') || 'this person';
    const savageLevel = formData.get('savage_level') || 'savage';

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Image too large. Max size: 10MB' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageFile.type;

    // Centralized provider call (Gemini Vision when configured; clean
    // 'not configured' response otherwise — identical UX to before).
    const result = await generateVisionRoast({ imageBase64: base64Image, mimeType, savageLevel });

    if (!result.success) {
      if (result.code === 'not_configured') {
        return NextResponse.json(
          { error: 'AI vision service not configured. GEMINI_API_KEY is missing.' },
          { status: 503 }
        );
      }
      if (result.code === 'provider_error' || result.error) {
        console.error('[roast-image] AI error:', result.error);
        return NextResponse.json(
          { error: 'AI roast generation failed. Please try again.' },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: 'AI could not generate a roast for this image. Try a different photo.' },
        { status: 422 }
      );
    }

    // Clean up the roast: remove quotes and extra formatting
    const cleanedRoast = (result.roast || '')
      .replace(/^["'"`]+|["'"`]+$/g, '')
      .replace(/^Roast:\s*/i, '')
      .replace(/^Here'?s a roast:?\s*/i, '')
      .trim();

    if (!cleanedRoast) {
      return NextResponse.json(
        { error: 'AI could not generate a roast for this image. Try a different photo.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      roast: cleanedRoast,
      level: savageLevel,
      username: targetUsername,
    });
  } catch (err) {
    console.error('[roast-image] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
