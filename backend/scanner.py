# pyright: reportMissingImports=false
import os
import time
import datetime
import requests  # type: ignore
import cv2  # type: ignore
from pyzbar import pyzbar  # type: ignore
import mysql.connector  # type: ignore
from dotenv import load_dotenv  # type: ignore

# Load environmental variables
load_dotenv()

# Category keywords mapping
CATEGORY_MAP = {
    'dairy': ['milk', 'cheese', 'dairy', 'yogurt', 'egg', 'butter', 'cream'],
    'vegetables': ['vegetable', 'greens', 'spinach', 'salad', 'carrot', 'tomato', 'potato', 'onion', 'cucumber', 'pepper'],
    'fruits': ['fruit', 'berry', 'apple', 'banana', 'strawberry', 'avocado', 'orange', 'lemon', 'grape', 'peach'],
    'bakery': ['bread', 'bakery', 'loaf', 'croissant', 'cake', 'cookie', 'flour', 'sourdough', 'toast'],
    'meat': ['meat', 'beef', 'chicken', 'pork', 'sausage', 'ham', 'turkey', 'fish', 'seafood']
}

def guess_category_and_location(product_name, category_text):
    text_to_search = f"{product_name} {category_text}".lower()
    
    # Check category map keywords
    for cat_name, keywords in CATEGORY_MAP.items():
        if any(keyword in text_to_search for keyword in keywords):
            # Map location
            if cat_name in ['dairy', 'meat', 'vegetables']:
                location = 'Fridge'
            elif cat_name == 'fruits':
                location = 'Fridge' if 'berry' in text_to_search or 'salad' in text_to_search else 'Pantry'
            else:
                location = 'Pantry'
            return cat_name.capitalize(), location
            
    # Defaults
    return 'Other', 'Pantry'

def get_default_shelf_life_days(category):
    shelf_life = {
        'Dairy': 7,
        'Bakery': 5,
        'Vegetables': 7,
        'Fruits': 10,
        'Meat': 3,
        'Other': 14
    }
    return shelf_life.get(category, 7)

def lookup_barcode(barcode):
    print(f"\n🔍 Looking up barcode: {barcode} on Open Food Facts...")
    url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
    
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 1:
                product = data.get('product', {})
                # Try getting name
                name = product.get('product_name') or product.get('product_name_en')
                if not name:
                    return None
                
                # Fetch categories
                categories = product.get('categories') or ""
                quantity = product.get('quantity') or "1 unit"
                
                cat, loc = guess_category_and_location(name, categories)
                
                return {
                    'name': name,
                    'category': cat,
                    'location': loc,
                    'quantity': quantity
                }
    except Exception as e:
        print(f"⚠️ API error: {e}")
        
    return None

def main():
    print("🚀 Starting FreshTrack Barcode Scanner...")
    
    # 1. Connect to MySQL Database
    db_host = os.getenv("DB_HOST", "localhost")
    db_user = os.getenv("DB_USER", "root")
    db_password = os.getenv("DB_PASSWORD", "")
    db_name = os.getenv("DB_NAME", "expire_reminder")
    
    print(f"Connecting to database '{db_name}' at {db_host}...")
    try:
        conn = mysql.connector.connect(
            host=db_host,
            user=db_user,
            password=db_password,
            database=db_name
        )
        cursor = conn.cursor()
        print("✅ Database connection established.")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("Please ensure MySQL is running and details are correct in backend/.env.")
        return

    # 2. Retrieve or create default user ID
    cursor.execute("SELECT id, name FROM users LIMIT 1")
    user = cursor.fetchone()
    if not user:
        print("⚠️ No users found in database. Seeding a default user 'Alex Rivera'...")
        cursor.execute(
            "INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, %s)",
            ("Alex Rivera", "alex@freshtrack.org", "dummyhashedpassword", "Household Lead")
        )
        conn.commit()
        user_id = cursor.lastrowid
        print(f"✅ Seeding complete. Created user ID: {user_id}")
    else:
        user_id = user[0]
        print(f"👤 Scanning for user: {user[1]} (ID: {user_id})")

    # 3. Start Camera Capture
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Cannot open camera. Please check camera connections and permissions.")
        return
        
    print("\n------------------------------------------------------------")
    print("🎥 Camera screen loaded. Press 'q' in the window to quit.")
    print("Place a barcode in front of the camera to scan.")
    print("------------------------------------------------------------\n")
    
    # Cooldown trackers to prevent scanning the same barcode multiple times instantly
    scanned_cooldowns = {}
    cooldown_seconds = 5

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame.")
            break

        # Scan for barcodes in the current frame
        barcodes = pyzbar.decode(frame)

        for barcode in barcodes:
            barcode_data = barcode.data.decode("utf-8")
            current_time = time.time()
            
            # Check cooldown
            if barcode_data in scanned_cooldowns:
                if current_time - scanned_cooldowns[barcode_data] < cooldown_seconds:
                    # Draw blue rectangle to show it's recognized but on cooldown
                    (x, y, w, h) = barcode.rect
                    cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 0, 0), 2)
                    cv2.putText(frame, "Scan cooldown...", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
                    continue
            
            # Record scan timestamp
            scanned_cooldowns[barcode_data] = current_time
            
            # Visual box feedback (Green rectangle around active scan)
            (x, y, w, h) = barcode.rect
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 3)
            cv2.putText(frame, "SCANNED!", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            
            # Highlight feed and show barcode
            cv2.imshow("FreshTrack Barcode Scanner", frame)
            cv2.waitKey(1)
            
            # Look up barcode metadata
            prod_meta = lookup_barcode(barcode_data)
            
            if not prod_meta:
                print(f"\n❌ [ERROR] NOT A RECOGNIZED PRODUCT!")
                print(f"   Barcode '{barcode_data}' is NOT a registered product in the database.")
                print(f"   ⚠️ Action rejected: Only verified products can be added to inventory.\n")
                continue
            
            # Calculate Expiry dates
            purchase_date = datetime.date.today()
            shelf_life_days = get_default_shelf_life_days(prod_meta['category'])
            expiry_date = purchase_date + datetime.timedelta(days=shelf_life_days)
            
            # Format dates for MySQL
            purchase_str = purchase_date.strftime("%Y-%m-%d")
            expiry_str = expiry_date.strftime("%Y-%m-%d")
            
            print(f"💾 Saving to database:")
            print(f"   Name:     {prod_meta['name']}")
            print(f"   Category: {prod_meta['category']}")
            print(f"   Expiry:   {expiry_str} ({shelf_life_days} days shelf life)")
            print(f"   Location: {prod_meta['location']}")
            
            try:
                # 1. Insert into products
                add_query = """
                    INSERT INTO products (user_id, name, category, barcode, purchase_date, expiry_date, location, quantity) 
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(add_query, (
                    user_id, 
                    prod_meta['name'], 
                    prod_meta['category'], 
                    barcode_data, 
                    purchase_str, 
                    expiry_str, 
                    prod_meta['location'], 
                    prod_meta['quantity']
                ))
                
                # 2. Insert into scanned history
                history_query = "INSERT INTO scanned_history (user_id, name) VALUES (%s, %s)"
                cursor.execute(history_query, (user_id, prod_meta['name']))
                
                conn.commit()
                print("✅ Successfully inserted into database.")
            except Exception as e:
                conn.rollback()
                print(f"❌ Database insert error: {e}")
                
            print("\nResuming camera stream...\n")

        # Show camera feed window
        cv2.imshow("FreshTrack Barcode Scanner", frame)

        # Listen for key press: press 'q' to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Clean up
    cap.release()
    cv2.destroyAllWindows()
    cursor.close()
    conn.close()
    print("👋 Scanner closed successfully.")

if __name__ == "__main__":
    main()
