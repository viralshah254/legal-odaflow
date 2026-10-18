import 'package:flutter/material.dart';
import '../../lawyer/research/legal_research_screen.dart';

/// Consumer-facing legal research — reuses the same AI-powered screen
/// as the lawyer version. No structural difference in functionality.
class ConsumerResearchScreen extends StatelessWidget {
  const ConsumerResearchScreen({super.key});

  @override
  Widget build(BuildContext context) => const LegalResearchScreen();
}
