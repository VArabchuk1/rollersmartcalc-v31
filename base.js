/**
 * Securely saves a player to the database via a proxy worker
 * @param {string} nickname - User's nickname
 * @param {string} userId - User's ID
 */
async function savePlayerToDatabase(nickname, userId) {
    if (!userId || !nickname) return { success: false };

    // Link to your standalone Cloudflare Worker
    const proxyUrl = "https://billowing-leaf-save-pl.arabon3.workers.dev/";

    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // No keys or authorization headers here anymore — they are secure
            },
            body: JSON.stringify({ nickname, user_id: userId })
        });

        if (response.ok) {
            console.log(`[DB] Successfully saved: ${nickname}`);
            return { success: true };
        }

        const errorData = await response.json().catch(() => ({}));

        // If the player already exists (unique key constraint in Supabase)
        if (errorData.code === '23505') {
            console.log(`[DB] Player ${nickname} already exists in the database (skipped)`);
            return { success: true };
        }

        console.log(`[DB] Failed to save: ${errorData.message || 'Unknown error'}`);
        return { success: false };

    } catch (error) {
        console.log(`[Network] Failed to send data for ${nickname}, but continuing execution...`);
        return { success: false };
    }
}