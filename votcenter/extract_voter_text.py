import os
import re
import sys
import json
import csv
import argparse
import fitz  # PyMuPDF

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# ==============================================================================
# Comprehensive Exact Bengali Glyph Mapping Table for Election Commission PDFs
# ==============================================================================
EC_2024_GLYPHS = {
    # Distinguish Uddin (উদ্দিন) vs Uddeen (উদ্দীন)
    '\u0117ীন': 'দ্দীন', 'ėীন': 'দ্দীন',
    '\u0117িন': 'দ্দিন', 'ėিন': 'দ্দিন',
    'উি\u0117ন': 'উদ্দিন', 'উিėন': 'উদ্দিন',
    'উ\u0117ীন': 'উদ্দীন', 'উėীন': 'উদ্দীন',
    'উ\u0117িন': 'উদ্দিন', 'উėিন': 'উদ্দিন',
    '\u0117': 'দ্দী', 'ė': 'দ্দী',
    
    # Nasals and Conjuncts
    '\u008c': 'ন্', 'Œ': 'ন্',        # Nasal conjunct marker: আঞ্জুয়ারা, মণ্ডল, আনন্দ
    '\u008e': 'ফ্ফ', 'Ž': 'গু',        # Ž (0x17d) is গু: বগুড়া
    '\u008f': 'শু',
    '\u0091': 'শ', '‘': 'শ',
    '\u0092': 'র্য', '’': 'র্য',
    '\u0093': 'র্ব', '“': 'র্ব',
    '\u0097': 'স্টার', '—': 'স্টার',
    '\u0098': 'হ', '˜': 'হ',
    '\u00cb': '্য', 'Ë': '্য',        # ক্যাঃ, ব্যবসা
    '\u00cd': 'ব', 'Í': 'ব',
    '\u00ce': 'র্', 'Î': 'র্',        # কর্পোরেশন, ওয়ার্ড
    '\u00cf': 'ে', 'Ï': 'ে',        # visual e-kar
    '\u00d0': 'সৈ', 'Ð': 'সৈ',        # সৈকত, সৈয়দ
    '\u00d1': 'ব্বা', 'Ñ': 'ব্বা',
    '\u00d4': 'ক্স', 'Ô': 'ক্স',        # বক্স (e.g. মিরবক্স)
    '\u00d7': 'ক্ত', '×': 'ক্ত',        # আক্তার, রক্ত
    '\u00da': 'ক্ষ্মী', 'Ú': 'ক্ষ্মী',   # লক্ষ্মী
    '\u00e0': 'গ্ধা', 'à': 'গ্ধা',
    '\u00e5': 'গ্র', 'å': 'গ্র',        # গ্রাম, কুড়িগ্রাম
    '\u00ea': 'ঙ্গ', 'ê': 'ঙ্গ',        # ডাংগী, সঙ্গী
    '\u00ee': 'চ্চু', 'î': 'চ্চু',
    '\u00f4': 'র্ব',
    '\u00f5': 'জ্জ', 'õ': 'জ্জ',        # শফিকুজ্জামান, আক্তারুজ্জামান, সাজ্জাদ
    '\u00f9': 'ত্র', 'Ù': 'ত্র',
    '\u00fa': 'জ্ব', 'ú': 'জ্ব',
    '\u00fb': 'ঞ্চল', 'û': 'ঞ্চল',      # অঞ্চল
    '\u00fd': 'ঞ্জ', 'ý': 'ঞ্জ',
    '\u0103': 'ড্রা', 'ă': 'ড্রা',
    '\u0110': 'ওশ', 'Đ': 'ওশ',
    '\u0113': 'ত্ত', 'ē': 'ত্ত',
    '\u0114': 'ত্র', 'Ĕ': 'ত্র',
    '\u0119': 'দ্রি', 'ę': 'দ্রি',
    '\u0122': 'ন্ত', 'Ģ': 'ন্ত',        # চূড়ান্ত
    '\u0124': 'ন্দ', 'Ĥ': 'ন্দ',
    '\u0125': 'ন্ম', 'ĥ': 'ন্ম',        # জন্ম
    '\u0127': 'ন্দ্র', 'ħ': 'ন্দ্র',
    '\u0128': 'ন্না', 'Ĩ': 'ন্না',
    '\u0129': 'ন্স', 'ĩ': 'ন্স',
    '\u012f': 'ন্য', 'į': 'ন্য',        # জন্য
    '\u0130': 'ন্দা', 'İ': 'ন্দা',
    '\u0131': 'প্লি', 'ı': 'প্লি',
    '\u0133': 'ঞ্জা', 'ĳ': 'ঞ্জা',
    '\u0134': 'প্র', 'Ĵ': 'প্র',        # প্রামানিক, প্রকাশ
    '\u013a': 'ব্দ', 'ĺ': 'ব্দ',        # আব্দুল
    '\u013c': 'ব্বা', 'ļ': 'ব্বা',
    '\u013d': 'ব্রা', 'Ľ': 'ব্রা',
    '\u0142': 'ম্পা', 'ł': 'ম্পা',
    '\u0144': 'ম্ব', 'ń': 'ম্ব',        # নম্বর
    '\u0146': 'ম্রা', 'ņ': 'ম্রা',
    '\u0147': 'ম্ম', 'Ň': 'ম্ম',        # মোহাম্মদ
    '\u014c': 'ল্লা', 'Ō': 'ল্লা',
    '\u0150': 'ল্প', 'Ő': 'ল্প',
    '\u0154': 'শ্চ', 'Ŕ': 'শ্চ',        # পশ্চিম
    '\u0158': 'শ্র', 'Ř': 'শ্র',        # শ্রী, শ্রীনগর
    '\u0159': 'শ্যা', 'ř': 'শ্যা',
    '\u015e': 'স্ট', 'Ş': 'স্ট',        # পোস্টকোড, মাস্টার
    '\u0161': 'ষ্প', 'š': 'ষ্প',
    '\u0162': 'স্ট্রেশ', 'Ţ': 'স্ট্রেশ',
    '\u0166': 'স্ক', 'Ŧ': 'স্ক',
    '\u0168': 'স্টা', 'Ũ': 'স্টা',
    '\u0169': 'স্তা', 'ũ': 'স্তা',
    '\u016b': 'স্না', 'ū': 'স্না',
    '\u016e': 'তু', 'Ů': 'তু',
    '\u016f': 'স্মৃ', 'ů': 'স্মৃ',
    '\u0170': 'স্রা', 'Ű': 'স্রা',
    '\u0171': 'স্ত্রী', 'ű': 'স্ত্রী',
    '\u017d': 'গু',                     # বগুড়া
    '\u017e': 'সেম', 'ž': 'সেম',
    '\u017f': 'নু', 'ſ': 'নু',          # বানু (0x17f = নু)
    '\u0180': 'সু', 'ƀ': 'সু',
    '\u0181': 'রু', 'Ɓ': 'রু',        # আক্তারুজ্জামান, আমরুল, পুরুষ
    '\u0182': 'রূপভা', 'Ƃ': 'রূপভা',
    '\u0183': 'দু', 'ƃ': 'দু',        # দুলাল
    '\u0184': 'শুকি', 'Ƅ': 'শুকি',
    '\u0185': 'হৃ', 'ƅ': 'হৃ',
    '\u0186': 'হু', 'Ɔ': 'হু',        # হুমায়ুন
    '\u018f': 'ঁদ', 'Ə': 'ঁদ',
    '\u01a3': 'কু', 'ƣ': 'কু',        # শফিকুজ্জামান, চাকুরী, কুড়িগ্রাম
    '\u025cc': '', '◌': '',
}

KAUNIA_2018_CORRECTIONS = {
    'োভাটার': 'ভোটার',
    'োমাঃ': 'মোঃ',
    'োমাছাঃ': 'মোছাঃ',
    'োমাহাম্মদ': 'মোহাম্মদ',
    'োমাহামদ': 'মোহাম্মদ',
    'োবগম': 'বেগম',
    'োপশা': 'পেশা',
    'িঠকানা': 'ঠিকানা',
    'িপতা': 'পিতা',
    'িহকানা': 'ঠিকানা',
    'সামী': 'স্বামী',
    'স্বাামী': 'স্বামী',
    'তুামী': 'স্বামী',
    'জন তারিখ': 'জন্ম তারিখ',
    'জন তািরখ': 'জন্ম তারিখ',
    'বযবসা': 'ব্যবসা',
    'শিমক': 'শ্রমিক',
    'শ্রীমিক': 'শ্রমিক',
    'ছাত/ছাতী': 'ছাত্র/ছাত্রী',
    
    # Place names
    'ঠাকরদাস': 'ঠাকুরদাস',
    'কাউিনয়া': 'কাউনিয়া',
    'নািজরদাহ': 'নাজিরদাহ',
    'হারাগাছ': 'হারাগাছ',
    
    # 2018 Names Normalization
    'আিমনর': 'আমিনুর',
    'আরিজনা': 'আরজিনা',
    'আবুল লিতফ': 'আব্দুল লতিফ',
    'আবুল': 'আব্দুল',
    'লিতফ': 'লতিফ',
    'আিজজার': 'আজিজার',
    'োদেলায়ার োহােসন': 'দেলোয়ার হোসেন',
    'দেলায়ার': 'দেলোয়ার',
    'োহােসন': 'হোসেন',
    'জেয়ন উিদন': 'জয়েন উদ্দীন',
    'জেয়ন': 'জয়েন',
    'উিদন': 'উদ্দীন',
    'উদি্দীন': 'উদ্দীন',
    'োজেলনা': 'জোলেখা',
    'জিসম উিদন': 'জসিম উদ্দীন',
    'জিসম': 'জসিম',
    'রিফকল': 'রফিকুল',
    'রিফকুল': 'রফিকুল',
    'োসতারা': 'সেতারা',
    'মোজাহেদল': 'মোজাহেদুল',
    'মোজাহদেুল': 'মোজাহেদুল',
    'নরল হক': 'নুরুল হক',
    'নরল': 'নুরুল',
    'নূরল': 'নূরুল',
    'মসিলম': 'মোসলেম',
    'বযাপারী': 'ব্যাপারী',
    'মসেলম': 'মসলেম',
    'মেঘন': 'মেঘেন',
    'হামিরন': 'হামিরন',
    'কিহনর': 'কহিনুর',
    'কদুছ': 'কুদ্দুছ',
    'ফেয়জ': 'ফয়েজ',
    'কলুপজন': 'কুলুপজন',
    'সাকয়াত': 'সাখায়াত',
    'সায়াত': 'সাখায়াত',
    'মোরশেদল': 'মোরশেদুল',
    'কালিমুদি্দীন': 'কালিমুদ্দীন',
    'কালিমুদিন': 'কালিমুদ্দীন',
    'মনতাজল': 'মনতাজুল',
    'ছমির উিদন': 'ছমির উদ্দীন',
    'আসরাফল': 'আশরাফুল',
    'আশরাফল': 'আশরাফুল',
    'নজরল': 'নজরুল',
    'রাশেদল': 'রাশেদুল',
    'মায়াদল': 'মায়াদুল',
    'আমজাদল': 'আমজাদুল',
    'আনোয়ারল': 'আনোয়ারুল',
    'রবিউল': 'রবিউল',
    'শহিদুল': 'শহিদুল',
    'রশিদুল': 'রশিদুল',
    'আমিরল': 'আমিরুল',
    'সফিকুল': 'শফিকুল',
    'ছফিকুল': 'শফিকুল',
    'মজিদল': 'মজিদুল',
    'আজিজল': 'আজিজুল',
    'জাহিদল': 'জাহিদুল',
    'মুকবল': 'মকবুল',
    'তহিদুল': 'তৌহিদুল',
    'আসাদল': 'আসাদুল',
    'এনামুল': 'এনামুল',
    'খাইরল': 'খায়রুল',
    'ছায়েদল': 'সায়েদুল',
    'সায়েদল': 'সায়েদুল',
    'জয়নাল': 'জয়নাল',
    'আব্দল': 'আব্দুল',
    'কদ্দুস': 'কুদ্দুস',
    'মছলম': 'মোসলেম',
    'মোসলেম': 'মোসলেম',
    'আক্তারল': 'আক্তারুল',
    'হায়দর': 'হায়দার',
    'মোকাদ্দেস': 'মোকাদ্দেস',
    'জাহাঙ্গীর': 'জাহাঙ্গীর',
    'শাহিনুর': 'শাহিনুর',
    'হারুন': 'হারুন',
    'এমদাদল': 'এমদাদুল',
    'এমদাদুল': 'এমদাদুল',
    'ছিদ্দিক': 'ছিদ্দিক',
    'সিদ্দিক': 'সিদ্দিক',
    'ফজলার': 'ফজলুর',
    'আলমগীর': 'আলমগীর',
    'ছমির': 'ছমির',
    'আনিছুর': 'আনিসুর',
    'আনিসুর': 'আনিসুর',
    'হাবিবুর': 'হাবিবুর',
    'লতিফুর': 'লতিফুর',
    'মোজাম্মেল': 'মোজাম্মেল',
    'মোজামেল': 'মোজাম্মেল',
    'শামসুল': 'শামসুল',
    'সামসুল': 'শামসুল',
    'মহসীন': 'মহসিন',
    'জাহেদুল': 'জাহেদুল',
    'বাবেল': 'বাবুল',
    'মকবুল': 'মকবুল',
    'ছলেমান': 'সোলেমান',
    'সুলেমান': 'সোলেমান',
}

COMMON_WORD_FIXES = {
    'বাশ্ব': 'বানু',
    'রহিমদ্দিীন': 'রহিমদ্দিন',
    'রহিমদ্দিনি': 'রহিমদ্দিন',
    'সেিলনা': 'সেলিনা',
    'আকলী': 'আলী',
    'শান্তনা': 'সান্ত্বনা',
    'পিশ্চম': 'পশ্চিম',
    'মাস্টাার': 'মাস্টার',
    'চাখুরী': 'চাকুরী',
    'শিফকুজ্জামান': 'শফিকুজ্জামান',
    'শিফখুজ্জামান': 'শফিকুজ্জামান',
    'আক্তাড়ুজ্জামান': 'আক্তারুজ্জামান',
    'খুড়িåাম': 'কুড়িগ্রাম',
    'ডাêী': 'ডাংগী',
    'শ্রীীনগর': 'শ্রীনগর',
    'পূবর্': 'পূর্ব',
    'উত্কর': 'উত্তর',
    'উত্র': 'উত্তর',
    'বািলয়া': 'বালিয়া',
    'ঝােলা': 'ঝালো',
    'রািজব': 'রাজীব',
    'মোাছাঃ': 'মোছাঃ',
    'মোাঃ': 'মোঃ',
}

EXCLUDE_TERMS = [
    "কর্তন", "কৰ্ত্তন", "কৰ্তন", "কতÎন", "কতইন", "করতন", "কাটা",
    "মাইগ্রেশন", "মাইগ্ৰেশন", "মাইগ্রেশান", "মাইগ্ৰেশান", "মাইেåট", "মাইগ্রেট",
    "স্থানান্তর", "স্থানান্তিৰত", "স্থানান্তরিত", "স্থান্তর",
    "সম্পূরক", "বাতিল", "KvZv", "gBRÖkb", "¯’vbvšÍi"
]

def normalize_card_text(text, is_2018=False):
    if not text:
        return ""

    if is_2018:
        for k, v in KAUNIA_2018_CORRECTIONS.items():
            text = text.replace(k, v)
    else:
        # Step 1: Replace EC 2024 Glyphs
        for glyph, rep in EC_2024_GLYPHS.items():
            text = text.replace(glyph, rep)
            
        # Step 2: Contextual Nasal Conjuncts
        text = re.sub(r'ন্([জঝচছ])', r'ঞ্\1', text)   # আঞ্জুয়ারা, সঞ্জয়
        text = re.sub(r'ন্([ডঢটঠ])', r'ণ্\1', text)   # মণ্ডল, ঘণ্টা

        # Step 3: Pure Bijoy Vowel Reordering
        text = re.sub(r'ি([\u0995-\u09B9\u09DC-\u09DF](?:্[\u0995-\u09B9\u09DC-\u09DF])*)', r'\1ি', text)
        text = re.sub(r'ে([\u0995-\u09B9\u09DC-\u09DF](?:্[\u0995-\u09B9\u09DC-\u09DF])*)া', r'\1ো', text)
        text = re.sub(r'ে([\u0995-\u09B9\u09DC-\u09DF](?:্[\u0995-\u09B9\u09DC-\u09DF])*)', r'\1ে', text)

    # Specific Uddin (উদ্দীন vs উদ্দিন) pattern normalization
    text = re.sub(r'উদ্দিীন|উদি্দীন|উদ্দীীন|উদ্দীিন', 'উদ্দীন', text)
    text = re.sub(r'উদ্দিনি|উদ্দনি', 'উদ্দিন', text)

    # Remove consecutive duplicate vowels
    text = re.sub(r'ে+', 'ে', text)
    text = re.sub(r'ি+', 'ি', text)
    text = re.sub(r'া+', 'া', text)
    text = re.sub(r'ু+', 'ু', text)
    text = re.sub(r'ূ+', 'ূ', text)
    text = re.sub(r'ী+', 'ী', text)

    for k, v in COMMON_WORD_FIXES.items():
        text = text.replace(k, v)

    return text

def parse_card_fields(raw_chunk, is_2018=False):
    text = normalize_card_text(raw_chunk, is_2018=is_2018)
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return None

    if any(term in text for term in EXCLUDE_TERMS):
        return None

    if not any(k in text for k in ['নাম:', 'ভোটার নং:', 'পিতা:', 'মাতা:', 'স্বামী:']):
        return None

    m_serial = re.match(r'^([০-৯\d]{3,4})\.\s*(.*)', lines[0])
    serial = m_serial.group(1).strip() if m_serial else ''
    first_line_rest = m_serial.group(2).strip() if m_serial else lines[0]

    name = re.sub(r'^নাম:\s*', '', first_line_rest).strip()

    voter_no = ''
    guardian_type = 'পিতা'
    guardian_name = ''
    mother_name = ''
    occupation = ''
    dob = ''
    address = ''

    for line in lines[1:]:
        if 'ভোটার নং:' in line:
            voter_no = line.split('ভোটার নং:')[1].strip()
        elif 'পিতা:' in line:
            guardian_type = 'পিতা'
            guardian_name = line.split('পিতা:')[1].strip()
        elif 'স্বামী:' in line:
            guardian_type = 'স্বামী'
            guardian_name = line.split('স্বামী:')[1].strip()
        elif 'মাতা:' in line:
            mother_name = line.split('মাতা:')[1].strip()
        elif 'পেশা:' in line or 'জন্ম তারিখ:' in line:
            if 'পেশা:' in line and 'জন্ম তারিখ:' in line:
                parts = line.split('জন্ম তারিখ:')
                occupation = parts[0].replace('পেশা:', '').replace(',', '').strip()
                dob = parts[1].strip()
            elif 'পেশা:' in line:
                occupation = line.split('পেশা:')[1].strip()
            elif 'জন্ম তারিখ:' in line:
                dob = line.split('জন্ম তারিখ:')[1].strip()
        elif 'ঠিকানা:' in line:
            address = line.split('ঠিকানা:')[1].strip()
        else:
            if address:
                address += ' ' + line.strip()
            elif not guardian_name and ('আলী' in line or 'খান' in line or 'শেখ' in line or 'সরকার' in line or 'রহমান' in line or 'হোসেন' in line or 'প্রামানিক' in line or 'মণ্ডল' in line or 'মন্ডল' in line):
                guardian_name = line.strip()

    dob = re.sub(r'[^\d/০-৯]', '', dob)

    return {
        'serial': serial,
        'name': name,
        'voter_no': voter_no,
        'guardian_type': guardian_type,
        'guardian_name': guardian_name,
        'mother_name': mother_name,
        'occupation': occupation,
        'dob': dob,
        'address': address
    }

def format_voter_card_text(record):
    lines = []
    serial_prefix = f"{record['serial']}. " if record.get('serial') else ""
    lines.append(f"{serial_prefix}নাম: {record['name']}")
    lines.append(f"ভোটার নং: {record['voter_no']}")
    lines.append(f"{record['guardian_type']}: {record['guardian_name']}")
    lines.append(f"মাতা: {record['mother_name']}")

    occ_dob = []
    if record['occupation']:
        occ_dob.append(f"পেশা: {record['occupation']}")
    if record['dob']:
        occ_dob.append(f"জন্ম তারিখ: {record['dob']}")
    if occ_dob:
        lines.append(", ".join(occ_dob))

    if record['address']:
        lines.append(f"ঠিকানা: {record['address']}")

    return "\n".join(lines)

def extract_area_metadata(first_page_text, filename=""):
    text = normalize_card_text(first_page_text, is_2018=('850698' in filename or '2018' in filename))
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    meta = {
        "thana": "",
        "ward_no": "",
        "voter_area": "",
        "voter_area_no": "",
        "gender": ""
    }

    code_match = re.search(r'\b\d{6}\b', filename) or re.search(r'\d{6}', filename)
    meta["code"] = code_match.group(0) if code_match else "000000"

    if 'female' in filename.lower():
        meta["gender"] = "female"
    elif 'male' in filename.lower():
        meta["gender"] = "male"

    for idx, line in enumerate(lines):
        if 'উপজেলা/থানা' in line or 'উপেজলা/থানা' in line:
            parts = re.split(r'উপজেলা/থানা|উপেজলা/থানা', line)
            if len(parts) > 1 and parts[1].replace(':', '').strip():
                tokens = parts[1].replace(':', '').strip().split()
                if tokens:
                    meta["thana"] = tokens[0]
            elif idx + 1 < len(lines):
                tokens = lines[idx + 1].replace(':', '').strip().split()
                if tokens:
                    meta["thana"] = tokens[0]

        if 'ইউনিয়ন পরিষদের' in line or 'ইউিনয়ন পিরষেদর' in line or 'পিরষেদর' in line or 'পিরষদের' in line:
            m = re.search(r'\)\s*([^\s]+)$', line)
            if m:
                meta["ward_no"] = m.group(1).strip()
            else:
                m_dig = re.search(r'(\d+|[০-৯]+)', line)
                if m_dig:
                    meta["ward_no"] = m_dig.group(1).strip()

        if 'ভোটার এলাকার নাম' in line or 'ভাটার এলাকার নাম' in line:
            parts = re.split(r'ভোটার এলাকার নাম|ভাটার এলাকার নাম', line)
            if len(parts) > 1:
                meta["voter_area"] = parts[1].replace(':', '').strip()
        elif ('ভোটার এলাকা' in line or 'ভাটার এলাকা' in line) and 'নম্বর' not in line and 'নমর' not in line:
            words = line.split()
            idx_total = -1
            for w_idx, w in enumerate(words):
                if w_idx >= 2 and (w.startswith('সব') or 'মোট' in w or 'মাট' in w or 'েমাট' in w):
                    idx_total = w_idx
                    break
            if idx_total != -1 and len(words) >= 3:
                raw_area = " ".join(words[2:idx_total])
            elif len(words) >= 3:
                raw_area = " ".join(words[2:])
            else:
                raw_area = line.replace('ভোটার এলাকা', '').replace('নাম :', '').strip()
            meta["voter_area"] = raw_area.replace('নাম :', '').replace('নাম:', '').strip()

        if 'ভোটার এলাকার নম্বর' in line or 'ভোটার এলাকার নমর' in line:
            m_no = re.search(r'(?:নম্বর|নমর)\s*[:\-]?\s*([০-৯\d]+)', line)
            if m_no:
                meta["voter_area_no"] = m_no.group(1).strip()
        elif 'ভোটার এলাকার' in line or 'ভাটার এলাকার' in line:
            m_no = re.search(r'(?:নম্বর|নমর)\s+([০-৯\d]+)', line)
            if m_no:
                meta["voter_area_no"] = m_no.group(1).strip()
            else:
                m_digs = re.findall(r'[০-৯\d]+', line)
                if m_digs:
                    meta["voter_area_no"] = m_digs[0]

        if 'মহিলা' in line or 'মিহলা' in line:
            meta["gender"] = "female"
        elif 'পুরুষ' in line or 'পুরষ' in line or 'পুড়ুষ' in line:
            meta["gender"] = "male"

    return meta

def extract_page_voters(page, is_2018=False):
    blocks = page.get_text('blocks')
    sorted_blocks = sorted(blocks, key=lambda x: (round(x[1] / 20) * 20, x[0]))
    voters = []

    for b in sorted_blocks:
        txt = b[4].strip()
        if not txt:
            continue
        if re.search(r'[০-৯\d]{3,4}\.\s*নাম:', txt) or ('নাম:' in txt and 'ভোটার নং:' in txt):
            card_splits = re.split(r'(?=(?:^|\n)\s*[০-৯\d]{3,4}\.\s*)', txt)
            for c in card_splits:
                if not c.strip():
                    continue
                rec = parse_card_fields(c, is_2018=is_2018)
                if rec and rec['name'] and rec['voter_no']:
                    voters.append(rec)
    return voters

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    default_pdf_dir = os.path.join(base_dir, "allpdf")
    default_out_dir = os.path.join(base_dir, "extracted_text_data")

    parser = argparse.ArgumentParser(description="Extract clean Bengali voter text from EC PDFs.")
    parser.add_argument("-i", "--input", default=default_pdf_dir, help="Input directory containing PDF files")
    parser.add_argument("-o", "--output", default=default_out_dir, help="Output directory for combined text files")
    parser.add_argument("-j", "--json", action="store_true", help="Output JSON progress events for Electron UI")
    args = parser.parse_args()

    input_dir = os.path.abspath(args.input)
    output_dir = os.path.abspath(args.output)
    is_json = args.json

    print(f"==========================================================")
    print(f" Election Commission Bengali Voter Text Extractor (v3.4)  ")
    print(f"==========================================================")
    print(f"Input Directory : {input_dir}")
    print(f"Output Directory: {output_dir}")

    if not os.path.exists(input_dir):
        print(f"Error: Input directory {input_dir} not found.")
        return

    pdf_files = [f for f in os.listdir(input_dir) if f.lower().endswith('.pdf')]
    if not pdf_files:
        print(f"Error: No PDF files found in {input_dir}.")
        return

    print(f"Found {len(pdf_files)} PDF files to process.\n")
    os.makedirs(output_dir, exist_ok=True)

    if is_json:
        print(json.dumps({"type": "init", "total": len(pdf_files)}), flush=True)

    all_voters_master_list = []
    generated_files = []

    for pdf_idx, pdf_file in enumerate(pdf_files, 1):
        pdf_path = os.path.join(input_dir, pdf_file)
        print(f"[{pdf_idx}/{len(pdf_files)}] Processing: {pdf_file}", flush=True)

        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            if total_pages == 0:
                print(f"  -> Empty PDF. Skipping.", flush=True)
                continue

            is_2018 = ('850698' in pdf_file or '2018' in doc[0].get_text('text'))

            # Extract Metadata
            area_meta = extract_area_metadata(doc[0].get_text('text'), pdf_file)
            code = area_meta.get("code", "000000")
            gender = area_meta.get("gender", "voter")
            
            # File name format: <code_gender.txt>
            out_filename = f"{code}_{gender}.txt"
            combined_txt_path = os.path.join(output_dir, out_filename)

            # Process Cards starting from Page 3 (or Page 1 if <= 2 pages)
            start_page_idx = 2 if total_pages >= 3 else 0
            file_voters = []

            for page_idx in range(start_page_idx, total_pages):
                page = doc[page_idx]
                page_voters = extract_page_voters(page, is_2018=is_2018)
                for voter in page_voters:
                    voter['pdf_file'] = pdf_file
                    voter['page_no'] = page_idx + 1
                    voter['thana'] = area_meta['thana']
                    voter['ward_no'] = area_meta['ward_no']
                    voter['voter_area'] = area_meta['voter_area']
                    voter['voter_area_no'] = area_meta['voter_area_no']
                    voter['gender'] = area_meta['gender']

                    file_voters.append(voter)
                    all_voters_master_list.append(voter)

            doc.close()

            # Save the combined .txt file named as <code_gender.txt>
            with open(combined_txt_path, 'w', encoding='utf-8') as f_out:
                for idx, voter in enumerate(file_voters):
                    f_out.write(format_voter_card_text(voter))
                    if idx < len(file_voters) - 1:
                        f_out.write("\n\n")

            generated_files.append((out_filename, len(file_voters)))
            print(f"  -> Generated: {out_filename} ({len(file_voters)} voters)", flush=True)

            if is_json:
                print(json.dumps({
                    "type": "progress",
                    "current": pdf_idx,
                    "total": len(pdf_files),
                    "file": pdf_file,
                    "count": len(file_voters),
                    "percent": round((pdf_idx / len(pdf_files)) * 100),
                    "output_file": out_filename
                }), flush=True)

        except Exception as e:
            print(f"  -> Error reading {pdf_file}: {str(e)}", flush=True)

    # Master CSV
    csv_out_path = os.path.join(output_dir, "all_extracted_voters.csv")
    csv_fieldnames = [
        'serial', 'name', 'voter_no', 'guardian_type', 'guardian_name',
        'mother_name', 'occupation', 'dob', 'address',
        'voter_area', 'ward_no', 'thana', 'gender', 'pdf_file', 'page_no'
    ]
    with open(csv_out_path, 'w', encoding='utf-8-sig', newline='') as f_csv:
        writer = csv.DictWriter(f_csv, fieldnames=csv_fieldnames)
        writer.writeheader()
        for v in all_voters_master_list:
            writer.writerow({k: v.get(k, '') for k in csv_fieldnames})

    if is_json:
        print(json.dumps({
            "type": "complete",
            "total_voters": len(all_voters_master_list),
            "files": generated_files,
            "csv": csv_out_path
        }), flush=True)

    print(f"\n==========================================================", flush=True)
    print(f"  Extraction Completed Successfully!                       ", flush=True)
    print(f"==========================================================", flush=True)
    for fname, count in generated_files:
        print(f"  📄 {fname:<25} -> {count:>4} voters", flush=True)
    print(f"----------------------------------------------------------", flush=True)
    print(f"  Total Voters Extracted  : {len(all_voters_master_list)}", flush=True)
    print(f"  Master Excel CSV        : {csv_out_path}", flush=True)
    print(f"==========================================================", flush=True)

if __name__ == '__main__':
    main()
