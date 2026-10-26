"""Export a reviewed fee-development working snapshot without Git mutation or local credentials."""
import argparse
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {'.md', '.json', '.mjs', '.js', '.css', '.html', '.svg', '.png', '.ico', '.sql', '.txt', '.http', '.py', '.woff2'}
EXCLUDE_DIRS = {'node_modules', '.local', '.git', 'before', '__pycache__', 'history'}

def selected_files():
    selected = set()
    for folder in ['services/routefit', 'contracts', 'brand/logo', 'PRD']:
        for path in (ROOT / folder).rglob('*'):
            relative = path.relative_to(ROOT)
            if any(part in EXCLUDE_DIRS for part in relative.parts):
                continue
            if path.name.startswith('.env') and path.name != '.env.example':
                continue
            if path.is_file() and (path.suffix in ALLOWED or path.name in {'.env.example', '.nvmrc'}):
                selected.add(path)
    for path in (ROOT / 'prototype').iterdir():
        if path.is_file() and path.suffix in ALLOWED and not path.name.startswith('.env'):
            selected.add(path)
    selected.update(ROOT / name for name in ['README.md', 'brand/SLOGAN.md', '.gitignore', 'scripts/export-fee-baseline.py', 'scripts/render-api-reference.py', 'scripts/validate-api-contract.py', 'scripts/check-pricing-examples.py'])
    for path in sorted(selected):
        if path.resolve() != path.absolute() or path.is_symlink():
            raise ValueError('Linked files are not allowed in the snapshot: ' + str(path))
        yield path.relative_to(ROOT).as_posix(), path.read_bytes()

def verify(archive):
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        assert len(names) == len(set(names)), 'Duplicate archive entry'
        manifest = json.loads(bundle.read('HANDOFF-MANIFEST.json'))
        expected = {item['path'] for item in manifest['files']}
        assert set(names) == expected | {'HANDOFF-MANIFEST.json'}, 'Manifest/archive entries differ'
        for item in manifest['files']:
            name = item['path']
            assert not name.startswith(('/', '\\')) and '\\' not in name and ':' not in name
            assert all(part not in {'.', '..', '.local', 'node_modules', '.git'} for part in name.split('/'))
            assert not Path(name).name.startswith('.env') or Path(name).name == '.env.example'
            body = bundle.read(name)
            assert len(body) == item['bytes'] and hashlib.sha256(body).hexdigest() == item['sha256'], name
        return {'snapshotId': manifest['snapshotId'], 'filesVerified': len(expected), 'archiveSha256': hashlib.sha256(Path(archive).read_bytes()).hexdigest()}

def export(output):
    content = dict(selected_files())
    manifest = {'format': 1, 'repository': 'leishen8806/dr-routefit',
                'baseHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'scope': 'Current prototype runtime and tests, pricing and order-draft backend, contracts, brand and product documents; working-tree snapshot, not a Git commit.',
                'excluded': ['.git', 'node_modules', '.local', 'real .env files', 'prototype/records historical screenshots', 'before backups', 'history documents'],
                'files': [{'path': name, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()} for name, body in sorted(content.items())]}
    manifest['snapshotId'] = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()[:16]
    content['HANDOFF-MANIFEST.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    output.mkdir(parents=True, exist_ok=True)
    archive = output / ('routefit-fee-baseline-' + manifest['snapshotId'] + '.zip')
    if not archive.exists():
        with archive.open('xb') as stream, zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
            for name, body in sorted(content.items()):
                entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.external_attr = 0o100644 << 16
                bundle.writestr(entry, body)
    result = verify(archive)
    manifest_file = archive.with_suffix('.manifest.json')
    if not manifest_file.exists():
        manifest_file.write_bytes(content['HANDOFF-MANIFEST.json'])
    print(json.dumps({'archive': str(archive), 'manifest': str(manifest_file), **result}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'handoff')
    parser.add_argument('--verify', type=Path)
    args = parser.parse_args()
    if args.verify:
        print(json.dumps(verify(args.verify), indent=2))
    else:
        export(args.output.resolve())
