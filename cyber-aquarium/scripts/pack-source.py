"""Package a portable source tree, without hosting identity or installed dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
output=root/'public/downloads/cyber-aquarium-source.zip'
output.parent.mkdir(parents=True,exist_ok=True)
inputs=['index.html','package.json','package-lock.json','vite.config.js','README.md','ARCHITECTURE.md','.gitignore','src','scripts','public/assets','public/favicon.svg']
with ZipFile(output,'w',ZIP_DEFLATED,compresslevel=9) as archive:
    for name in inputs:
        path=root/name
        files=sorted(p for p in path.rglob('*') if p.is_file()) if path.is_dir() else [path]
        for file in files:
            if '__pycache__' in file.parts:continue
            archive.write(file,Path('cyber-aquarium')/file.relative_to(root))
print(f'Packaged {output.name}: {output.stat().st_size:,} bytes')
