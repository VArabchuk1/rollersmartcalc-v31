import os
import requests
import json
import time
from datetime import datetime

# Беремо токен із GitHub Secrets (APP_KEY) або твій ручний, якщо запускаєш локально
TOKEN = os.getenv('APP_KEY', "Nzc0OTkzMDkwMDk1MjE4NzI5.GmvFQR.p-VgWbAhSQ7WIdpbXQ74kMS8T5BPEF6JAJizZU")

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

    # ДУЖЕ ВАЖЛИВО: Для особистого токена НЕ ПИШЕМО "Bot "
    headers = {
        "Authorization": TOKEN, 
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for name, thread_id in LEAGUES_CONFIG.items():
        url = f"https://discord.com/api/v9/channels/{thread_id}/messages?limit=1"

        try:
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                messages = response.json()
                if messages:
                    msg = messages[0]
                    raw_date = msg['timestamp']
                    date_obj = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))

                    all_data[name] = {
                        "text": msg['content'],
                        "time": date_obj.strftime("%H:%M"),
                        "full_date": date_obj.strftime("%d.%m %H:%M")
                    }
                    print(f"✅ {name} оновлено")
                else:
                    all_data[name] = {"text": "Порожньо", "time": "--:--", "full_date": ""}
            else:
                # Якщо знову 403, виведемо причину
                print(f"❌ Помилка {name}: {response.status_code}")
                if response.status_code == 403:
                    print("Причина: Discord блокує запит. Можливо, токен не дійсний для хмарних IP.")
        except Exception as e:
            print(f"⚠️ Помилка з'єднання: {e}")

        # Збільшимо затримку, щоб не викликати підозр у Discord
        time.sleep(3)

    with open("leagues_data.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    get_leagues_data()
