import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../l10n/app_localizations.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  static const _phraseCount = 4;

  // --- Logo entrance ---
  late final AnimationController _logoController;
  late final Animation<double> _logoFade;
  late final Animation<double> _logoScale;
  late final Animation<double> _logoSlide;

  // --- Continuous logo float bob ---
  late final AnimationController _floatController;
  late final Animation<double> _floatY;

  // --- Glow pulse behind logo ---
  late final AnimationController _glowController;
  late final Animation<double> _glowPulse;

  // --- Primary shimmer ring (CW) ---
  late final AnimationController _ringController;
  late final Animation<double> _ringRotation;
  late final Animation<double> _ringFade;

  // --- Secondary ring (CCW, slower) ---
  late final AnimationController _ring2Controller;
  late final Animation<double> _ring2Rotation;

  // --- Expanding ripple pulses ---
  late final AnimationController _rippleController;
  late final Animation<double> _rippleScale;
  late final Animation<double> _rippleOpacity;

  // --- Tagline phrase cycling ---
  late final List<AnimationController> _phraseControllers;
  late final List<Animation<double>> _phraseFades;
  late final List<Animation<Offset>> _phraseSlides;

  // --- Bottom accent line ---
  late final AnimationController _lineController;
  late final Animation<double> _lineWidth;
  late final Animation<double> _lineFade;

  bool _disposed = false;

  @override
  void initState() {
    super.initState();

    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _logoFade = CurvedAnimation(parent: _logoController, curve: Curves.easeOut);
    _logoScale = Tween<double>(begin: 0.65, end: 1.0).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeOutBack),
    );
    _logoSlide = Tween<double>(begin: 30.0, end: 0.0).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeOutCubic),
    );

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3200),
    );
    _floatY = Tween<double>(begin: -7.0, end: 7.0).animate(
      CurvedAnimation(parent: _floatController, curve: Curves.easeInOut),
    );

    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );
    _glowPulse = Tween<double>(begin: 0.55, end: 1.0).animate(
      CurvedAnimation(parent: _glowController, curve: Curves.easeInOut),
    );

    _ringController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 5500),
    );
    _ringRotation = Tween<double>(begin: 0.0, end: 2 * math.pi).animate(
      CurvedAnimation(parent: _ringController, curve: Curves.linear),
    );
    _ringFade = CurvedAnimation(
      parent: _logoController,
      curve: const Interval(0.4, 1.0, curve: Curves.easeIn),
    );

    _ring2Controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 9000),
    );
    _ring2Rotation = Tween<double>(begin: 0.0, end: -2 * math.pi).animate(
      CurvedAnimation(parent: _ring2Controller, curve: Curves.linear),
    );

    _rippleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _rippleScale = Tween<double>(begin: 0.85, end: 1.55).animate(
      CurvedAnimation(parent: _rippleController, curve: Curves.easeOut),
    );
    _rippleOpacity = Tween<double>(begin: 0.35, end: 0.0).animate(
      CurvedAnimation(parent: _rippleController, curve: Curves.easeOut),
    );

    _phraseControllers = List.generate(
      _phraseCount,
      (_) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 380),
      ),
    );
    _phraseFades = _phraseControllers
        .map((c) => CurvedAnimation(parent: c, curve: Curves.easeInOut))
        .toList();
    _phraseSlides = _phraseControllers.map((c) {
      return Tween<Offset>(
        begin: const Offset(0, 0.6),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: c, curve: Curves.easeOutCubic));
    }).toList();

    _lineController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _lineWidth = CurvedAnimation(
      parent: _lineController,
      curve: Curves.easeOutCubic,
    );
    _lineFade = CurvedAnimation(parent: _lineController, curve: Curves.easeIn);

    _runSequence();
    _navigateWhenReady();
    // Warm location cache in background during splash animation.
    ref.read(detectedLocationProvider.future).ignore();
  }

  bool get _canAnimate => mounted && !_disposed;

  Future<void> _runSequence() async {
    if (!_canAnimate) return;

    await _logoController.forward();
    if (!_canAnimate) return;

    // Glow + rings + float all start together after logo enters
    _glowController.repeat(reverse: true);
    _ringController.repeat();
    _ring2Controller.repeat();
    _floatController.repeat(reverse: true);
    _rippleController.repeat();

    await Future<void>.delayed(const Duration(milliseconds: 200));
    if (!_canAnimate) return;

    await _lineController.forward();
    if (!_canAnimate) return;

    await Future<void>.delayed(const Duration(milliseconds: 150));

    for (int i = 0; i < _phraseCount; i++) {
      if (!_canAnimate) return;
      await _phraseControllers[i].forward();
      if (!_canAnimate) return;
      await Future<void>.delayed(const Duration(milliseconds: 620));
      if (!_canAnimate) return;
      await _phraseControllers[i].reverse();
      if (!_canAnimate) return;
      if (i < _phraseCount - 1) {
        await Future<void>.delayed(const Duration(milliseconds: 80));
      }
    }
  }

  Future<void> _navigateWhenReady() async {
    await Future<void>.delayed(const Duration(seconds: 8));
    if (!mounted) return;

    final authState = ref.read(authControllerProvider);

    if (authState.session != null) {
      final user = authState.session!.user;
      context.go(user.isLawyer ? '/lawyer' : '/consumer');
      return;
    }

    context.go('/welcome');
  }

  List<String> _phrases(AppLocalizations l10n) => [
    l10n.marketingSplashForIndividuals,
    l10n.marketingSplashForLawyers,
    l10n.marketingSplashForLawFirms,
    l10n.marketingSplashForEveryone,
  ];

  @override
  void dispose() {
    _disposed = true;
    _logoController.dispose();
    _floatController.dispose();
    _glowController.dispose();
    _ringController.dispose();
    _ring2Controller.dispose();
    _rippleController.dispose();
    for (final c in _phraseControllers) {
      c.dispose();
    }
    _lineController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final phrases = _phrases(l10n);
    final size = MediaQuery.sizeOf(context);

    return Scaffold(
      backgroundColor: AppColors.logoBlue,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Background: deep radial glow ───────────────────────────────────
          _BackgroundGradient(pulseAnim: _glowPulse),

          // ── Decorative floating orbs ────────────────────────────────────────
          _FloatingOrbs(fadeAnim: _logoFade, size: size),

          // ── Main content ───────────────────────────────────────────────────
          SafeArea(
            child: Column(
              children: [
                const Spacer(flex: 5),

                // Logo + rings + ripple
                AnimatedBuilder(
                  animation: Listenable.merge([
                    _logoController,
                    _floatController,
                    _ringController,
                    _ring2Controller,
                    _rippleController,
                  ]),
                  builder: (context, _) {
                    final containerSize = size.width * 0.72;
                    return Transform.translate(
                      offset: Offset(
                        0,
                        _logoSlide.value + _floatY.value,
                      ),
                      child: Opacity(
                        opacity: _logoFade.value.clamp(0.0, 1.0),
                        child: SizedBox(
                          width: containerSize,
                          height: containerSize,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // Expanding ripple pulse
                              Opacity(
                                opacity: (_ringFade.value *
                                        _rippleOpacity.value)
                                    .clamp(0.0, 1.0),
                                child: Transform.scale(
                                  scale: _rippleScale.value,
                                  child: Container(
                                    width: containerSize,
                                    height: containerSize,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: AppColors.logoAccent
                                            .withValues(alpha: 0.5),
                                        width: 1.5,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              // Outer secondary ring (CCW)
                              Opacity(
                                opacity: _ringFade.value.clamp(0.0, 1.0),
                                child: Transform.rotate(
                                  angle: _ring2Rotation.value,
                                  child: CustomPaint(
                                    size: Size.square(containerSize),
                                    painter: _ShimmerRingPainter(
                                      progress: _ring2Controller.value,
                                      arcCount: 2,
                                      ringAlpha: 0.07,
                                      arcAlpha: 0.45,
                                      strokeWidth: 1.4,
                                    ),
                                  ),
                                ),
                              ),
                              // Inner primary ring (CW)
                              Opacity(
                                opacity: _ringFade.value.clamp(0.0, 1.0),
                                child: Transform.rotate(
                                  angle: _ringRotation.value,
                                  child: CustomPaint(
                                    size: Size.square(containerSize * 0.80),
                                    painter: _ShimmerRingPainter(
                                      progress: _ringController.value,
                                    ),
                                  ),
                                ),
                              ),
                              // Logo image
                              Transform.scale(
                                scale: _logoScale.value,
                                child: SizedBox(
                                  width: size.width * 0.58,
                                  child: Image.asset(
                                    'assets/images/umbrella_logo_source.png',
                                    fit: BoxFit.contain,
                                    semanticLabel: l10n.commonAppName,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),

                const SizedBox(height: 28),

                // ── Accent line ──────────────────────────────────────────────
                AnimatedBuilder(
                  animation: _lineController,
                  builder: (context, _) => Opacity(
                    opacity: _lineFade.value.clamp(0.0, 1.0),
                    child: FractionallySizedBox(
                      widthFactor: _lineWidth.value * 0.28,
                      child: Container(
                        height: 1.5,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(2),
                          gradient: const LinearGradient(
                            colors: [
                              Colors.transparent,
                              AppColors.logoAccent,
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 22),

                // ── Cycling taglines ─────────────────────────────────────────
                SizedBox(
                  height: 32,
                  child: ClipRect(
                    child: Stack(
                      alignment: Alignment.center,
                      children: List.generate(phrases.length, (i) {
                        return AnimatedBuilder(
                          animation: _phraseControllers[i],
                          builder: (context, _) => FadeTransition(
                            opacity: _phraseFades[i],
                            child: SlideTransition(
                              position: _phraseSlides[i],
                              child: Text(
                                phrases[i].toUpperCase(),
                                style: GoogleFonts.inter(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w500,
                                  color: const Color(0xFF6B8FC4),
                                  letterSpacing: 3.2,
                                  height: 1.2,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                ),

                const Spacer(flex: 6),

                // ── Version hint ─────────────────────────────────────────────
                AnimatedBuilder(
                  animation: _lineController,
                  builder: (context, _) => Opacity(
                    opacity: (_lineFade.value * 0.45).clamp(0.0, 1.0),
                    child: const Padding(
                      padding: EdgeInsets.only(bottom: 32),
                      child: Text(
                        'UMBRELLA LEGAL',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF3D5A8A),
                          letterSpacing: 3.5,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Background gradient with animated deep-blue radial glow ─────────────────

class _BackgroundGradient extends StatelessWidget {
  const _BackgroundGradient({required this.pulseAnim});

  final Animation<double> pulseAnim;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulseAnim,
      builder: (context, _) {
        final pulse = pulseAnim.value;
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0.0, -0.15),
              radius: 1.1 + pulse * 0.12,
              colors: [
                Color.lerp(
                  const Color(0xFF0D1F45),
                  const Color(0xFF122860),
                  pulse,
                )!,
                AppColors.logoBlue,
                const Color(0xFF010810),
              ],
              stops: const [0.0, 0.55, 1.0],
            ),
          ),
        );
      },
    );
  }
}

// ─── Floating ambient orbs ────────────────────────────────────────────────────

class _FloatingOrbs extends StatelessWidget {
  const _FloatingOrbs({required this.fadeAnim, required this.size});

  final Animation<double> fadeAnim;
  final Size size;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: fadeAnim,
      builder: (context, _) => Opacity(
        opacity: (fadeAnim.value * 0.6).clamp(0.0, 1.0),
        child: Stack(
          children: [
            // Top-right orb
            Positioned(
              right: -size.width * 0.22,
              top: size.height * 0.05,
              child: Container(
                width: size.width * 0.58,
                height: size.width * 0.58,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.logoAccent.withValues(alpha: 0.12),
                      AppColors.logoAccent.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            // Bottom-left orb
            Positioned(
              left: -size.width * 0.18,
              bottom: size.height * 0.08,
              child: Container(
                width: size.width * 0.50,
                height: size.width * 0.50,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF1A3A6E).withValues(alpha: 0.35),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Shimmer ring painter ─────────────────────────────────────────────────────

class _ShimmerRingPainter extends CustomPainter {
  const _ShimmerRingPainter({
    required this.progress,
    this.arcCount = 3,
    this.ringAlpha = 0.10,
    this.arcAlpha = 0.65,
    this.strokeWidth = 2.2,
  });

  final double progress;
  final int arcCount;
  final double ringAlpha;
  final double arcAlpha;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 3;

    // Faint base ring
    final basePaint = Paint()
      ..color = AppColors.logoAccent.withValues(alpha: ringAlpha)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    canvas.drawCircle(center, radius, basePaint);

    // Travelling arc highlights evenly spaced
    for (int i = 0; i < arcCount; i++) {
      final offset = (i / arcCount) * 2 * math.pi;
      final startAngle = -math.pi / 2 + offset + progress * 2 * math.pi;

      final arcRect = Rect.fromCircle(center: center, radius: radius);
      final arcPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..shader = SweepGradient(
          startAngle: startAngle,
          endAngle: startAngle + math.pi / 2.8,
          colors: [
            Colors.transparent,
            AppColors.logoAccent.withValues(alpha: arcAlpha),
            AppColors.logoAccent.withValues(alpha: arcAlpha * 0.23),
            Colors.transparent,
          ],
          stops: const [0.0, 0.4, 0.75, 1.0],
        ).createShader(arcRect);

      canvas.drawArc(
        arcRect,
        startAngle,
        math.pi / 2.8,
        false,
        arcPaint,
      );
    }
  }

  @override
  bool shouldRepaint(_ShimmerRingPainter old) =>
      old.progress != progress ||
      old.arcCount != arcCount ||
      old.arcAlpha != arcAlpha;
}
