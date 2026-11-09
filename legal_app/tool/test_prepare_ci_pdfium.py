import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import prepare_ci_pdfium as ci


class PdfiumProvisioningTest(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(ci.os.environ, {'GITHUB_ENV': ''})
        environment.start()
        self.addCleanup(environment.stop)
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.package = self.root / 'pdfrx'
        (self.package / 'android').mkdir(parents=True)
        (self.package / 'pubspec.yaml').write_text('version: 1.3.5\n')
        self.cmake = self.package / 'android/CMakeLists.txt'
        self.original = 'set(PDFIUM_RELEASE chromium%2F7202)\n' + ci.DOWNLOAD + '\n'
        self.cmake.write_text(self.original)
        self.config = self.root / 'package_config.json'
        self.config.write_text(json.dumps({'packages': [{'name': 'pdfrx', 'rootUri': self.package.as_uri() + '/'}]}))

    def test_rejects_upgraded_plugin_before_network_or_patch(self):
        (self.package / 'pubspec.yaml').write_text('version: 9.0.0\n')
        with patch.object(ci, 'urlopen') as network:
            with self.assertRaisesRegex(ValueError, 'Review PDFium pins'):
                ci.prepare(self.config, self.root / 'archives')
        network.assert_not_called()
        self.assertEqual(self.cmake.read_text(), self.original)

    def test_corrupt_archive_never_patches_build_or_leaves_payload(self):
        with patch.object(ci, 'ASSETS', {'arm': (1, '0' * 64)}), patch.object(ci, 'urlopen', side_effect=lambda *a, **k: io.BytesIO(b'corrupt')), patch.object(ci.time, 'sleep'):
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                ci.prepare(self.config, self.root / 'archives')
        self.assertEqual(self.cmake.read_text(), self.original)
        self.assertFalse((self.root / 'archives/pdfium-android-arm.tgz').exists())

    def test_verified_archive_replaces_only_download_and_is_idempotent(self):
        data = b'fixture archive'
        with patch.object(ci, 'ASSETS', {'arm': (1, hashlib.sha256(data).hexdigest())}), patch.object(ci, 'urlopen', side_effect=lambda *a, **k: io.BytesIO(data)):
            ci.prepare(self.config, self.root / 'archives')
            once = self.cmake.read_text()
            ci.prepare(self.config, self.root / 'archives')
        self.assertEqual(once, self.original.replace(ci.DOWNLOAD, ci.COPY))
        self.assertEqual(self.cmake.read_text(), once)


if __name__ == '__main__':
    unittest.main()
