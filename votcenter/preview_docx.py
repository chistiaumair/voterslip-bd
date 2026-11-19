import os
import sys
import json
import argparse
import unicodeconverter as uc

# Import the extraction logic
from extract_columns import process_single_docx

# Set console output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def extract_preview(docx_dir, filename=None):
    if not os.path.exists(docx_dir):
        return {"status": "error", "message": f"Folder '{docx_dir}' does not exist."}

    if filename:
        filepath = os.path.join(docx_dir, filename)
    else:
        docx_files = [f for f in os.listdir(docx_dir) if f.endswith('.docx') and not f.startswith('~$')]
        if not docx_files:
            return {"status": "error", "message": "No DOCX files found in directory."}
        filename = docx_files[0]
        filepath = os.path.join(docx_dir, filename)

    try:
        # Suppress prints from extract_columns so it doesn't break JSON parsing
        import io
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            # Pass an empty config to rely on extract_columns.py's auto-detection / fallback
            records = process_single_docx(filepath, {})
        finally:
            sys.stdout = old_stdout
    except Exception as e:
        return {"status": "error", "message": f"Failed to extract '{filename}': {str(e)}"}

    if not records:
        return {"status": "error", "message": "No valid data found in this Word document."}

    headers = ["ভোটকেন্দ্র", "ভোটার এলাকা"]
    rows_data = []
    
    for r in records:
        rows_data.append([r.get("vot_center", ""), r.get("voter_area", "")])

    return {
        "status": "success",
        "filename": filename,
        "is_bijoy": False, # extract_columns handles bijoy internally
        "headers": headers,
        "rows": rows_data
    }

def main():
    parser = argparse.ArgumentParser(description="Extract table preview from Word document.")
    parser.add_argument("-i", "--input", required=True, help="Directory containing DOCX files.")
    parser.add_argument("-f", "--filename", default=None, help="Name of specific DOCX file to preview.")
    args = parser.parse_args()

    result = extract_preview(args.input, args.filename)
    print(json.dumps(result, ensure_ascii=False))
    sys.stdout.flush()

if __name__ == '__main__':
    main()
