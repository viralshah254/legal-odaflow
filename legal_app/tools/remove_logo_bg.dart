import 'dart:io';

import 'package:image/image.dart' as img;

void main(List<String> args) {
  final sourcePath = args.isNotEmpty
      ? args[0]
      : 'assets/images/umbrella_logo_source.png';
  final outputPath = args.length > 1
      ? args[1]
      : 'assets/images/umbrella_logo.png';

  final source = File(sourcePath);
  if (!source.existsSync()) {
    stderr.writeln('Logo source not found: $sourcePath');
    exitCode = 1;
    return;
  }

  final image = img.decodeImage(source.readAsBytesSync());
  if (image == null) {
    stderr.writeln('Unable to decode image: $sourcePath');
    exitCode = 1;
    return;
  }

  for (final pixel in image) {
    final isNearWhite = pixel.r > 240 && pixel.g > 240 && pixel.b > 240;
    if (isNearWhite) {
      pixel
        ..r = 255
        ..g = 255
        ..b = 255
        ..a = 0;
    }
  }

  File(outputPath)
    ..createSync(recursive: true)
    ..writeAsBytesSync(img.encodePng(image));
}
