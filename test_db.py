import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()  # This loads variables from .env into environment

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
cur.execute("SELECT 1;")
print("Connected!" if cur.fetchone()[0] == 1 else "Not connected.")
cur.close()
conn.close()