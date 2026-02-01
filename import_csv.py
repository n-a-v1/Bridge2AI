#!/usr/bin/env python3
"""
Import training data from CSV file
Usage: python import_csv.py <csv_file>
"""

import sys
import csv
from llm_manager import Database

def import_csv(filename):
    """Import training data from CSV"""
    db = Database()
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            
            for row in reader:
                db.add_training_data(
                    category=row.get('category', 'general'),
                    question=row['question'],
                    expected_response=row['answer'],
                    metadata={'source': filename}
                )
                count += 1
                print(f"✓ Imported: {row['question'][:50]}...")
            
            print(f"\n✓ Successfully imported {count} training examples")
    
    except FileNotFoundError:
        print(f"✗ File not found: {filename}")
        sys.exit(1)
    except KeyError as e:
        print(f"✗ CSV missing required column: {e}")
        print("  Required columns: question, answer")
        print("  Optional columns: category")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_csv.py <csv_file>")
        print("\nExample:")
        print("  python import_csv.py example_training_data.csv")
        sys.exit(1)
    
    import_csv(sys.argv[1])
