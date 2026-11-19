import os
import sys
import json
import time
import base64
import shutil
import tempfile
import subprocess
import zipfile
from io import BytesIO
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

# Add parent and local directories to path
SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SERVICE_DIR)
sys.path.insert(0, SERVICE_DIR)
sys.path.insert(0, ROOT_DIR)

app = Flask(__name__)
# Enable CORS for all origins (Firebase Hosting, localhost, Render)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

SCRIPT_PATH = os.path.join(SERVICE_DIR, "pdf_slice.py")
if not os.path.exists(SCRIPT_PATH):
    SCRIPT_PATH = os.path.join(ROOT_DIR, "votcenter", "pdf_slice.py")


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "voterslip-cloud-slicer",
        "status": "running",
        "engine": "Python PyMuPDF + OpenCV",
        "timestamp": int(time.time())
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "time": time.time(),
        "python": sys.version
    })


@app.route("/api/check-backend-slicer", methods=["GET", "OPTIONS"])
def check_backend_slicer():
    return jsonify({
        "available": True,
        "service": "voterslip-cloud-python",
        "engine": "PyMuPDF + OpenCV (Render Cloud Microservice)",
        "script": os.path.basename(SCRIPT_PATH)
    })


@app.route("/api/run-slicer-backend", methods=["POST", "OPTIONS"])
def run_slicer_backend():
    if request.method == "OPTIONS":
        return Response("", status=204)

    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}

    lines = int(data.get("lines", 2))
    hide_borders = bool(data.get("hideBorders", True))
    preview_only = bool(data.get("previewOnly", False))
    pad_top = int(data.get("padTop", 0))
    pad_bottom = int(data.get("padBottom", 0))
    pad_left = int(data.get("padLeft", 0))
    pad_right = int(data.get("padRight", 0))
    shave_top = data.get("shaveTop")
    shave_left = data.get("shaveLeft")
    resolution_scale = float(data.get("resolutionScale", 2.0))
    uploaded_pdfs = data.get("uploadedPdfs", [])

    temp_in = tempfile.mkdtemp(prefix="voterslip_in_")
    temp_out = tempfile.mkdtemp(prefix="voterslip_out_")

    def cleanup():
        try:
            shutil.rmtree(temp_in, ignore_errors=True)
            shutil.rmtree(temp_out, ignore_errors=True)
        except Exception:
            pass

    # Save uploaded PDFs to temp_in
    if isinstance(uploaded_pdfs, list) and len(uploaded_pdfs) > 0:
        for item in uploaded_pdfs:
            fname = item.get("name", f"voter_{int(time.time())}.pdf")
            b64_str = item.get("base64", "")
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            try:
                raw_bytes = base64.b64decode(b64_str)
                with open(os.path.join(temp_in, fname), "wb") as f:
                    f.write(raw_bytes)
            except Exception as e:
                print(f"Error decoding PDF {fname}:", e)
    else:
        # Check if local inputDir specified
        input_dir = data.get("inputDir", "")
        if input_dir and os.path.exists(input_dir):
            if os.path.isdir(input_dir):
                for f in os.listdir(input_dir):
                    if f.lower().endswith(".pdf"):
                        shutil.copy2(os.path.join(input_dir, f), os.path.join(temp_in, f))
            elif os.path.isfile(input_dir) and input_dir.lower().endswith(".pdf"):
                shutil.copy2(input_dir, os.path.join(temp_in, os.path.basename(input_dir)))

    pdf_count = len([f for f in os.listdir(temp_in) if f.lower().endswith(".pdf")])
    if pdf_count == 0:
        cleanup()
        return jsonify({"status": "error", "message": "কোনো পিডিএফ ফাইল পাওয়া যায়নি"}), 400

    py_args = [
        sys.executable,
        SCRIPT_PATH,
        "-i", temp_in,
        "-o", temp_out,
        "--lines", str(lines),
        "-j"
    ]
    if hide_borders:
        py_args.append("-b")
    if preview_only:
        py_args.append("--preview-only")
    if pad_top:
        py_args.extend(["--pad-top", str(pad_top)])
    if pad_bottom:
        py_args.extend(["--pad-bottom", str(pad_bottom)])
    if pad_left:
        py_args.extend(["--pad-left", str(pad_left)])
    if pad_right:
        py_args.extend(["--pad-right", str(pad_right)])
    if shave_top is not None:
        py_args.extend(["--shave-top", str(shave_top)])
    if shave_left is not None:
        py_args.extend(["--shave-left", str(shave_left)])
    if resolution_scale:
        py_args.extend(["--resolution-scale", str(resolution_scale)])

    def generate():
        try:
            proc = subprocess.Popen(
                py_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                encoding="utf-8",
                errors="replace"
            )

            for line in proc.stdout:
                line_str = line.strip()
                if line_str:
                    yield line_str + "\n"

            proc.wait()

            # If not preview only, pack sliced cards into a zip and yield as zip_ready
            if not preview_only:
                zip_buffer = BytesIO()
                total_cards = 0
                with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                    for root, _, files in os.walk(temp_out):
                        for f in files:
                            if f.lower().endswith((".jpg", ".jpeg", ".png")):
                                full_p = os.path.join(root, f)
                                rel_p = os.path.relpath(full_p, temp_out)
                                zf.write(full_p, arcname=rel_p)
                                total_cards += 1

                if total_cards > 0:
                    zip_buffer.seek(0)
                    zip_b64 = "data:application/zip;base64," + base64.b64encode(zip_buffer.getvalue()).decode("ascii")
                    yield json.dumps({
                        "status": "zip_ready",
                        "total_cards": total_cards,
                        "zip_data_url": zip_b64
                    }) + "\n"

            yield json.dumps({
                "status": "exit",
                "code": proc.returncode,
                "outputDir": temp_out
            }) + "\n"

        except Exception as ex:
            yield json.dumps({"status": "error", "message": str(ex)}) + "\n"
        finally:
            cleanup()

    return Response(
        stream_with_context(generate()),
        mimetype="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Voter Slip Python Cloud Slicer Microservice on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)

