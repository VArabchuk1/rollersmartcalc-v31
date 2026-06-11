// Твої дані для підключення до Supabase
const SUPABASE_URL = 'https://rfvdlxffujyhsvmdfzxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmdmRseGZmdWp5aHN2bWRmenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDg0NDksImV4cCI6MjA5NjI4NDQ0OX0.UDuXbK0oDvBCQ_BKeLcaq43QRc6zNNVzno0rHTfmNAA';

/**
 * Функція для збереження гравця в базу даних Supabase
 * @param {string} nickname - Нікнейм користувача
 * @param {string} userId - Унікальний ID користувача з RollerCoin
 */
async function savePlayerToDatabase(nickname, userId) {
    if (!userId || !nickname) return { success: false };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/players`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ nickname, user_id: userId })
        });

        if (response.ok) {
            console.log(`[База] Збережено: ${nickname}`);
            return { success: true };
        }

        const errorData = await response.json().catch(() => ({}));

        if (errorData.code === '23505') {
            console.log(`[База] Пропущено (вже є): ${nickname}`);
            return { success: true };
        }

        console.log(`[База] Не збережено: ${errorData.message}`);
        return { success: false };

    } catch (error) {
        console.log(`[Мережа] Помилка для ${nickname}, але йдемо далі...`);
        return { success: false };
    }
}