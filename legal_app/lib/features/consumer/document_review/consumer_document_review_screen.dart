import 'package:flutter/material.dart';
import '../../lawyer/document_review/document_review_screen.dart';

/// Consumer-facing document review — reuses the same AI-powered screen
/// as the lawyer version. No structural difference in functionality.
class ConsumerDocumentReviewScreen extends StatelessWidget {
  const ConsumerDocumentReviewScreen({super.key});

  @override
  Widget build(BuildContext context) => const DocumentReviewScreen();
}
