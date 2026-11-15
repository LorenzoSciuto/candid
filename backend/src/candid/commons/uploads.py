from fastapi import HTTPException, UploadFile

MB = 1024 * 1024
MAX_CV_BYTES = 10 * MB
MAX_AUDIO_BYTES = 200 * MB
MAX_VIDEO_CHUNK_BYTES = 20 * MB


def read_limited(file: UploadFile, max_bytes: int) -> bytes:
    """Read an upload fully, rejecting it with 413 once it exceeds max_bytes."""
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"File too large (max {max_bytes // MB} MB)")
    return data
