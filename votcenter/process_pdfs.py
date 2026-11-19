import os
import re
import sys
import json
import difflib
import pdfplumber

import argparse

# Set console output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

base_dir = os.path.dirname(os.path.abspath(__file__))
default_pdf_dir = os.path.join(base_dir, "allpdf")
default_output_dir = os.path.join(base_dir, "extracted_data")
default_ref_file = os.path.join(default_output_dir, "extracted_columns.json")

parser = argparse.ArgumentParser(description="Process voter list PDFs.")
parser.add_argument("-i", "--input", default=default_pdf_dir, help="PDF input directory")
parser.add_argument("-o", "--output", default=default_output_dir, help="Output directory")
parser.add_argument("-r", "--ref", default=default_ref_file, help="Reference extracted_columns.json file")
args_parsed, unknown = parser.parse_known_args()

pdf_dir = args_parsed.input
output_dir = args_parsed.output
output_json = os.path.join(output_dir, "extracted_pdf_data.json")
word_data_file = args_parsed.ref

# Font replacement dictionary to normalize custom font encoding in Bengali voter list PDFs
cid_replacements = {
    '(cid:344)': 'শ্র',
    '(cid:381)': 'গু',
    '(cid:324)': 'ম্ব',
    '(cid:303)': 'ন্য',
    '(cid:206)': 'র্',
    '(cid:207)': 'ে',
    '(cid:308)': 'প্র',
    '(cid:419)': 'কু',
    '(cid:229)': 'গ্র',
    '(cid:297)': 'ন্সী',
    '(cid:253)': 'ঞ্জ',
    '(cid:275)': 'ত্ত',
    '(cid:385)': 'রু'
}

# Word-level cleanups to correct known PDF typography anomalies dynamically
word_cleanups = {
    "ঝােলা": "ঝালো",
    "বািলয়া": "বালিয়া",
    "রািজব": "রাজীব",
    "কাউিন": "কাউনি",
    "পূবর্": "পূর্ব",
    "উত্কর": "উত্তর",
    "উত্র": "উত্তর",
    "ঠাকর": "ঠাকুর",
    "েদউলেভাগ": "দেউলেভাগ",
    "িসিট": "সিটি",
    "কেপ(cid:206)ােরশন": "কর্পোরেশন",
    "কেপরােরশন": "কর্পোরেশন"
}

# Load Word document data for fuzzy spelling matching
word_entries = []
if os.path.exists(word_data_file):
    try:
        with open(word_data_file, 'r', encoding='utf-8') as f:
            word_entries = json.load(f)
        print(f"Loaded {len(word_entries)} reference records from Word data ({word_data_file}).")
    except Exception as e:
        print(f"Warning: Could not load Word data from {word_data_file}: {e}")
else:
    print(f"Warning: Word reference data not found at {word_data_file}. Fallback cleaning will be used.")

def clean_cid_text(text):
    for cid, rep in cid_replacements.items():
        text = text.replace(cid, rep)
    return text

def clean_bengali_spelling(text):
    if not text:
        return ""
    for typo, correct in word_cleanups.items():
        text = text.replace(typo, correct)
    return text

def extract_digits(s):
    if not s:
        return ""
    # Extract only Bengali/English digits
    digits = re.findall(r'[\u09E6-\u09EF\d]+', s)
    return "".join(digits)

def normalize_and_get_skeleton(s):
    if not s:
        return ""
    # Remove text in parentheses (e.g. "(উত্তর)", "(আংশিক)")
    s = re.sub(r'\(.*?\)', '', s)
    s = re.sub(r'（.*?）', '', s)
    # Strip vowels, signs, spaces, hyphens
    s = re.sub(r'[\s\(\)-]', '', s)
    bengali_vowels_and_signs = r'[\u0985-\u0994\u09BE-\u09CC\u09D7\u09E2\u09E3]'
    s = re.sub(bengali_vowels_and_signs, '', s)
    s = re.sub(r'[a-zA-Z\d০-৯]', '', s)
    # Sort the remaining consonant characters to make it order-invariant
    return "".join(sorted(list(s)))

def find_fuzzy_match_from_word(pdf_voter_area):
    if not pdf_voter_area or not word_entries:
        return "", pdf_voter_area
        
    # 1. Gather all candidate voter areas with their corresponding vot_center
    candidates = []
    for row in word_entries:
        raw_areas = row.get("voter_area", "")
        vot_center = row.get("vot_center", "")
        if raw_areas:
            # Split comma-separated voter areas from Word columns
            for area in re.split(r'[,;।]', raw_areas):
                clean_area = area.strip()
                if clean_area:
                    candidates.append({
                        "voter_area": clean_area,
                        "vot_center": vot_center
                    })
                        
    if not candidates:
        return "", pdf_voter_area
        
    # 2. Fuzzy match the PDF voter area against the candidates list
    best_ratio = 0
    best_match = None
    
    pdf_skel = normalize_and_get_skeleton(pdf_voter_area)
    
    for cand in candidates:
        cand_skel = normalize_and_get_skeleton(cand["voter_area"])
        ratio = difflib.SequenceMatcher(None, pdf_skel, cand_skel).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = cand
            
    # Use matching spelling if correlation of consonant skeletons is above 85%
    if best_ratio >= 0.85 and best_match:
        return best_match["vot_center"], best_match["voter_area"]
    return "", pdf_voter_area

def main():
    print(f"Scanning PDF folder: {pdf_dir}")
    if not os.path.exists(pdf_dir):
        print(f"Error: PDF directory {pdf_dir} does not exist.")
        return
        
    pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith('.pdf')]
    print(f"Found {len(pdf_files)} PDF files to process.")
    
    extracted_records = []
    
    for idx, filename in enumerate(pdf_files):
        pdf_path = os.path.join(pdf_dir, filename)
        print(f"[{idx+1}/{len(pdf_files)}] Processing: {filename}")
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if not pdf.pages:
                    print(f"  -> Warning: {filename} has no pages. Skipping.")
                    continue
                first_page = pdf.pages[0]
                raw_text = first_page.extract_text()
                
                if not raw_text:
                    print(f"  -> Warning: No text could be extracted from first page of {filename}. Skipping.")
                    continue
                    
                # Clean text of custom font artifacts
                text = clean_cid_text(raw_text)
                lines = [line.strip() for line in text.split('\n') if line.strip()]
                
                record = {
                    "filename": filename,
                    "thana": "",
                    "ward_no": "",
                    "voter_area": "",
                    "voter_area_no": "",
                    "gender": "",
                    "gender_voters": ""
                }
                
                for line in lines:
                    # 1. Thana / Upazila
                    if 'উপেজলা/থানা' in line:
                        parts = line.split('উপেজলা/থানা')
                        if len(parts) > 1:
                            raw_thana = parts[1].strip().split()[0]
                            record["thana"] = clean_bengali_spelling(raw_thana)
                                
                    # 2. Ward No
                    if 'ইউিনয়ন পিরষেদর' in line or 'ইউনিয়ন পরিষদের' in line or 'পিরষেদর' in line or 'পিরষদের' in line:
                        match = re.search(r'\)\s*([^\s]+)$', line)
                        if match:
                            record["ward_no"] = match.group(1).strip()
                            
                    # 3. Voter Area
                    if ('ভাটার এলাকা' in line or 'ভোটার এলাকা' in line) and 'এলাকার' not in line:
                        words = line.split()
                        idx_total = -1
                        for w_idx, w in enumerate(words):
                            if w_idx >= 2 and w.startswith('সব') and (w.endswith('ট') or 'মাট' in w or 'মোট' in w or 'েমাট' in w):
                                idx_total = w_idx
                                break
                        if idx_total != -1:
                            raw_area = " ".join(words[2:idx_total])
                        else:
                            raw_area = " ".join(words[2:-3])
                        
                        record["voter_area"] = clean_bengali_spelling(raw_area)
                            
                    # 4. Voter Area Number, Gender and Gender Voters Count
                    if 'ভাটার এলাকার' in line or 'ভোটার এলাকার' in line:
                        # Extract Voter Area Number
                        match_no = re.search(r'(?:নম্বর|নমর|নম্বর)\s+([০-৯\d]+)\s+(?:েমাট|মোট)', line)
                        if match_no:
                            record["voter_area_no"] = match_no.group(1).strip()
                        else:
                            words = line.split()
                            for w in words:
                                if re.match(r'^[০-৯\d]+$', w):
                                    record["voter_area_no"] = w
                                    break
                                    
                        # Extract Gender type
                        if 'মিহলা' in line or 'মহিলা' in line:
                            record["gender"] = "Female"
                        elif 'পুরুষ' in line or 'পুরুষ' in line or 'পুরষ' in line:
                            record["gender"] = "Male"
                            
                        # Extract Gender voters count
                        words = line.split()
                        if words:
                            record["gender_voters"] = words[-1]
                
                # Apply fuzzy matching to correct voter_area spelling using Word document reference data
                matched_center, matched_area = find_fuzzy_match_from_word(record["voter_area"])
                
                record["vot_center"] = matched_center
                record["voter_area"] = matched_area
                
                extracted_records.append(record)
        except Exception as e:
            print(f"  -> Error processing {filename}: {str(e)}")
            
    # Save output to JSON
    os.makedirs(output_dir, exist_ok=True)
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(extracted_records, f, ensure_ascii=False, indent=4)
        
    print(f"\nPDF Processing Complete!")
    print(f"Saved extracted JSON to: {output_json}")
    print(f"Total files processed successfully: {len(extracted_records)}")

if __name__ == '__main__':
    main()
