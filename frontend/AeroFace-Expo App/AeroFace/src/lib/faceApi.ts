/**
 * faceApi.ts – Client for the AeroFace FastAPI face-recognition service.
 *
 * The FastAPI server must be running (python api.py) and reachable
 * from the device running the Expo app. Update FACE_API_URL below
 * with your machine's LAN IP when testing on a physical device.
 */


// ─── Base URL ────────────────────────────────────────────────────
// Use your machine's LAN IP so physical devices can reach the server.
// Find it with: (Get-NetIPAddress -AddressFamily IPv4).IPAddress
const FACE_API_URL = 'http://10.250.9.132:8000';

// ─── Types ───────────────────────────────────────────────────────
export interface RegisterResponse {
    success: boolean;
    message: string;
    user_id: string;
    embedding_size: number;
}

export interface FaceStatus {
    registered: boolean;
    user_id: string;
    model_name?: string | null;
    lounge_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface VerifyResponse {
    matched: boolean;
    user_id?: string | null;
    confidence: number;
    message: string;
}

// ─── API Calls ───────────────────────────────────────────────────

/**
 * Register a user's face.
 * Sends a base64 JPEG to the FastAPI /register endpoint.
 */
export async function registerFace(
    imageBase64: string,
    userId: string,
    loungeId?: string,
): Promise<RegisterResponse> {
    const res = await fetch(`${FACE_API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_base64: imageBase64,
            user_id: userId,
            lounge_id: loungeId ?? null,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || `Registration failed (${res.status})`);
    }

    return res.json();
}

/**
 * Check if a user already has a registered face embedding.
 */
export async function checkFaceStatus(userId: string): Promise<FaceStatus> {
    const res = await fetch(`${FACE_API_URL}/status/${encodeURIComponent(userId)}`);

    if (!res.ok) {
        throw new Error(`Status check failed (${res.status})`);
    }

    return res.json();
}

/**
 * Delete a user's face data (before re-registration).
 */
export async function deleteFaceData(userId: string): Promise<void> {
    const res = await fetch(
        `${FACE_API_URL}/embedding/${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || `Delete failed (${res.status})`);
    }
}
