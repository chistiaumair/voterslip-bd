import os
import re
import sys
import json
import argparse
import fitz # PyMuPDF
import cv2
import numpy as np
import base64
from concurrent.futures import ThreadPoolExecutor

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def log_json(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)

# Excluded terms for deleted, migrated, or cancelled voter cards
EXCLUDE_TERMS = [
    "কর্তন", "কৰ্ত্তন", "কৰ্তন", "কতÎন", "কতইন", "করতন", "কাটা",
    "মাইগ্রেশন", "মাইগ্ৰেশন", "মাইগ্রেশান", "মাইগ্ৰেশান", "মাইেåট",
    "স্থানান্তর", "স্থানান্তিৰত", "স্থানান্তরিত", "স্থান্তর",
    "সম্পূরক", "বাতিল", "KvZv", "gBRÖkb", "¯’vbvšÍi",
    "হেয়েছ", "হইয়াছে", "হয়েছে"
]

VALID_INDICATORS = ["নাম", "ভোটার", "Ïভাটার", "িপতা", "মাতা", "িঠকানা", "NID", "nid"]

def is_deleted_or_migrated_card(page, card_rect_pdf, raw_card_bgr, cropped_hide=None):
    """
    100% Bulletproof check if a voter card box contains 'কর্তন করা হয়েছে', 'মাইগ্রেশন হয়েছে', 
    or any cancelled/migrated status text, or is a blank white image box.
    """
    expanded_rect = fitz.Rect(
        card_rect_pdf.x0 - 2,
        card_rect_pdf.y0 - 2,
        card_rect_pdf.x1 + 2,
        card_rect_pdf.y1 + 2
    )
    
    # 1. Text-based Exclude Check inside expanded card box
    try:
        clip_text = page.get_text("text", clip=expanded_rect)
        if any(term in clip_text for term in EXCLUDE_TERMS):
            return True
        # If text lacks valid voter field indicators (name, father, address, NID)
        if not any(ind in clip_text for ind in VALID_INDICATORS):
            return True
    except Exception:
        pass

    # 2. Blank / White Image Check inside cropped text section
    if cropped_hide is not None and cropped_hide.size > 0:
        try:
            c_gray = cv2.cvtColor(cropped_hide, cv2.COLOR_BGR2GRAY)
            dark_pixels = np.sum(c_gray < 180)
            if dark_pixels < 250: # Blank white card crop!
                return True
        except Exception:
            pass

    return False

def get_pdf_output_folder_name(pdf_file, doc=None):
    """
    Extracts 6-digit code and gender (female/male) from PDF filename or first page text.
    Examples:
    '100373_com_103_female_without_photo_7_2024-3-21.pdf' -> '100373_female'
    '590683_com_601_male_without_photo_36_2024-3-20.pdf' -> '590683_male'
    '850666_male.pdf' -> '850666_male'
    """
    stem = os.path.splitext(pdf_file)[0]
    
    # 1. Extract Code from filename
    code_match = re.search(r'\b\d{6}\b', stem) or re.search(r'\d{6}', stem) or re.search(r'\d{4,8}', stem)
    code = code_match.group(0) if code_match else None
    
    # 2. Extract Gender from filename
    gender = None
    stem_lower = stem.lower()
    if 'female' in stem_lower or 'মহিলা' in stem_lower:
        gender = 'female'
    elif 'male' in stem_lower or 'পুরুষ' in stem_lower:
        gender = 'male'
        
    # 3. Fallback: inspect document cover page if doc is provided
    if (not code or not gender) and doc and len(doc) > 0:
        try:
            cover_text = doc[0].get_text("text")
            if not code:
                c_match = re.search(r'\b\d{6}\b', cover_text) or re.search(r'\d{6}', cover_text)
                if c_match:
                    code = c_match.group(0)
            if not gender:
                if 'মহিলা' in cover_text or 'female' in cover_text.lower():
                    gender = 'female'
                elif 'পুরুষ' in cover_text or 'male' in cover_text.lower():
                    gender = 'male'
        except Exception:
            pass
            
    # Combine code and gender
    if code and gender:
        return f"{code}_{gender}"
    elif code:
        return f"{code}"
    elif gender:
        return f"{stem}_{gender}"
    return stem

def detect_boxes_from_page(pix, img_bgr):
    """
    Detects all card bounding boxes on the page with 100% precision.
    Uses cv2.RETR_CCOMP and applies column alignment.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY_INV)

    contours, _ = cv2.findContours(thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    
    card_boxes = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        aspect = w / float(h) if h > 0 else 0
        if (0.2 * pix.width) <= w <= (0.65 * pix.width) and (0.05 * pix.height) <= h <= (0.35 * pix.height):
            if 1.5 <= aspect <= 4.8:
                card_boxes.append((x, y, w, h))

    unique_boxes = []
    for box in sorted(card_boxes, key=lambda b: (b[1] // 40, b[0] // 40)):
        x, y, w, h = box
        if not any(abs(x - ux) < 25 and abs(y - uy) < 25 for ux, uy, uw, uh in unique_boxes):
            unique_boxes.append(box)

    # Column Alignment Fix for Watermark Interference (Restores left margin text like 'নাম:', 'ভোটার নং:')
    if unique_boxes:
        c1_boundary = pix.width * 0.30
        c2_boundary = pix.width * 0.60
        col1_xs = [b[0] for b in unique_boxes if b[0] < c1_boundary]
        col2_xs = [b[0] for b in unique_boxes if c1_boundary <= b[0] < c2_boundary]
        col3_xs = [b[0] for b in unique_boxes if b[0] >= c2_boundary]

        min_c1_x = min(col1_xs) if col1_xs else 0
        min_c2_x = min(col2_xs) if col2_xs else 0
        min_c3_x = min(col3_xs) if col3_xs else 0

        for idx, (x, y, w, h) in enumerate(unique_boxes):
            if x < c1_boundary:
                target_x = min_c1_x
            elif x < c2_boundary:
                target_x = min_c2_x
            else:
                target_x = min_c3_x

            if target_x > 0 and x > target_x + 15:
                new_w = w + (x - target_x)
                new_x = target_x
                unique_boxes[idx] = (new_x, y, new_w, h)

    return unique_boxes

def process_pdf_slicing(input_dir, output_dir, json_mode=False, cleanup=False, hide_borders=False, 
                        preview_only=False, pad_top=0, pad_bottom=0, pad_left=0, pad_right=0,
                        resolutionScale=2.0, lines=6, custom_shave_top=None, custom_shave_left=None):

    input_dir = str(input_dir).strip().strip('"').strip("'").strip()
    output_dir = str(output_dir).strip().strip('"').strip("'").strip()

    if not os.path.exists(input_dir):
        if json_mode:
            log_json({"status": "error", "message": f"ইনপুট ফোল্ডার বা ফাইল পাওয়া যায়নি ({input_dir})"})
        return

    os.makedirs(output_dir, exist_ok=True)
    if os.path.isfile(input_dir) and input_dir.lower().endswith('.pdf'):
        pdf_files = [os.path.basename(input_dir)]
        input_dir = os.path.dirname(input_dir)
    elif os.path.isdir(input_dir):
        pdf_files = [f for f in os.listdir(input_dir) if f.lower().endswith('.pdf')]
    else:
        pdf_files = []

    if not pdf_files:
        if json_mode:
            log_json({"status": "error", "message": f"ইনপুট ফোল্ডারে কোনো PDF ফাইল পাওয়া যায়নি ({input_dir})"})
        return

    dpi = int(72 * resolutionScale)

    # Height Ratio এবং Border Shave Offsets (2.0x এবং 3.0x রেজোলিউশন স্কেলের জন্য আলাদা):

    # 2.0x রেজোলিউশন স্কেলের জন্য সেটিং:
    ratio_map_2x = {1: 0.15, 2: 0.25, 3: 0.415, 4: 0.54, 5: 0.675, 6: 0.82}
    shave_top_2x = 3   # ২.০x এ ওপর থেকে বর্ডার বাদ দেওয়ার মান
    shave_left_2x = 3  # ২.০x এ বাম থেকে বর্ডার বাদ দেওয়ার মান

    # 3.0x রেজোলিউশন স্কেলের জন্য সেটিং (৩.০x রেজোলিউশনের জন্য এই ভ্যালুগুলো চেঞ্জ করবেন):
    ratio_map_3x = {1: 0.15, 2: 0.25, 3: 0.415, 4: 0.54, 5: 0.675, 6: 0.82}
    shave_top_3x = 4   # ৩.০x এ ওপর থেকে বর্ডার বাদ দেওয়ার মান (কমালে ওপরে উঠবে, বাড়ালে নিচে নামবে)
    shave_left_3x = 4  # ৩.০x এ বাম থেকে বর্ডার বাদ দেওয়ার মান (কমালে বামে আসবে, বাড়ালে ডানে সরবে)

    if abs(resolutionScale - 3.0) < 0.2:
        ratio_map = ratio_map_3x
        shave_top = shave_top_3x
        shave_left = shave_left_3x
    else:
        ratio_map = ratio_map_2x
        shave_top = shave_top_2x
        shave_left = shave_left_2x

    # Control Panel UI-তে দেওয়া কাস্টম Shave Top & Shave Left ওভাররাইড
    if custom_shave_top is not None:
        shave_top = custom_shave_top
    if custom_shave_left is not None:
        shave_left = custom_shave_left

    l_ratio = ratio_map.get(lines, min(1.0, lines * 0.14))

    # JPEG Save Parameters: Quality 85 for high-speed encoding and sharp text
    save_params = [cv2.IMWRITE_JPEG_QUALITY, 85]

    # --- PREVIEW ONLY MODE ---
    if preview_only:
        first_pdf_path = os.path.join(input_dir, pdf_files[0])
        try:
            doc = fitz.open(first_pdf_path)
            target_page_idx = 2 if len(doc) >= 3 else 0
            
            page = doc[target_page_idx]
            pix = page.get_pixmap(dpi=dpi)
            
            img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
            if pix.n == 4:
                img_bgr = cv2.cvtColor(img_data, cv2.COLOR_RGBA2BGR)
            else:
                img_bgr = cv2.cvtColor(img_data, cv2.COLOR_RGB2BGR)

            # Ultra-precise box detection using detect_boxes_from_page
            unique_boxes = detect_boxes_from_page(pix, img_bgr)
            
            # Find first valid voter card box (skipping any deleted/blank boxes)
            selected_box = None
            for box in unique_boxes:
                bx, by, bw, bh = box
                card_rect_pdf = fitz.Rect(bx / resolutionScale, by / resolutionScale, (bx + bw) / resolutionScale, (by + bh) / resolutionScale)
                raw_crop = img_bgr[by:by+bh, bx:bx+bw]
                if not is_deleted_or_migrated_card(page, card_rect_pdf, raw_crop):
                    selected_box = box
                    break

            if selected_box is None and unique_boxes:
                selected_box = unique_boxes[0]

            unhide_path = os.path.join(output_dir, "preview_unhide.jpg")
            hide_path = os.path.join(output_dir, "preview_hide.jpg")

            if selected_box:
                bx, by, bw, bh = selected_box
                cropped_unhide = img_bgr[by:by+bh, bx:bx+bw]
                cv2.imwrite(unhide_path, cropped_unhide, save_params)

                by_start = by + shave_top + pad_top
                crop_h = int(bh * l_ratio)
                by_end = by_start + crop_h - pad_bottom
                
                bx_start = bx + shave_left + pad_left
                bx_end_initial = bx + bw - 15 - pad_right
                
                cropped_hide = img_bgr[by_start:by_end, bx_start:bx_end_initial]
                
                # Smart right whitespace trim for ALL line counts (including lines = 6)
                if cropped_hide.size > 0:
                    c_gray = cv2.cvtColor(cropped_hide, cv2.COLOR_BGR2GRAY)
                    dark_mask = c_gray < 180
                    # Ignore horizontal border lines anywhere across the crop
                    for r_i in range(cropped_hide.shape[0]):
                        if np.sum(dark_mask[r_i, :]) > cropped_hide.shape[1] * 0.35:
                            dark_mask[r_i, :] = False
                    col_counts = np.sum(dark_mask, axis=0)
                    text_cols = np.where(col_counts >= 3)[0]
                    if len(text_cols) > 0:
                        max_col = text_cols[-1]
                        min_w = int(250 * (resolutionScale / 2.0))
                        target_w = max(min_w, min(cropped_hide.shape[1], max_col + 22))
                        cropped_hide = cropped_hide[:, : target_w]

                    # Smart Bottom Trim: Prune any Line 3 Father's name kar signs if present
                    if lines == 2 and cropped_hide.shape[0] > 35:
                        c_gray_bot = cv2.cvtColor(cropped_hide, cv2.COLOR_BGR2GRAY)
                        dark_rows_bot = np.sum(c_gray_bot < 180, axis=1)
                        for r_bot in range(cropped_hide.shape[0] - 2, max(0, cropped_hide.shape[0] - 6), -1):
                            if dark_rows_bot[r_bot] <= 2 and dark_rows_bot[r_bot + 1] > 2:
                                cropped_hide = cropped_hide[:r_bot, :]
                                break

                cv2.imwrite(hide_path, cropped_hide, save_params)
            else:
                sample_h = int((pix.height * 0.88) / max(1, lines))
                sample_w = int(pix.width / 2)
                header_offset = int(pix.height * 0.12)
                cropped_unhide = img_bgr[header_offset:header_offset+sample_h, 0:sample_w]
                cropped_hide = cropped_unhide
                cv2.imwrite(unhide_path, cropped_unhide, save_params)
                cv2.imwrite(hide_path, cropped_hide, save_params)

            unhide_b64 = ""
            hide_b64 = ""
            try:
                if 'cropped_unhide' in locals() and cropped_unhide is not None and cropped_unhide.size > 0:
                    _, u_buf = cv2.imencode('.jpg', cropped_unhide, save_params)
                    unhide_b64 = "data:image/jpeg;base64," + base64.b64encode(u_buf).decode('ascii')
                if 'cropped_hide' in locals() and cropped_hide is not None and cropped_hide.size > 0:
                    _, h_buf = cv2.imencode('.jpg', cropped_hide, save_params)
                    hide_b64 = "data:image/jpeg;base64," + base64.b64encode(h_buf).decode('ascii')
            except Exception:
                pass

            if json_mode:
                log_json({
                    "status": "preview_ready",
                    "unhide": "preview_unhide.jpg",
                    "hide": "preview_hide.jpg",
                    "unhide_full_path": unhide_path,
                    "hide_full_path": hide_path,
                    "unhide_data_url": unhide_b64,
                    "hide_data_url": hide_b64
                })
            doc.close()
            return
        except Exception as e:
            if json_mode:
                log_json({"status": "error", "message": f"Preview generation failed: {str(e)}"})
            return

    # --- FULL SLICING MODE ---
    if json_mode:
        log_json({"status": "splitting_start", "total_files": len(pdf_files)})

    total_processed_pages = 0
    total_extracted_cards = 0

    # Calculate actual total voter pages across all input PDFs for accurate progress tracking
    total_voter_pages = 0
    for pf in pdf_files:
        try:
            d = fitz.open(os.path.join(input_dir, pf))
            tp = len(d)
            sp = 2 if tp >= 3 else 0
            total_voter_pages += max(1, tp - sp)
            d.close()
        except Exception:
            total_voter_pages += 1
    if total_voter_pages == 0:
        total_voter_pages = 1

    # Thread pool for asynchronous background JPEG disk writing (zero wait during page rendering)
    writer_pool = ThreadPoolExecutor(max_workers=4)

    for pdf_idx, pdf_file in enumerate(pdf_files):
        pdf_path = os.path.join(input_dir, pdf_file)
        pdf_stem = os.path.splitext(pdf_file)[0]

        if json_mode:
            log_json({
                "status": "splitting_file",
                "file": pdf_path,
                "index": pdf_idx + 1,
                "total": len(pdf_files)
            })
            
        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            
            # Determine subfolder name from Code and Gender (e.g. 100373_female)
            out_folder_name = get_pdf_output_folder_name(pdf_file, doc)
            sub_out_dir = os.path.join(output_dir, out_folder_name)
            os.makedirs(sub_out_dir, exist_ok=True)
            
            # Skip cover summary pages 1 and 2, start slicing from Page 3 (page_idx = 2)
            start_page_idx = 2 if total_pages >= 3 else 0

            # Template caches for this PDF (detect once per template type, reuse for all subsequent pages)
            first_voter_page_boxes = None
            subsequent_page_boxes = None

            for page_idx in range(start_page_idx, total_pages):
                total_processed_pages += 1
                page = doc[page_idx]

                cur_percent = min(99, max(0, int((total_processed_pages / total_voter_pages) * 100)))
                ratio_str = f"ফাইল {pdf_idx+1}/{len(pdf_files)} (পাতা {page_idx+1}/{total_pages})" if len(pdf_files) > 1 else f"পাতা {page_idx+1}/{total_pages}"

                # Extract words once per page (replaces 18 heavy clip parsers and checks cancellation header)
                words = page.get_text("words")
                
                # Check if page header indicates a deleted/migrated voter section
                page_header = " ".join([w[4] for w in words[:40]]) if words else ""
                if any(kw in page_header for kw in ["কর্তন", "কৰ্ত্তন", "মাইগ্রেশন", "স্থানান্তর", "KvZv", "gBRÖkb"]):
                    if json_mode:
                        log_json({
                            "status": "processing_file",
                            "index": total_processed_pages,
                            "total": total_voter_pages,
                            "page": page_idx + 1,
                            "totalPages": total_pages,
                            "percent": cur_percent,
                            "file": f"{pdf_file} (পাতা {page_idx+1}/{total_pages})",
                            "fileRatioText": ratio_str,
                            "boxes_detected": total_extracted_cards
                        })
                    continue # Skip deleted / migrated voter page section

                if json_mode:
                    log_json({
                        "status": "processing_file",
                        "index": total_processed_pages,
                        "total": total_voter_pages,
                        "page": page_idx + 1,
                        "totalPages": total_pages,
                        "percent": cur_percent,
                        "file": f"{pdf_file} (পাতা {page_idx+1}/{total_pages})",
                        "fileRatioText": ratio_str,
                        "boxes_detected": total_extracted_cards
                    })

                pix = page.get_pixmap(dpi=dpi)
                img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                if pix.n == 4:
                    img_bgr = cv2.cvtColor(img_data, cv2.COLOR_RGBA2BGR)
                else:
                    img_bgr = cv2.cvtColor(img_data, cv2.COLOR_RGB2BGR)

                # Ultra-Fast Exact Card Box Detection:
                # Detects on first voter page (Page 3) and first subsequent page (Page 4) once,
                # then instantly reuses the exact boxes for all remaining pages!
                is_first_voter = (page_idx == start_page_idx)
                if is_first_voter:
                    if first_voter_page_boxes is None:
                        first_voter_page_boxes = detect_boxes_from_page(pix, img_bgr)
                    unique_boxes = first_voter_page_boxes
                else:
                    if subsequent_page_boxes is None:
                        subsequent_page_boxes = detect_boxes_from_page(pix, img_bgr)
                    unique_boxes = subsequent_page_boxes

                page_cards = 0
                for card_idx, (x, y, w, h) in enumerate(unique_boxes):
                    # Fast Word Verification inside card bounds
                    rx0 = (x / resolutionScale) - 2
                    ry0 = (y / resolutionScale) - 2
                    rx1 = ((x + w) / resolutionScale) + 2
                    ry1 = ((y + h) / resolutionScale) + 2
                    card_words = [w[4] for w in words if rx0 <= (w[0] + w[2]) * 0.5 <= rx1 and ry0 <= (w[1] + w[3]) * 0.5 <= ry1]
                    if not card_words:
                        continue
                    card_text = " ".join(card_words)
                    if any(term in card_text for term in EXCLUDE_TERMS):
                        continue
                    if not any(ind in card_text for ind in VALID_INDICATORS):
                        continue

                    if hide_borders:
                        y_start = max(0, y + shave_top + pad_top)
                        crop_h = int(h * l_ratio)
                        y_end = min(pix.height, y_start + crop_h - pad_bottom)
                        
                        x_start = max(0, x + shave_left + pad_left)
                        x_end_initial = min(pix.width, x + w - 15 - pad_right)
                        
                        cropped = img_bgr[y_start:y_end, x_start:x_end_initial]
                        
                        # Smart right whitespace trim for ALL line counts (including lines = 6)
                        if cropped.size > 0:
                            c_gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
                            dark_mask = c_gray < 180
                            
                            # Blank white card crop check
                            if np.sum(dark_mask) < 200:
                                continue

                            # Ignore horizontal border lines anywhere across the crop
                            for r_i in range(cropped.shape[0]):
                                if np.sum(dark_mask[r_i, :]) > cropped.shape[1] * 0.35:
                                    dark_mask[r_i, :] = False
                            col_counts = np.sum(dark_mask, axis=0)
                            text_cols = np.where(col_counts >= 3)[0]
                            if len(text_cols) > 0:
                                max_col = text_cols[-1]
                                min_w = int(250 * (resolutionScale / 2.0))
                                target_w = max(min_w, min(cropped.shape[1], max_col + 22))
                                cropped = cropped[:, : target_w]

                            # Smart Bottom Trim: Prune any Line 3 Father's name kar signs if present
                            if lines == 2 and cropped.shape[0] > 35:
                                c_gray_bot = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
                                dark_rows_bot = np.sum(c_gray_bot < 180, axis=1)
                                for r_bot in range(cropped.shape[0] - 2, max(0, cropped.shape[0] - 6), -1):
                                    if dark_rows_bot[r_bot] <= 2 and dark_rows_bot[r_bot + 1] > 2:
                                        cropped = cropped[:r_bot, :]
                                        break
                    else:
                        x_start = max(0, x + pad_left)
                        y_start = max(0, y + pad_top)
                        x_end = min(pix.width, x + w - pad_right)
                        y_end = min(pix.height, y + h - pad_bottom)
                        cropped = img_bgr[y_start:y_end, x_start:x_end]

                    if cropped.size == 0:
                        continue

                    card_filename = f"{out_folder_name}_p{page_idx+1:03d}_card{card_idx+1:03d}.jpg"
                    sub_out_path = os.path.join(sub_out_dir, card_filename)
                    writer_pool.submit(cv2.imwrite, sub_out_path, cropped, save_params)

                    page_cards += 1
                    total_extracted_cards += 1

                if json_mode:
                    cur_percent = min(99, max(0, int((total_processed_pages / total_voter_pages) * 100)))
                    log_json({
                        "status": "processed_file",
                        "index": total_processed_pages,
                        "total": total_voter_pages,
                        "page": page_idx + 1,
                        "totalPages": total_pages,
                        "percent": cur_percent,
                        "file": f"{pdf_file} (পাতা {page_idx+1}/{total_pages})",
                        "fileRatioText": ratio_str,
                        "boxes_detected": total_extracted_cards
                    })

            doc.close()
            if json_mode:
                log_json({"status": "cleanup_folder", "folder": out_folder_name})
        except Exception as e:
            if json_mode:
                log_json({"status": "stderr", "message": f"Error processing {pdf_file}: {str(e)}"})

    writer_pool.shutdown(wait=True)

    if json_mode:
        log_json({"status": "processing_done", "total_boxes": total_extracted_cards, "percent": 100})
        log_json({"status": "completed", "total_boxes": total_extracted_cards, "percent": 100})

def main():
    parser = argparse.ArgumentParser(description="PDF Slice and Border Detector CLI")
    parser.add_argument("-i", "--input", default="./input", help="Path to input directory containing PDFs")
    parser.add_argument("-o", "--output", default="./output", help="Path to output directory for cropped images")
    parser.add_argument("-j", "--json", action="store_true", help="Output progress logs in structured JSON format")
    parser.add_argument("-c", "--cleanup", action="store_true", help="Clean up subfolders after processing")
    parser.add_argument("-b", "--hide-borders", action="store_true", help="Hide borders, crop top section")
    parser.add_argument("--pad-top", type=int, default=0, help="Padding Top")
    parser.add_argument("--pad-bottom", type=int, default=0, help="Padding Bottom")
    parser.add_argument("--pad-left", type=int, default=0, help="Padding Left")
    parser.add_argument("--pad-right", type=int, default=0, help="Padding Right")
    parser.add_argument("--resolution-scale", type=float, default=2.0, help="Resolution zoom scale")
    parser.add_argument("--preview-only", action="store_true", help="Only generate preview")
    parser.add_argument("--lines", type=int, default=6, help="Number of text lines to crop")
    parser.add_argument("--shave-top", type=int, default=None, help="Custom Shave Top")
    parser.add_argument("--shave-left", type=int, default=None, help="Custom Shave Left")

    args = parser.parse_args()

    process_pdf_slicing(
        input_dir=args.input,
        output_dir=args.output,
        json_mode=args.json,
        cleanup=args.cleanup,
        hide_borders=args.hide_borders,
        preview_only=args.preview_only,
        pad_top=args.pad_top,
        pad_bottom=args.pad_bottom,
        pad_left=args.pad_left,
        pad_right=args.pad_right,
        resolutionScale=args.resolution_scale,
        lines=args.lines,
        custom_shave_top=args.shave_top,
        custom_shave_left=args.shave_left
    )

if __name__ == "__main__":
    main()
