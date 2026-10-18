import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/models/draft_verification.dart';

class SimilarCasesPanel extends StatelessWidget {
  const SimilarCasesPanel({super.key, required this.cases});

  final List<SimilarCase> cases;

  @override
  Widget build(BuildContext context) {
    if (cases.isEmpty) return const SizedBox.shrink();

    return Card(
      child: ExpansionTile(
        initiallyExpanded: false,
        leading: const Icon(Icons.balance_outlined),
        title: Text(
          'Similar cases (${cases.length})',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        subtitle: const Text('Cross-check authorities retrieved for this memo'),
        children: cases.map((c) {
          return ListTile(
            dense: true,
            title: Text(c.title, maxLines: 2, overflow: TextOverflow.ellipsis),
            subtitle: Text(
              [
                if (c.citation != null && c.citation!.isNotEmpty) c.citation!,
                if (c.court != null) c.court!,
                if (c.year != null) c.year!,
                if (c.bindingWeight != null) c.bindingWeight!,
              ].join(' · '),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: c.sourceUrl != null
                ? IconButton(
                    icon: const Icon(Icons.open_in_new, size: 18),
                    onPressed: () => launchUrl(
                      Uri.parse(c.sourceUrl!),
                      mode: LaunchMode.externalApplication,
                    ),
                  )
                : null,
          );
        }).toList(),
      ),
    );
  }
}
