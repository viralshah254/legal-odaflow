import 'dart:io';
import 'dart:typed_data';

/// Writes 16-bit PCM chunks into a WAV file (16 kHz mono by default).
class PcmWavWriter {
  PcmWavWriter._(this._file, this.sampleRate, this.numChannels);

  final RandomAccessFile _file;
  final int sampleRate;
  final int numChannels;
  int _dataBytes = 0;

  static Future<PcmWavWriter> create(
    String path, {
    int sampleRate = 16000,
    int numChannels = 1,
  }) async {
    final file = await File(path).open(mode: FileMode.write);
    await file.writeFrom(Uint8List(44));
    return PcmWavWriter._(file, sampleRate, numChannels);
  }

  /// Opens an existing WAV file and appends more PCM (for resume after app restart).
  static Future<PcmWavWriter> openForAppend(
    String path, {
    int sampleRate = 16000,
    int numChannels = 1,
  }) async {
    final file = await File(path).open(mode: FileMode.append);
    await file.setPosition(0);
    final header = await file.read(44);
    if (header.length < 44) {
      await file.close();
      throw StateError('Invalid WAV file');
    }
    final existingDataBytes =
        ByteData.sublistView(Uint8List.fromList(header)).getUint32(40, Endian.little);
    await file.setPosition(44 + existingDataBytes);
    return PcmWavWriter._(file, sampleRate, numChannels)
      .._dataBytes = existingDataBytes;
  }

  Future<void> writePcm(Uint8List pcm) async {
    if (pcm.isEmpty) return;
    await _file.writeFrom(pcm);
    _dataBytes += pcm.length;
  }

  Future<void> finalize() async {
    final header = _buildHeader(_dataBytes);
    await _file.setPosition(0);
    await _file.writeFrom(header);
    await _file.close();
  }

  Uint8List _buildHeader(int dataSize) {
    const bitsPerSample = 16;
    final byteRate = sampleRate * numChannels * bitsPerSample ~/ 8;
    final blockAlign = numChannels * bitsPerSample ~/ 8;
    final chunkSize = 36 + dataSize;

    final header = ByteData(44);
    header.setUint8(0, 0x52); // R
    header.setUint8(1, 0x49); // I
    header.setUint8(2, 0x46); // F
    header.setUint8(3, 0x46); // F
    header.setUint32(4, chunkSize, Endian.little);
    header.setUint8(8, 0x57); // W
    header.setUint8(9, 0x41); // A
    header.setUint8(10, 0x56); // V
    header.setUint8(11, 0x45); // E
    header.setUint8(12, 0x66); // f
    header.setUint8(13, 0x6d); // m
    header.setUint8(14, 0x74); // t
    header.setUint8(15, 0x20); // ' '
    header.setUint32(16, 16, Endian.little);
    header.setUint16(20, 1, Endian.little);
    header.setUint16(22, numChannels, Endian.little);
    header.setUint32(24, sampleRate, Endian.little);
    header.setUint32(28, byteRate, Endian.little);
    header.setUint16(32, blockAlign, Endian.little);
    header.setUint16(34, bitsPerSample, Endian.little);
    header.setUint8(36, 0x64); // d
    header.setUint8(37, 0x61); // a
    header.setUint8(38, 0x74); // t
    header.setUint8(39, 0x61); // a
    header.setUint32(40, dataSize, Endian.little);
    return header.buffer.asUint8List();
  }
}
