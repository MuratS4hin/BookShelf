import os
import requests
import re
import sys
import io
import time
from pathlib import Path
from pypdf import PdfReader
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from starlette.responses import FileResponse, JSONResponse

# --- External Library Check ---
# NOTE: pydub requires the external program FFmpeg to be installed on your system.
try:
    from pydub import AudioSegment
except ImportError:
    print("Error: pydub library not found. Please run 'pip install pydub'")
    AudioSegment = None

# --- Configuration for the TTS Server and Processing ---
# NOTE: In a production environment, this should be configurable
TTS_SERVER_URL = os.getenv("TTS_SERVER_URL", "http://localhost:5001")
CHUNK_SIZE_LIMIT = 800  # Max characters per chunk for API call
DEFAULT_SPEED = 0.8     # Default speaker speed
TEMP_DIR = Path("temp_processing") # Directory for file uploads and audio chunks

# ----------------------------------------------------------------------
# Core Functions (from original script)
# ----------------------------------------------------------------------

def cleanup_files(file_paths, output_file_path=None):
    """
    Deletes all temporary audio chunk files and the final output file (if it exists).
    """
    print(f"\n--- Starting Temporary File Cleanup ---")
    deleted_count = 0
    
    # Delete temporary chunks
    for path in file_paths:
        try:
            path.unlink()
            deleted_count += 1
        except FileNotFoundError:
            continue
        except Exception as e:
            print(f"Warning: Could not delete temporary file {path.name}: {e}")
            
    # Attempt to delete final output file
    if output_file_path and Path(output_file_path).is_file():
        try:
            Path(output_file_path).unlink()
            print(f"Deleted final output file: {output_file_path}")
        except Exception as e:
            print(f"Warning: Could not delete final output file {output_file_path}: {e}")
            
    print(f"Cleaned up {deleted_count} temporary audio chunks.")
    
    # Attempt to remove the processing directory if it's empty.
    try:
        TEMP_DIR.rmdir()
        print(f"Removed empty directory: {TEMP_DIR}")
    except OSError:
        pass


def process_text_in_chunks(full_text, base_output_name, server_url=TTS_SERVER_URL, speed=DEFAULT_SPEED):
    # ... (Keep the content of your original process_text_in_chunks function here) ...
    # IMPORTANT: Update AUDIO_DIR to TEMP_DIR in this function!
    if AudioSegment is None:
        print("\nCannot process audio chunks: pydub is required.")
        return []
            
    TEMP_DIR.mkdir(exist_ok=True)
            
    # 1. Segmentation logic (unchanged)
    paragraphs = re.split(r'(\n\n+|\r\n\r\n+)', full_text)
    final_chunks = []
    for p in paragraphs:
        if len(p.strip()) > CHUNK_SIZE_LIMIT:
            sub_chunks = [p[i:i + CHUNK_SIZE_LIMIT] for i in range(0, len(p), CHUNK_SIZE_LIMIT)]
            final_chunks.extend(sub_chunks)
        elif p.strip():
            final_chunks.append(p.strip())

    output_files = []
            
    print(f"\n--- TTS Synthesis Started ---")
    print(f"Total text length: {len(full_text)} chars.")
    print(f"Processing {len(final_chunks)} audio chunks...")

    for i, chunk in enumerate(final_chunks):
        if not chunk.strip():
            continue

        payload = {"text": chunk, "speaker_speed": speed}
        # Chunks are saved as WAV, but with reduced sample rate for size
        output_filename = TEMP_DIR / f"{base_output_name}_chunk_{i:04d}.wav"

        print(f"  -> Processing chunk {i+1}/{len(final_chunks)} (Chars: {len(chunk)})...")

        try:
            response = requests.post(
                server_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=120
            )
            
            if response.status_code == 200:
                try:
                    # Load the raw audio content (assuming it's standard WAV)
                    raw_audio_io = io.BytesIO(response.content)
                    temp_segment = AudioSegment.from_file(raw_audio_io, format="wav")
                    
                    # --- COMPRESSION STEP 1: Shrink temporary WAV file by reducing sample rate (e.g., to 22.05kHz) ---
                    compressed_segment = temp_segment.set_frame_rate(22050)
                    
                    # Save the compressed WAV chunk
                    compressed_segment.export(output_filename, format="wav")
                    output_files.append(output_filename)

                except Exception as audio_err:
                    print(f"Warning: pydub failed to process/compress audio data for chunk {i}: {audio_err}. Skipping chunk file.")

            else:
                print(f"ERROR: Failed to process chunk {i}. Status: {response.status_code}.")
                
        except requests.exceptions.RequestException as e:
            print(f"NETWORK ERROR: Failed to reach TTS server for chunk {i}: {e}")
            
    print(f"--- TTS Synthesis Finished ---")
    return output_files

def merge_audio_files(chunk_file_paths, output_filename_base):
    # ... (Keep the content of your original merge_audio_files function here) ...
    if AudioSegment is None:
        print("\nSkipping merge: 'pydub' is not imported or FFmpeg is missing.")
        return None
            
    print(f"\n--- Merging {len(chunk_file_paths)} Chunks ---")
            
    # --- COMPRESSION STEP 2: Final output is MP3 ---
    final_output_path = TEMP_DIR / f"{output_filename_base}_FULL_BOOK.mp3"
            
    if not chunk_file_paths:
        print("No audio files were generated to merge.")
        return None

    try:
        combined_audio = AudioSegment.empty()

        for path in chunk_file_paths:
            print(f"  -> Appending {path.name}...")
            # Load the pre-compressed WAV chunk
            segment = AudioSegment.from_wav(path)
            combined_audio += segment

        # Export the combined audio file as MP3 with a high-quality, compressed bitrate
        print(f"  -> Exporting final merged file to: {final_output_path} (MP3, 192kbps)")
        combined_audio.export(final_output_path, format="mp3", bitrate="192k")
            
        print(f"✅ FINAL MERGE COMPLETE: {final_output_path}")
        return str(final_output_path)

    except Exception as e:
        print(f"!!! CRITICAL MERGE ERROR !!!")
        print(f"Failed to merge audio files. Error: {e}")
        print("Ensure FFmpeg is correctly installed and accessible on your system.")
        return None


def extract_text_from_file(file_path):
    # ... (Keep the content of your original extract_text_from_file function here) ...
    # This function is fine as-is, just ensure the helper functions below are also included.
    file = Path(file_path)
    if not file.is_file():
        return f"Error: File not found at {file_path}"
            
    if file.suffix.lower() == '.pdf':
        print(f"Detected PDF file: {file.name}")
        return extract_text_from_pdf(file_path)
            
    elif file.suffix.lower() == '.epub':
        print(f"Detected EPUB file: {file.name}")
        return extract_text_from_epub(file_path)
            
    else:
        return f"Error: Unsupported file type: {file.suffix}"

# (Keep extract_text_from_pdf and extract_text_from_epub functions here)
def extract_text_from_pdf(pdf_path):
    text = []
    try:
        reader = PdfReader(pdf_path)
        for page in reader.pages:
            text.append(page.extract_text())
            
        full_text = "\n\n".join(t.strip() for t in text if t)
        return re.sub(r' +', ' ', full_text).replace(" \n", " ").replace("\n\n\n", "\n\n")
            
    except Exception as e:
        return f"Error extracting PDF text: {e}"

def extract_text_from_epub(epub_path):
    text_content = []
    try:
        book = epub.read_epub(epub_path)
            
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                text = soup.get_text()
                cleaned_text = " ".join(text.split())
                if cleaned_text:
                    text_content.append(cleaned_text)
                            
        return "\n\n".join(text_content)
            
    except Exception as e:
        return f"Error extracting EPUB text: {e}"


# ----------------------------------------------------------------------
# FastAPI Logic
# ----------------------------------------------------------------------

app = FastAPI(title="TTS Audiobook Generator", description="Converts PDF/EPUB files to MP3 using Piper TTS.")

# This is the heavy-lifting function that runs in the background.
def generate_audiobook_task(temp_filepath, base_output_name, speed, background_tasks):
    """Core process that runs as a background task."""
    print(f"Starting background task for: {temp_filepath}")
    
    # 1. Extract Text
    text_content = extract_text_from_file(temp_filepath)
    if text_content.startswith("Error"):
        print(f"Extraction Error: {text_content}")
        # We can't return an HTTP error from a background task, so we just log and clean up
        Path(temp_filepath).unlink(missing_ok=True)
        return
        
    # 2. Process & Merge
    audio_chunks = process_text_in_chunks(text_content, base_output_name, speed=speed)
    final_mp3_path = merge_audio_files(audio_chunks, base_output_name)

    # 3. Add Cleanup to run *after* the file is served/downloaded
    # We must delete both the temporary uploaded file and all chunks/final MP3
    
    # Add cleanup to the background_tasks queue. The cleanup will run AFTER
    # the server is done sending the file response.
    cleanup_list = audio_chunks
    cleanup_list.append(Path(temp_filepath)) # Also clean up the uploaded file
    
    background_tasks.add_task(cleanup_files, cleanup_list, final_mp3_path)
    
    return final_mp3_path


@app.post("/generate-audiobook/")
async def generate_audiobook(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    speed: float = DEFAULT_SPEED
):
    """
    Uploads a PDF or EPUB file and starts a background task to convert it to an MP3 audiobook.
    """
    if AudioSegment is None:
        raise HTTPException(
            status_code=503,
            detail="Server Misconfigured: pydub is not installed or FFmpeg is missing."
        )

    # Check file type
    allowed_types = [".pdf", ".epub"]
    file_suffix = Path(file.filename).suffix.lower()
    if file_suffix not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Please upload a PDF or EPUB file. Received: {file_suffix}"
        )
    
    # 1. Save the uploaded file temporarily
    TEMP_DIR.mkdir(exist_ok=True)
    unique_id = int(time.time() * 1000) # Use timestamp for unique temporary name
    temp_filepath = TEMP_DIR / f"{unique_id}_{file.filename}"

    try:
        # Read the file content and write it to a temporary location
        content = await file.read()
        with open(temp_filepath, "wb") as f:
            f.write(content)
            
        base_output_name = Path(file.filename).stem

        # 2. Run the heavy processing in a background thread
        # NOTE: This is NOT a fire-and-forget task. It blocks the worker until done.
        # For true async/non-blocking, you'd use a task queue like Celery.
        # But for a single-request, file-processing app, this is a common, simple pattern.
        
        final_mp3_path = generate_audiobook_task(str(temp_filepath), base_output_name, speed, background_tasks)
        
        if final_mp3_path:
            # 3. Return the final file using FileResponse.
            # The cleanup task is automatically run AFTER this response is sent.
            return FileResponse(
                final_mp3_path,
                media_type="audio/mpeg",
                filename=Path(final_mp3_path).name
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Audiobook generation failed. Check server logs for details."
            )
            
    except Exception as e:
        # If an error happens before cleanup is scheduled, ensure the temp upload is deleted
        Path(temp_filepath).unlink(missing_ok=True)
        print(f"Critical API Error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {e}")


@app.get("/")
def read_root():
    return JSONResponse(content={"message": "TTS Audiobook Generator API. Use /generate-audiobook to upload and process a file."})
