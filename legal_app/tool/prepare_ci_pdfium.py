"""Provision pdfrx 1.3.5's original PDFium release for reproducible Android CI.

The plugin's unchecked public GitHub download returned an unusable archive.
Use the official asset API and publisher SHA-256s, without replacing PDFium.
Only CI's pub-cache CMake download line is changed; library/ABI code is intact.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen

ASSETS = {
    'x86': (258151971, '330995565b210345e2a1417c8249137f2836b6458bfe17473e8f5f905adf5df7'),
    'arm': (258151976, '67d783faea256ea6c3bc7f8eedeafe4218d9cebe597fb6d75b42c6ed271e5554'),
    'arm64': (258151975, '09efe62016209f6456c201591e14dcdf6c222b41b3d157f5f41df2ee4ce40b1b'),
    'x64': (258151974, 'd16754427c72a056c7431ca707abf6ff07ff4625168e11d9220deb77ee3ce88e'),
}
DOWNLOAD = 'file(DOWNLOAD https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_RELEASE}/${PDFIUM_ARCHIVE_NAME}.tgz ${PDFIUM_RELEASE_DIR}/${PDFIUM_ARCHIVE_NAME}.tgz)'
COPY = 'file(COPY "$ENV{UMBRELLA_PDFIUM_ARCHIVES}/${PDFIUM_ARCHIVE_NAME}.tgz" DESTINATION ${PDFIUM_RELEASE_DIR})'


def prepare(package_config: Path, destination: Path) -> None:
    config = json.loads(package_config.read_text())
    package = next(p for p in config['packages'] if p['name'] == 'pdfrx')
    root = Path(unquote(urlparse(urljoin(package_config.resolve().as_uri(), package['rootUri'])).path))
    cmake = root / 'android' / 'CMakeLists.txt'
    source = cmake.read_text()
    if 'version: 1.3.5' not in (root / 'pubspec.yaml').read_text():
        raise ValueError('Review PDFium pins before upgrading pdfrx')
    supported = (source.count(DOWNLOAD) == 1 and COPY not in source) or (source.count(COPY) == 1 and DOWNLOAD not in source)
    if 'set(PDFIUM_RELEASE chromium%2F7202)' not in source or not supported:
        raise ValueError('Unexpected pdfrx build script; refusing to patch')
    destination.mkdir(parents=True, exist_ok=True)
    for arch, (asset_id, checksum) in ASSETS.items():
        archive = destination / f'pdfium-android-{arch}.tgz'
        for attempt in range(3):
            try:
                request = Request(
                    f'https://api.github.com/repos/bblanchon/pdfium-binaries/releases/assets/{asset_id}',
                    headers={'Accept': 'application/octet-stream', 'User-Agent': 'Umbrella-release-CI'},
                )
                with urlopen(request, timeout=120) as response, archive.open('wb') as target:
                    while chunk := response.read(1024 * 1024):
                        target.write(chunk)
                if hashlib.sha256(archive.read_bytes()).hexdigest() != checksum:
                    raise ValueError(f'PDFium checksum mismatch: {arch}')
                print(f'Verified publisher checksum: pdfium-android-{arch}.tgz')
                break
            except Exception:
                archive.unlink(missing_ok=True)
                if attempt == 2:
                    raise
                time.sleep(3)
    cmake.write_text(source.replace(DOWNLOAD, COPY))
    if os.environ.get('GITHUB_ENV'):
        with open(os.environ['GITHUB_ENV'], 'a') as env:
            env.write(f'UMBRELLA_PDFIUM_ARCHIVES={destination.resolve()}\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--package-config', type=Path, default=Path('.dart_tool/package_config.json'))
    parser.add_argument('--destination', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.package_config, args.destination)
