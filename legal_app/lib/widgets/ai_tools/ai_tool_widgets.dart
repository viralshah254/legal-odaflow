// Shared widgets used by all three India AI tool screens (Section Finder,
// FIR Analysis, India Drafting) and the lawyer dashboard India tile section.
//
// Design goals:
//   - Consistent visual language matching _HeroActionCard / _CompactActionTile
//   - Built-in Flutter animation only (no extra packages)
//   - Respects MediaQuery.disableAnimations for accessibility
//   - 200–350 ms easeOutCubic enters, easeInCubic exits

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';

// ─── AiToolFeatureHeader ───────────────────────────────────────────────────────

/// Gradient hero strip shown at the top of each AI tool screen.
/// Mirrors the web `dashboard-ai-search` card header design.
class AiToolFeatureHeader extends StatelessWidget {
  const AiToolFeatureHeader({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accentColor,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDark ? AppColors.logoBlueSurface : Colors.white;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accentColor.withValues(alpha: isDark ? 0.18 : 0.10),
            baseColor,
          ],
        ),
        border: Border(
          bottom: BorderSide(
            color: accentColor.withValues(alpha: 0.20),
          ),
        ),
      ),
      child: Stack(
        children: [
          // Decorative glow orb
          Positioned(
            right: -16,
            top: -16,
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accentColor.withValues(alpha: 0.10),
              ),
            ),
          ),
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: isDark ? 0.22 : 0.14),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: accentColor.withValues(alpha: 0.30),
                  ),
                ),
                child: Icon(icon, color: accentColor, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            height: 1.2,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withValues(alpha: 0.55),
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── AiToolPremiumTile ─────────────────────────────────────────────────────────

/// Dashboard tile for India AI tools. Supports press-scale animation, gradient
/// accent border, and optional 🇮🇳 badge.
class AiToolPremiumTile extends StatefulWidget {
  const AiToolPremiumTile({
    super.key,
    required this.icon,
    required this.label,
    required this.accentColor,
    required this.onTap,
    this.showIndiaBadge = false,
  });

  final IconData icon;
  final String label;
  final Color accentColor;
  final VoidCallback onTap;
  final bool showIndiaBadge;

  @override
  State<AiToolPremiumTile> createState() => _AiToolPremiumTileState();
}

class _AiToolPremiumTileState extends State<AiToolPremiumTile>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scale = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleTap() async {
    if (!MediaQuery.disableAnimationsOf(context)) {
      await _controller.forward();
      await _controller.reverse();
    }
    HapticFeedback.lightImpact();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorScheme = Theme.of(context).colorScheme;

    return AnimatedBuilder(
      animation: _scale,
      builder: (context, child) => Transform.scale(
        scale: _scale.value,
        child: child,
      ),
      child: GestureDetector(
        onTap: _handleTap,
        onTapDown: (_) {
          if (!MediaQuery.disableAnimationsOf(context)) {
            _controller.forward();
          }
        },
        onTapCancel: () => _controller.reverse(),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.logoBlueSurface : Colors.white,
            borderRadius: BorderRadius.circular(AppColors.radius),
            border: Border.all(
              color: widget.accentColor.withValues(alpha: 0.30),
            ),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                widget.accentColor.withValues(alpha: isDark ? 0.12 : 0.06),
                Colors.transparent,
              ],
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: widget.accentColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(widget.icon, color: widget.accentColor, size: 16),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  widget.label,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: colorScheme.onSurface,
                      ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (widget.showIndiaBadge) ...[
                const SizedBox(width: 4),
                Text(
                  '🇮🇳',
                  style: const TextStyle(fontSize: 12),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ─── StaggeredFadeSlide ────────────────────────────────────────────────────────

/// Wraps a child with a staggered fade + slide-up entrance animation.
/// Index controls the delay (50 ms × index, capped at 8 items = 400 ms max).
/// Instantly shows content when disableAnimations is set.
class StaggeredFadeSlide extends StatefulWidget {
  const StaggeredFadeSlide({
    super.key,
    required this.child,
    required this.index,
    this.slideDistance = 20.0,
  });

  final Widget child;
  final int index;
  final double slideDistance;

  @override
  State<StaggeredFadeSlide> createState() => _StaggeredFadeSlideState();
}

class _StaggeredFadeSlideState extends State<StaggeredFadeSlide>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slide = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.value = 1.0;
    } else {
      final delayMs = math.min(widget.index, 8) * 50;
      Future<void>.delayed(Duration(milliseconds: delayMs), () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) => Opacity(
        opacity: _fade.value,
        child: Transform.translate(
          offset: Offset(0, _slide.value * widget.slideDistance),
          child: child,
        ),
      ),
      child: widget.child,
    );
  }
}

// ─── AnimatedStateSwitcher ─────────────────────────────────────────────────────

/// Thin wrapper around AnimatedSwitcher tuned for input ↔ loading ↔ result
/// transitions. 300 ms easeOutCubic cross-fade with slight slide-up.
class AnimatedStateSwitcher extends StatelessWidget {
  const AnimatedStateSwitcher({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      return child;
    }
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, animation) {
        final slide = Tween<Offset>(
          begin: const Offset(0, 0.04),
          end: Offset.zero,
        ).animate(animation);
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(position: slide, child: child),
        );
      },
      child: child,
    );
  }
}

// ─── ExpandableLegalCard ───────────────────────────────────────────────────────

/// Card with an animated expand/collapse for Section Finder entries and
/// FIR fact groups. Chevron rotates 180° on expand.
class ExpandableLegalCard extends StatefulWidget {
  const ExpandableLegalCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.accentColor,
    required this.collapsedContent,
    required this.expandedContent,
    this.initiallyExpanded = false,
  });

  final String title;
  final String subtitle;
  final Color accentColor;
  final Widget collapsedContent;
  final Widget expandedContent;
  final bool initiallyExpanded;

  @override
  State<ExpandableLegalCard> createState() => _ExpandableLegalCardState();
}

class _ExpandableLegalCardState extends State<ExpandableLegalCard>
    with SingleTickerProviderStateMixin {
  late bool _expanded;
  late final AnimationController _chevronController;
  late final Animation<double> _chevronRotation;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
    _chevronController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
      value: _expanded ? 1.0 : 0.0,
    );
    _chevronRotation = Tween<double>(begin: 0.0, end: 0.5).animate(
      CurvedAnimation(parent: _chevronController, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _chevronController.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _expanded = !_expanded);
    if (MediaQuery.disableAnimationsOf(context)) {
      _chevronController.value = _expanded ? 1.0 : 0.0;
    } else if (_expanded) {
      _chevronController.forward();
    } else {
      _chevronController.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.logoBlueSurface : Colors.white,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(
          color: _expanded
              ? widget.accentColor.withValues(alpha: 0.35)
              : (isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.vertical(
              top: const Radius.circular(12),
              bottom: _expanded ? Radius.zero : const Radius.circular(12),
            ),
            onTap: _toggle,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.title,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        if (widget.subtitle.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            widget.subtitle,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: colorScheme.onSurface
                                          .withValues(alpha: 0.55),
                                    ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  RotationTransition(
                    turns: _chevronRotation,
                    child: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),
          ),
          widget.collapsedContent,
          AnimatedSize(
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : const Duration(milliseconds: 250),
            curve: Curves.easeOutCubic,
            child: _expanded
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                    child: widget.expandedContent,
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

// ─── PriorityChip ──────────────────────────────────────────────────────────────

/// Colour-coded chip for FIR next-step priorities.
class PriorityChip extends StatelessWidget {
  const PriorityChip({super.key, required this.priority});

  final String priority; // urgent | high | medium | low

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (priority.toLowerCase()) {
      'urgent' => ('Urgent', const Color(0xFFFFEDED), const Color(0xFFDC2626)),
      'high'   => ('High',   const Color(0xFFFFF7E6), const Color(0xFFD97706)),
      'medium' => ('Medium', const Color(0xFFEFF6FF), const Color(0xFF2563EB)),
      _        => ('Low',    const Color(0xFFF0FDF4), const Color(0xFF16A34A)),
    };
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isDark ? fg.withValues(alpha: 0.18) : bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: fg.withValues(alpha: 0.30)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: isDark ? fg.withValues(alpha: 0.90) : fg,
        ),
      ),
    );
  }
}

// ─── DraftStepIndicator ────────────────────────────────────────────────────────

/// Two-step progress bar for India Drafting (Browse → Generate).
class DraftStepIndicator extends StatelessWidget {
  const DraftStepIndicator({
    super.key,
    required this.currentStep,
    required this.accentColor,
    this.steps,
    this.compact = false,
  });

  final int currentStep;
  final Color accentColor;
  final List<String>? steps;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final labels = steps ?? const ['Browse formats', 'Generate draft'];
    final colorScheme = Theme.of(context).colorScheme;

    return Row(
      children: [
        for (int i = 0; i < labels.length; i++) ...[
          if (i > 0) ...[
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOutCubic,
                height: 2,
                color: currentStep >= i
                    ? accentColor
                    : colorScheme.onSurface.withValues(alpha: 0.12),
              ),
            ),
          ],
          Flexible(
            child: _StepDot(
              index: i,
              isActive: currentStep == i,
              isComplete: currentStep > i,
              label: labels[i],
              accentColor: accentColor,
              compact: compact,
            ),
          ),
        ],
      ],
    );
  }
}

class _StepDot extends StatefulWidget {
  const _StepDot({
    required this.index,
    required this.isActive,
    required this.isComplete,
    required this.label,
    required this.accentColor,
    this.compact = false,
  });

  final int index;
  final bool isActive;
  final bool isComplete;
  final String label;
  final Color accentColor;
  final bool compact;

  @override
  State<_StepDot> createState() => _StepDotState();
}

class _StepDotState extends State<_StepDot> with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseScale;
  late final Animation<double> _pulseAlpha;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    _pulseScale = Tween<double>(begin: 1.0, end: 1.85).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeOut),
    );
    _pulseAlpha = Tween<double>(begin: 0.55, end: 0.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeOut),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncPulseAnimation();
  }

  @override
  void didUpdateWidget(_StepDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncPulseAnimation();
  }

  void _syncPulseAnimation() {
    final shouldPulse =
        widget.isActive && !MediaQuery.disableAnimationsOf(context);
    if (shouldPulse) {
      if (!_pulseCtrl.isAnimating) _pulseCtrl.repeat();
    } else {
      _pulseCtrl.stop();
      _pulseCtrl.value = 0;
    }
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final dotColor = (widget.isActive || widget.isComplete)
        ? widget.accentColor
        : colorScheme.onSurface.withValues(alpha: 0.20);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: widget.compact ? 28 : 36,
          height: widget.compact ? 28 : 36,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Pulse ring (only when active and animations enabled)
              if (widget.isActive &&
                  !MediaQuery.disableAnimationsOf(context))
                AnimatedBuilder(
                  animation: _pulseCtrl,
                  builder: (_, __) => Transform.scale(
                    scale: _pulseScale.value,
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: widget.accentColor
                            .withValues(alpha: _pulseAlpha.value),
                      ),
                    ),
                  ),
                ),
              // Dot
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                width: widget.compact ? 20 : 24,
                height: widget.compact ? 20 : 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: dotColor,
                  border: Border.all(
                    color: widget.isActive
                        ? widget.accentColor
                        : colorScheme.onSurface.withValues(alpha: 0.15),
                    width: widget.isActive ? 0 : 1.5,
                  ),
                ),
                child: widget.isComplete
                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                    : Center(
                        child: Text(
                          '${widget.index + 1}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: (widget.isActive || widget.isComplete)
                                ? Colors.white
                                : colorScheme.onSurface.withValues(alpha: 0.40),
                          ),
                        ),
                      ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 2),
        Text(
          widget.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                fontSize: widget.compact ? 10 : null,
                fontWeight:
                    widget.isActive ? FontWeight.w600 : FontWeight.w400,
                color: (widget.isActive || widget.isComplete)
                    ? widget.accentColor
                    : colorScheme.onSurface.withValues(alpha: 0.45),
              ),
        ),
      ],
    );
  }
}

// ─── ShimmerBox ────────────────────────────────────────────────────────────────

/// Shimmer placeholder for loading states. Does not depend on external packages.
class ShimmerBox extends StatefulWidget {
  const ShimmerBox({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 8.0,
  });

  final double width;
  final double height;
  final double borderRadius;

  @override
  State<ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<ShimmerBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: isDark
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.black.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(widget.borderRadius),
        ),
      );
    }
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            gradient: LinearGradient(
              begin: Alignment(-1.0 + _controller.value * 2, 0),
              end: Alignment(1.0 + _controller.value * 2, 0),
              colors: isDark
                  ? [
                      Colors.white.withValues(alpha: 0.04),
                      Colors.white.withValues(alpha: 0.10),
                      Colors.white.withValues(alpha: 0.04),
                    ]
                  : [
                      Colors.black.withValues(alpha: 0.04),
                      Colors.black.withValues(alpha: 0.09),
                      Colors.black.withValues(alpha: 0.04),
                    ],
            ),
          ),
        );
      },
    );
  }
}

// ─── SectionSkeletonCard ───────────────────────────────────────────────────────

/// Shimmer placeholder card shown while Section Finder is loading.
class SectionSkeletonCard extends StatelessWidget {
  const SectionSkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.logoBlueSurface : Colors.white,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ShimmerBox(width: 80, height: 14),
              const SizedBox(width: 8),
              ShimmerBox(width: 20, height: 14),
              const SizedBox(width: 8),
              ShimmerBox(width: 80, height: 14),
            ],
          ),
          const SizedBox(height: 8),
          ShimmerBox(width: double.infinity, height: 12),
          const SizedBox(height: 4),
          ShimmerBox(width: 200, height: 12),
          const SizedBox(height: 10),
          Row(
            children: [
              ShimmerBox(width: 60, height: 22, borderRadius: 20),
              const SizedBox(width: 6),
              ShimmerBox(width: 70, height: 22, borderRadius: 20),
              const SizedBox(width: 6),
              ShimmerBox(width: 80, height: 22, borderRadius: 20),
            ],
          ),
        ],
      ),
    );
  }
}
