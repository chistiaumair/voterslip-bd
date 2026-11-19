import os
import re
import sys
import json
import csv
import unicodeconverter as uc
from docx import Document

# Set console output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

import argparse

base_dir = os.path.dirname(os.path.abspath(__file__))
default_input_dir = os.path.join(base_dir, "allcenter")
default_output_dir = os.path.join(base_dir, "extracted_data")

parser = argparse.ArgumentParser(description="Extract columns from Word documents.")
parser.add_argument("-i", "--input", default=default_input_dir, help="Input directory")
parser.add_argument("-o", "--output", default=default_output_dir, help="Output directory")
parser.add_argument("--center-col", type=int, default=1, help="Index of voter center column")
parser.add_argument("--area-col-1", type=int, default=3, help="Index of area column 1")
parser.add_argument("--area-col-2", type=int, default=4, help="Index of area column 2")
parser.add_argument("--config", default=None, help="Path to JSON file with file-specific column mappings")
args_parsed, unknown = parser.parse_known_args()

docx_dir = args_parsed.input
output_dir = args_parsed.output
CENTER_COL = args_parsed.center_col
AREA_COL_1 = args_parsed.area_col_1
AREA_COL_2 = args_parsed.area_col_2
CONFIG_FILE = args_parsed.config


output_json = os.path.join(output_dir, "extracted_columns.json")
output_csv = os.path.join(output_dir, "extracted_columns.csv")



def clean_text(text):
    return re.sub(r'\s+', ' ', text).strip()


def is_bijoy_text(text):
    if not text:
        return False
    # Removed strict Unicode rejection to allow mixed Bijoy/Unicode text detection
    # Check for visual layout signatures of Bijoy/SutonnyMJ
    if any(sig in text for sig in ['‡fvU', '†fvU', 'Ae¯’vb', 'msL¨v', 'cyiæl', 'gwnjv', 'µwgK', 'BDwbqb', 'IqvW©', 'BDwbqbt']):
        return True
    # Check if there are extended ANSI characters (128-255)
    return any(128 <= ord(c) <= 255 for c in text)

def is_header_row(cells):
    row_str = " ".join(cells)
    
    # Check for center name header
    has_vot = any(w in row_str for w in ["ভোট", "ভোট", "‡fvU", "†fvU"])
    has_name = any(w in row_str for w in ["নাম", "bvg"])
    has_qty = any(w in row_str for w in ["সংখ্যা", "msL¨v"])
    
    if has_vot and has_name:
        return True
    if has_vot and has_qty:
        return True
        
    # Check for village/area name header
    has_village = any(w in row_str for w in ["গ্রাম", "MÖvg", "মহল্লা", "gnjøv", "রাস্তা", "iv¯Ív"])
    if has_village and has_name:
        return True
        
    # Check for voter list header
    has_voter = any(w in row_str for w in ["ভোটার", "ভোটার", "†fvUvi"])
    if has_voter and has_name:
        return True
    if has_voter and has_qty:
        return True
        
    return False

def normalize_text(text):
    if not text:
        return ""
    text = text.lower()
    for ch in [' ', '-', '_', ',', '.', '(', ')', ':', ';', '\n', '\t', 'ঃ', '\'']:
        text = text.replace(ch, '')
    return text

def is_valid_entry(center, area):
    c_clean = clean_text(center)
    a_clean = clean_text(area)
    
    if not c_clean or not a_clean:
        return False
        
    if c_clean == a_clean:
        return False

    if len(c_clean) < 4 or len(a_clean) < 2:
        return False
        
    # Check for at least one Bengali or English letter to exclude purely number rows
    bengali_letters = re.compile(r'[\u0980-\u09FFa-zA-Z]')
    if not bengali_letters.search(c_clean) or not bengali_letters.search(a_clean):
        return False
        
    invalid_terms = ["ভোটার এলাকা", "গ্রামের নাম", "মহল্লা", "রাস্তার নাম", "ক্রমিক", "মন্তব্য", "মোট", "স্থায়ী", "অস্থায়ী", "উপজেলা", "থানা", "ইউনিয়ন", "পৌরসভা", "সিটি কর্পোরেশন"]
    for term in invalid_terms:
        norm_c = normalize_text(c_clean)
        norm_a = normalize_text(a_clean)
        norm_t = normalize_text(term)
        if norm_c == norm_t or norm_a == norm_t:
            return False
            
    return True

def is_summary_table(table, is_bijoy_table):
    summary_keywords = [
        'উপজেলা/ থানার সংখ্যা', 'উপজেলা/থানার সংখ্যা', 
        'সিটি কর্পোরেশন/ পৌরসভার', 'সিটি কর্পোরেশন/পৌরসভার', 
        'বোর্ডের সংখ্যা', 'ভোটকেন্দ্রের সংখ্যা', 'ভোটকেন্দে্রর সংখ্যা'
    ]
    for r_idx in range(min(2, len(table.rows))):
        row = table.rows[r_idx]
        for cell in row.cells:
            t = cell.text.strip().replace('\n', ' ')
            if is_bijoy_table and t and any(c.isalnum() or c in '‡†Ae¯msLcyigwnBDwIq' for c in t):
                try:
                    t = uc.convert_bijoy_to_unicode(t)
                except Exception:
                    pass
            norm = normalize_text(t)
            for kw in summary_keywords:
                norm_kw = normalize_text(kw)
                if norm_kw and norm_kw in norm:
                    return True
    return False

def detect_table_columns(table, is_bijoy_table, default_center, default_area_1, default_area_2):
    center_idx = -1
    area_idx_1 = -1
    area_idx_2 = -1

    center_keywords = [
        'ভোটকেন্দ্রেরনামওঅবস্থান',
        'ভোটকেন্দ্রেরনাম',
        'ভোটকেন্দ্র',
        'ভোটকন্দ্রে',
        'কেন্দ্রেরনাম',
        'কেন্দ্র',
        'center'
    ]

    area_keywords = [
        'যেএলাকারভোটারগণএইভোটকেন্দ্রেভোটদিবেন',
        'ভোটারএলাকারনাম',
        'ভোটারএলাকা',
        'এলাকারনাম',
        'গ্রামেরনাম',
        'গ্রাম',
        'মহল্লা',
        'রাস্তারনাম',
        'ওর্য়াডনং',
        'পাড়া',
        'রাস্তা',
        'এলাকা'
    ]

    def normalize_and_convert(text):
        if not text:
            return ""
        t = text.strip().replace('\n', ' ')
        if is_bijoy_table and t and any(c.isalnum() or c in '‡†Ae¯msLcyigwnBDwIq' for c in t):
            try:
                t = uc.convert_bijoy_to_unicode(t)
            except Exception:
                pass
        return t

    def score_header(text):
        norm = normalize_text(text)
        if not norm:
            return 0, 0

        center_score = 0
        area_score = 0

        for kw in center_keywords:
            if kw in norm:
                center_score += 6
        for kw in area_keywords:
            if kw in norm:
                area_score += 5

        if 'ভোটার' in norm and 'এলাকা' in norm:
            area_score += 4
        if 'ভোটার' in norm and 'নাম' in norm:
            area_score += 3
        if 'কেন্দ্র' in norm and 'নাম' in norm:
            center_score += 3
        if 'ভোট' in norm and 'কেন্দ্র' in norm:
            center_score += 2

        return center_score, area_score

    for r_idx in range(min(8, len(table.rows))):
        row = table.rows[r_idx]
        unique_cells = []
        for cell in row.cells:
            if not unique_cells or unique_cells[-1]._tc is not cell._tc:
                unique_cells.append(cell)

        cells_text = [normalize_and_convert(cell.text) for cell in unique_cells]

        for idx, t in enumerate(cells_text):
            norm = normalize_text(t)
            if not norm:
                continue

            center_score, area_score = score_header(t)
            if center_idx == -1 and center_score >= 6:
                center_idx = idx
            if center_idx != -1 and area_idx_1 == -1 and idx != center_idx and area_score >= 5:
                area_idx_1 = idx
            if center_idx != -1 and area_idx_2 == -1 and idx != center_idx and idx != area_idx_1 and area_score >= 4:
                area_idx_2 = idx

        if center_idx != -1 and (area_idx_1 != -1 or area_idx_2 != -1):
            break

    if center_idx == -1:
        center_idx = default_center
    if area_idx_1 == -1:
        area_idx_1 = default_area_1
    if area_idx_2 == -1:
        area_idx_2 = default_area_2

    return center_idx, area_idx_1, area_idx_2

def process_single_docx(filepath, column_configs):
    filename = os.path.basename(filepath)
    print(f"Reading document: {filepath}")
    
    try:
        doc = Document(filepath)
    except Exception as e:
        print(f"  -> Error opening {filename}: {e}")
        return []

    # Determine global encoding for the document
    is_bijoy_doc = False
    for table in doc.tables:
        for r in table.rows[:min(10, len(table.rows))]:
            row_raw_text = " ".join([c.text for c in r.cells])
            if is_bijoy_text(row_raw_text):
                is_bijoy_doc = True
                break
        if is_bijoy_doc:
            break
            

    # 1. Extract Thana from introductory paragraphs
    thana_from_p = ""
    for p in doc.paragraphs:
        txt = clean_text(p.text)
        if not txt:
            continue
        if is_bijoy_text(txt):
            txt = uc.convert_bijoy_to_unicode(txt)
            
        # Search for Upazila/Thana
        match = re.search(r'(?:উপজেলা|থানা)\s*[t:ঃ\-–\s]+\s*([^\s,\|]+)', txt)
        if match:
            thana_from_p = match.group(1).strip()
            break
            
    # 2. Process all tables
    data_rows = []
    current_thana = thana_from_p
    current_ward = ""
    
    # Determine columns configuration once for the entire document to ensure consistency across pages
    main_center_col = -1
    main_area_col_1 = -1
    main_area_col_2 = -1
    
    file_config = column_configs.get(filename, {})
    if "center_col" in file_config and "area_col_1" in file_config:
        main_center_col = file_config.get("center_col")
        main_area_col_1 = file_config.get("area_col_1")
        main_area_col_2 = file_config.get("area_col_2", -1)
    else:
        # Scan tables to detect structure once
        for table in doc.tables:
            if not table.rows:
                continue
            if is_summary_table(table, is_bijoy_doc):
                continue
                
            u_col_count = 0
            for r in table.rows[:min(5, len(table.rows))]:
                row_cells = []
                for cell in r.cells:
                    if not row_cells or row_cells[-1]._tc is not cell._tc:
                        row_cells.append(cell)
                u_col_count = max(u_col_count, len(row_cells))
                
            if u_col_count == 13 or u_col_count == 3:
                continue
                
            # Run detection on this table
            default_c = 1
            default_a1 = 3
            default_a2 = 4 if u_col_count == 10 else -1
            
            c_idx, a_idx1, a_idx2 = detect_table_columns(
                table, is_bijoy_doc, default_center=default_c, default_area_1=default_a1, default_area_2=default_a2
            )
            # For 10-column tables, always include both C4 and C5 as area columns
            if u_col_count == 10:
                a_idx1 = 3
                a_idx2 = 4
                
            main_center_col = c_idx
            main_area_col_1 = a_idx1
            main_area_col_2 = a_idx2
            break

    # Final fallback if no tables could be detected
    if main_center_col == -1:
        main_center_col = CENTER_COL
        main_area_col_1 = AREA_COL_1
        main_area_col_2 = AREA_COL_2
        
    for t_idx, table in enumerate(doc.tables):
        if not table.rows:
            continue
            
        # Filter out summary/signoff tables by content keywords
        if is_summary_table(table, is_bijoy_doc):
            continue

        # Determine table column count by taking the maximum unique cells in the first 5 rows
        u_col_count = 0
        for r in table.rows[:min(5, len(table.rows))]:
            row_cells = []
            for cell in r.cells:
                if not row_cells or row_cells[-1]._tc is not cell._tc:
                    row_cells.append(cell)
            u_col_count = max(u_col_count, len(row_cells))
            
        # Summary tables normally have 13 columns. Signoff tables have 3.
        if u_col_count == 13 or u_col_count == 3:
            continue

        # Apply the file-wide columns configuration consistently across all pages
        table_center_col = main_center_col
        table_area_col_1 = main_area_col_1
        table_area_col_2 = main_area_col_2
        
        for r_idx, row in enumerate(table.rows):
            # Deduplicate cells by XML _tc object identity to handle horizontal merges cleanly
            unique_cells = []
            for cell in row.cells:
                if not unique_cells or unique_cells[-1]._tc is not cell._tc:
                    unique_cells.append(cell)

                    
            # Get text contents of unique cells + per-cell visual lines for area splitting
            cells_text = []
            cells_paras = []  # list of visual lines, one per cell
            for cell in unique_cells:
                raw_lines = cell.text.split('\n')

                # Full cell text (newlines joined as space) for header/dedup detection
                t = cell.text.strip().replace('\n', ' ')
                if is_bijoy_doc and t and any(c.isalnum() or c in '‡†Ae¯msLcyigwnBDwIq' for c in t):
                    try:
                        t = uc.convert_bijoy_to_unicode(t)
                    except Exception:
                        pass
                cells_text.append(t)

                # Process visual lines for voter areas
                paras = []
                for line in raw_lines:
                    pt = line.strip()
                    if not pt:
                        continue
                    if is_bijoy_doc and any(c.isalnum() or c in '‡†Ae¯msLcyigwnBDwIq' for c in pt):
                        try:
                            pt = uc.convert_bijoy_to_unicode(pt)
                        except Exception:
                            pass
                    pt = pt.rstrip(',，;').strip()
                    if not pt:
                        continue
                        
                    # If this line starts with a bracket, it belongs to the previous voter area
                    # This prevents "(আংশিক)" or similar from becoming a new voter area
                    if pt.startswith('(') and paras:
                        paras[-1] = paras[-1] + ' ' + pt
                    else:
                        paras.append(pt)
                        
                cells_paras.append(paras)
                
            # Deduplicate adjacent string texts for divider detection
            dedup = []
            for t in cells_text:
                if not dedup or dedup[-1] != t:
                    dedup.append(t)
                    
            if not dedup or (len(dedup) == 1 and not dedup[0]):
                continue
                
            row_str = " ".join(dedup)
            
            # A. Detect Thana/Ward/Union section dividers
            if len(dedup) == 1 and any(k in row_str for k in ["ওয়ার্ড", "ইউনিয়ন", "ইউনিয়ন", "উপজেলা", "Union"]):
                sec_text = row_str.strip()

                thana_match = re.search(r'উপজেলা\s*[:\-–]?\s*(.*?)(?=\s*(?:ইউনিয়ন|ইউনিয়ন|ওয়ার্ড|থানা)|$)', sec_text)
                if thana_match:
                    current_thana = thana_match.group(1).strip()
                else:
                    thana_match = re.search(r'থানা\s*[t:ঃ\-–\s]+\s*(.*?)(?=\s*(?:ওয়ার্ড|ইউনিয়ন|ইউনিয়ন|উপজেলা)|$)', sec_text)
                    if thana_match:
                        current_thana = thana_match.group(1).strip()

                union_match = re.search(r'(?:ইউনিয়ন|ইউনিয়ন)\s*[:\-–]?\s*(.*?)(?=\s*(?:ওয়ার্ড|ইউনিয়ন|ইউনিয়ন)|$)', sec_text)
                if union_match:
                    current_ward = f"ইউনিয়ন-{union_match.group(1).strip()}"
                else:
                    ward_match = re.search(r'(?:ওয়ার্ড)\s*নং?\s*[-–\s]*\s*([০-৯\d\-–\s\w]+)', sec_text)
                    if ward_match:
                        current_ward = f"ওয়ার্ড/ইউনিয়ন নং-{ward_match.group(1).strip()}"
                    else:
                        current_ward = sec_text
                continue
                
            # B. Skip helper rows & header rows
            if '১' in dedup and '২' in dedup and '৩' in dedup:
                continue
            if '1' in dedup and '2' in dedup and '3' in dedup:
                continue
            if is_header_row(cells_text):
                continue
                
            # C. Data Row Extraction
            # Calculate minimum required index
            required_cols = [table_center_col]
            if table_area_col_1 >= 0: required_cols.append(table_area_col_1)
            if table_area_col_2 >= 0: required_cols.append(table_area_col_2)
            max_col_index = max(required_cols)
            if len(cells_text) <= max_col_index:
                continue
                
            vot_center = cells_text[table_center_col].strip()
            
            # Fill down center name from previous row if empty (due to vertical merge)
            if not vot_center and data_rows:
                vot_center = data_rows[-1]["vot_center"]
                
            if not vot_center:
                continue
                
            def is_empty_or_dash(s):
                return not s or s.strip() in ['-', '–', '---', '', '0', '০']

            def is_center_text(p, center):
                """Return True if paragraph p is clearly the center name (not a voter area)."""
                pc = clean_text(p).lower()
                cc = clean_text(center).lower()
                # Skip if paragraph IS or CONTAINS the full center name
                if not pc:
                    return True
                if pc == cc or cc in pc:
                    return True
                # Skip if paragraph contains typical center identifiers
                if any(kw in pc for kw in ['বিদ্যালয়', 'বিদ্যালয়', 'মাদ্রাসা', 'মাদরাসা', 'কলেজ', 'মসজিদ', 'মন্দির',
                                            'ইনস্টিটিউট', 'কমিউনিটি', 'পরিষদ', 'ভবন', 'হল',
                                            'পুরুষ ভোটকেন্দ্র', 'মহিলা ভোটকেন্দ্র', 'ভোটকেন্দে্র', 'ভোটকেন্দ্র',
                                            'বিদ্যানিকেতন', 'সরকারি', 'সরকারী', 'স্কুল']):
                    return True
                return False

            # Get paragraphs from area columns (each paragraph = one voter area)
            def get_area_paras(col_idx, center):
                if col_idx < 0 or len(cells_paras) <= col_idx:
                    return []
                result = []
                for p in cells_paras[col_idx]:
                    if is_empty_or_dash(p):
                        continue
                    if is_center_text(p, center):
                        continue
                    result.append(p)
                return result

            paras1 = get_area_paras(table_area_col_1, vot_center)
            paras2 = get_area_paras(table_area_col_2, vot_center)

            # Build unified area list — treat each paragraph as its own voter area
            # Do NOT merge col1/col2 with "/" — that creates false combined strings
            # If both columns have data and same paragraphs, deduplicate
            area_list = []
            if paras1 and paras2:
                # Use union (deduplicated), preserving order from col1 then col2
                seen = set()
                for p in paras1 + paras2:
                    if p not in seen:
                        area_list.append(p)
                        seen.add(p)
            elif paras1:
                area_list = paras1
            elif paras2:
                area_list = paras2
            else:
                # Fallback: use the merged cell text (single paragraph cells)
                val1 = cells_text[table_area_col_1].strip() if table_area_col_1 >= 0 and len(cells_text) > table_area_col_1 else ""
                val2 = cells_text[table_area_col_2].strip() if table_area_col_2 >= 0 and len(cells_text) > table_area_col_2 else ""
                # Filter out center text from fallback values too
                if not is_center_text(val1, vot_center) and not is_empty_or_dash(val1):
                    area_list.append(val1)
                if not is_center_text(val2, vot_center) and not is_empty_or_dash(val2) and val2 != val1:
                    area_list.append(val2)

            if not area_list:
                continue

            for voter_area in area_list:
                voter_area = clean_text(voter_area)
                if is_empty_or_dash(voter_area):
                    continue
                if not is_valid_entry(vot_center, voter_area):
                    continue
                record = {
                    "thana": current_thana if current_thana else thana_from_p,
                    "ward_no": current_ward,
                    "vot_center": clean_text(vot_center),
                    "voter_area": voter_area,
                    "source_file": filename
                }
                data_rows.append(record)
            
    return data_rows

def main():
    global CENTER_COL, AREA_COL_1, AREA_COL_2
    
    if not os.path.exists(docx_dir):
        print(f"Error: Word folder {docx_dir} does not exist.")
        return
        
    docx_files = sorted([f for f in os.listdir(docx_dir) if f.endswith('.docx') and not f.startswith('~$')])
    print(f"Found {len(docx_files)} DOCX files to process in folder order.")
    
    # Load configuration file if specified
    column_configs = {}
    if CONFIG_FILE and os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                column_configs = json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load config file: {e}")
            
    all_records = []
    
    for filename in docx_files:
        filepath = os.path.join(docx_dir, filename)
        
        # Override globals for this file from config
        file_config = column_configs.get(filename, {})
        CENTER_COL = file_config.get("center_col", args_parsed.center_col)
        AREA_COL_1 = file_config.get("area_col_1", args_parsed.area_col_1)
        AREA_COL_2 = file_config.get("area_col_2", args_parsed.area_col_2)
        
        records = process_single_docx(filepath, column_configs)
        all_records.extend(records)
        print(f"  -> Extracted {len(records)} rows from {filename} (cols: Center={CENTER_COL}, Area1={AREA_COL_1}, Area2={AREA_COL_2}).")
        
    if not all_records and not docx_files:
        print("No DOCX files found.")
        return
        
    # Save output to JSON and CSV using standard library (Zero pandas dependency, fast & reliable)
    os.makedirs(output_dir, exist_ok=True)
    
    seen_keys = set()
    df_final = []
    
    for r in all_records:
        thana = str(r.get('thana', '') or '').strip()
        ward_no = str(r.get('ward_no', '') or '').strip()
        vot_center = str(r.get('vot_center', '') or '').strip()
        voter_area = str(r.get('voter_area', '') or '').strip()
        source_file = str(r.get('source_file', '') or '').strip()
        
        if len(vot_center) <= 2 or len(voter_area) <= 1:
            continue
            
        dedup_key = (thana, ward_no, vot_center, voter_area)
        if dedup_key in seen_keys:
            continue
            
        seen_keys.add(dedup_key)
        df_final.append({
            'thana': thana,
            'ward_no': ward_no,
            'vot_center': vot_center,
            'voter_area': voter_area,
            'source_file': source_file
        })
    
    try:
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(df_final, f, ensure_ascii=False, indent=4)
            
        fieldnames = ['thana', 'ward_no', 'vot_center', 'voter_area', 'source_file']
        with open(output_csv, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(df_final)
    except PermissionError:
        print(f"\n[ERROR] Permission Denied: Could not write output files in {output_dir}.")
        print("Please close 'extracted_columns.csv' and 'extracted_columns.json' in Excel or other viewers, and run again.\n")
        sys.exit(1)
                
    print(f"\nExtraction complete!")
    print(f"Saved JSON to: {output_json}")
    print(f"Saved CSV to: {output_csv}")
    print(f"Raw extracted rows: {len(all_records)}, After deduplication: {len(df_final)}")

if __name__ == '__main__':
    main()
