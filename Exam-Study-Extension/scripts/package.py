"""Create a portable source ZIP without browser data or development dependencies."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parents[1]
destination = root.parent / "Exam-Study-Library-Edge-Chrome.zip"
allowed = {".js", ".cjs", ".html", ".css", ".json", ".md", ".py", ".webp", ".png", ".jpg", ".svg"}

with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob("*")):
        if file.is_file() and file.suffix.lower() in allowed and not any(
            part in {"node_modules", ".git", "__pycache__"} for part in file.relative_to(root).parts
        ):
            archive.write(file, Path(root.name) / file.relative_to(root))

digest = hashlib.sha256(destination.read_bytes()).hexdigest()
destination.with_suffix(".sha256").write_text(f"{digest}  {destination.name}\n", encoding="utf-8")
print(f"Created {destination.name} ({destination.stat().st_size:,} bytes)")
