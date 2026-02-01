import pandas as pd

excel_path = r"C:\Users\muham\OneDrive\Documents\Desktop\ACIT 3900 ISSP\datapack\KPI Data - COTD.xlsx"

# sheet names
xl = pd.ExcelFile(excel_path)
print("Sheets found:")
print(xl.sheet_names)

# load the first sheet
sheet = xl.sheet_names[0]
df = pd.read_excel(excel_path, sheet_name=sheet)

print("\nLoaded sheet:", sheet)
print("Rows:", df.shape[0])
print("Columns:", df.shape[1])

print("\nColumn names:")
print(list(df.columns))

print("\nFirst 5 rows:")
print(df.head(5))
