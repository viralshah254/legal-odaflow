import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_page_header.dart';
import '../../../core/widgets/app_section_header.dart';

// ─── Screen ────────────────────────────────────────────────────────────────────

/// AI Command Center — central hub for all AI tools available to the lawyer.
/// Mirrors the web app's /app/ai-tools route.
class AiCommandCenterScreen extends ConsumerWidget {
  const AiCommandCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    final tools = [
      _AiToolCategory(
        label: 'Research & Analysis',
        tools: [
          _AiTool(
            icon: Icons.search_outlined,
            color: const Color(0xFF226FEF),
            title: 'Legal Research',
            description: 'Deep AI-powered legal research across jurisdictions',
            route: '/lawyer/research',
          ),
          _AiTool(
            icon: Icons.manage_search_outlined,
            color: const Color(0xFF7C3AED),
            title: 'Document Review',
            description: 'AI-assisted clause-by-clause review',
            route: '/lawyer/document-review',
          ),
          _AiTool(
            icon: Icons.balance_outlined,
            color: const Color(0xFF14B8A6),
            title: 'Section Finder',
            description: 'Find relevant legal provisions instantly',
            route: '/lawyer/section-finder',
          ),
        ],
      ),
      _AiToolCategory(
        label: 'Drafting',
        tools: [
          _AiTool(
            icon: Icons.edit_note_outlined,
            color: const Color(0xFF7C3AED),
            title: 'DocuDraft',
            description: 'AI document drafting with multi-stage generation',
            route: '/lawyer/docu-draft',
          ),
          _AiTool(
            icon: Icons.description_outlined,
            color: const Color(0xFF8B5CF6),
            title: 'Legal Forms',
            description: 'Official court and government forms',
            route: '/lawyer/forms',
          ),
        ],
      ),
      _AiToolCategory(
        label: 'Matter Intelligence',
        tools: [
          _AiTool(
            icon: Icons.auto_awesome_outlined,
            color: const Color(0xFFF59E0B),
            title: 'Matter AI',
            description: 'Strategy, risk, and outcome analysis per matter',
            route: '/lawyer/matters',
          ),
          _AiTool(
            icon: Icons.radar_rounded,
            color: const Color(0xFF226FEF),
            title: 'Reg. Monitors',
            description: 'Real-time regulatory change tracking',
            route: '/lawyer/monitors',
          ),
        ],
      ),
      _AiToolCategory(
        label: 'Intake & Clients',
        tools: [
          _AiTool(
            icon: Icons.policy_outlined,
            color: const Color(0xFF10B981),
            title: 'Issue Checker',
            description: 'AI legal issue identification for clients',
            route: '/consumer/issue-checker',
          ),
          _AiTool(
            icon: Icons.person_add_outlined,
            color: const Color(0xFF10B981),
            title: 'Client Intake',
            description: 'AI-assisted onboarding questionnaire',
            route: '/lawyer/intake',
          ),
          _AiTool(
            icon: Icons.analytics_outlined,
            color: const Color(0xFF226FEF),
            title: 'FIR Analysis',
            description: 'AI analysis of FIR documents',
            route: '/lawyer/fir-analysis',
          ),
        ],
      ),
    ];

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('AI Command Center'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
        children: [
          AppPageHeader(
            title: 'AI Command Center',
            subtitle: 'All AI tools in one place',
            accentColor: cs.primary,
            padding: const EdgeInsets.fromLTRB(0, 16, 0, 8),
          ),
          // Hero credit usage hint
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  cs.primary.withValues(alpha: 0.15),
                  const Color(0xFF7C3AED).withValues(alpha: 0.12),
                ],
              ),
              borderRadius: BorderRadius.circular(AppColors.radius),
              border: Border.all(
                color: cs.primary.withValues(alpha: 0.25),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.auto_awesome, color: cs.primary, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'AI-powered legal intelligence',
                        style: tt.bodyMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Every tool below is powered by Umbrella legal AI with citation verification.',
                        style: tt.bodySmall?.copyWith(color: muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          for (final category in tools) ...[
            AppSectionHeader(title: category.label),
            const SizedBox(height: 8),
            ...category.tools.indexed.map((record) {
              final i = record.$1;
              final tool = record.$2;
              return Column(
                children: [
                  AppCard(
                    onTap: () => context.go(tool.route),
                    child: Row(
                      children: [
                        AppIconBadge(
                          icon: tool.icon,
                          color: tool.color,
                          size: 44,
                          iconSize: 21,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(tool.title,
                                  style: tt.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w700)),
                              const SizedBox(height: 3),
                              Text(tool.description,
                                  style: tt.bodySmall
                                      ?.copyWith(color: muted),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(Icons.arrow_forward_ios,
                            size: 14, color: muted),
                      ],
                    ),
                  ),
                  if (i < category.tools.length - 1)
                    const SizedBox(height: 8),
                ],
              );
            }),
            const SizedBox(height: 20),
          ],
        ],
      ),
    );
  }
}

class _AiToolCategory {
  final String label;
  final List<_AiTool> tools;
  const _AiToolCategory({required this.label, required this.tools});
}

class _AiTool {
  final IconData icon;
  final Color color;
  final String title;
  final String description;
  final String route;
  const _AiTool({
    required this.icon,
    required this.color,
    required this.title,
    required this.description,
    required this.route,
  });
}
