import os
import json
import re
import requests

def update_data():
    # Шлях до файлу в папці проекту
    current_folder = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_folder, 'data.json')

    url = "https://minaryganar.com/calculator/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    }

    print(f"--- Оновлення RollerSmart v31 ---")

    try:
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()
        html = response.text

        # Шукаємо блок даних на сайті
        pattern = r"const coinMetaValues\s*=\s*(\{.*?\});"
        match = re.search(pattern, html, re.DOTALL)

        if match:
            raw_data = json.loads(match.group(1))
            transformed_coins = []

            for code, levels in raw_data.items():
                coin_obj = {
                    "code": code.lower(),
                    "time": 600.0,
                    "rewards": {}
                }

                if isinstance(levels, dict):
                    for level_key, level_value in levels.items():
                        # Просто чистимо назву з сайту (там вже є 'block_')
                        # 'Bronze I' стане 'bronze_i', а 'block_bronze_i' залишиться 'block_bronze_i'
                        tech_key = level_key.lower().replace(" ", "_")

                        # Зберігаємо число
                        coin_obj["rewards"][tech_key] = float(level_value)

                transformed_coins.append(coin_obj)

            # Формуємо фінальний об'єкт
            final_output = {"coins": transformed_coins}

            # Записуємо у файл ОДНИМ РЯДКОМ (без форматування)
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(final_output, f, ensure_ascii=False, separators=(',', ':'))

            print("========================================")
            print("УСПІХ! Дублювання 'block_block_' усунено.")
            print("========================================")
        else:
            print("ПОМИЛКА: Не знайдено дані на сайті.")

    except Exception as e:
        print(f"КРИТИЧНА ПОМИЛКА: {e}")

if __name__ == "__main__":
    update_data()
