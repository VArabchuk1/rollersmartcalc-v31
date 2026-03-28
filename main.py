import os
import requests
import json
import time
from datetime import datetime

TOKEN = os.getenv('APP_KEY')

if not TOKEN:
    print("Error: System key not found.")
    exit(1)

# Конфігурація: Назва ліги -> ID гілки в Discord
LEAGUES_CONFIG = {
    "Bronze I": "1411488637287399465",
    "Bronze II": "1411488752626565130",
    "Bronze III": "1411488826076954694",
    "Silver I": "1411488871635746836",
    "Silver II": "1411488917852782622",
    "Silver III": "1411488964619141193",
    "Gold I": "1411489009166975027",
    "Gold II": "1411489053265891398",
    "Gold III": "1411489106499731476",
    "Platinum I": "1411489307482521690",
    "Platinum II": "1411489361232400525",
    "Platinum III": "1411489413208346644",
    "Diamond I": "1411489468103262299",
    "Diamond II": "1411489522159452261",
    "Diamond III": "1411489568611373136"
}

def get_leagues_data():
    all_data = {}

    headers = {
        "Authorization": f"Bot {os.getenv('APP_KEY')}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for name, thread_id in LEAGUES_CONFIG.items():
        if thread_id == "ID_ТУТ":
            continue

        url = f"https://discord.com/api/v9/channels/{thread_id}/messages?limit=1"

        try:
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                messages = response.json()
                if messages:
                    msg = messages[0]

                    # Обробка дати (окремо час і дата)
                    raw_date = msg['timestamp']
                    date_obj = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))

                    # Створюємо чистий формат дати для списку
                    formatted_time = date_obj.strftime("%H:%M") # Тільки час
                    formatted_full = date_obj.strftime("%d.%m %H:%M") # День.Місяць Час

                    all_data[name] = {
                        "text": msg['content'],      # Тільки текст повідомлення
                        "time": formatted_time,      # Для швидкого перегляду
                        "full_date": formatted_full  # Для випадаючого списку
                    }
                    print(f"✅ {name} оновлено")
                else:
                    all_data[name] = {"text": "Порожньо", "time": "--:--", "full_date": ""}
            else:
                print(f"❌ Помилка {name}: {response.status_code}")
        except Exception as e:
            print(f"⚠️ Помилка з'єднання: {e}")

        time.sleep(2)

    with open("leagues_data.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=4)

    print("\nФайл leagues_data.json готовий!")

if __name__ == "__main__":
    get_leagues_data()
