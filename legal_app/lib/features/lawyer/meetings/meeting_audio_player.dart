import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

class MeetingAudioPlayer extends StatefulWidget {
  const MeetingAudioPlayer({
    super.key,
    required this.url,
  });

  final String url;

  @override
  State<MeetingAudioPlayer> createState() => _MeetingAudioPlayerState();
}

class _MeetingAudioPlayerState extends State<MeetingAudioPlayer> {
  final _player = AudioPlayer();
  var _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      await _player.setUrl(
        widget.url,
        headers: const {'Accept': 'audio/*,*/*'},
      );
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Unable to load recording';
        });
      }
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  String _format(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const LinearProgressIndicator(minHeight: 2);
    }
    if (_error != null) {
      return Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error));
    }

    return StreamBuilder<Duration>(
      stream: _player.positionStream,
      builder: (context, positionSnap) {
        final position = positionSnap.data ?? Duration.zero;
        final duration = _player.duration ?? Duration.zero;
        final maxMs = duration.inMilliseconds > 0 ? duration.inMilliseconds : 1;
        final value = position.inMilliseconds / maxMs;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Slider(
              value: value.clamp(0.0, 1.0),
              onChanged: duration == Duration.zero
                  ? null
                  : (v) {
                      _player.seek(
                        Duration(milliseconds: (v * maxMs).round()),
                      );
                    },
            ),
            Row(
              children: [
                StreamBuilder<PlayerState>(
                  stream: _player.playerStateStream,
                  builder: (context, snap) {
                    final playing = snap.data?.playing ?? false;
                    return IconButton(
                      icon: Icon(playing ? Icons.pause_circle : Icons.play_circle),
                      iconSize: 40,
                      onPressed: () {
                        if (playing) {
                          _player.pause();
                        } else {
                          _player.play();
                        }
                      },
                    );
                  },
                ),
                Text('${_format(position)} / ${_format(duration)}'),
              ],
            ),
          ],
        );
      },
    );
  }
}
