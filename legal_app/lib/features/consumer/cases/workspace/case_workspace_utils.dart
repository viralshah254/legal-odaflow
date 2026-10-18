import 'package:flutter/material.dart';

String formatCaseDate(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${date.day} ${months[date.month - 1]} ${date.year}';
}

Color caseStatusColor(String status) {
  switch (status.toLowerCase()) {
    case 'open':
      return Colors.blue;
    case 'pending':
      return Colors.amber.shade700;
    case 'resolved':
      return Colors.green;
    case 'closed':
      return Colors.grey;
    default:
      return Colors.blueGrey;
  }
}

Color caseRiskColor(String? level) {
  switch (level?.toUpperCase()) {
    case 'HIGH':
      return Colors.red;
    case 'MEDIUM':
      return Colors.orange;
    case 'LOW':
      return Colors.green;
    default:
      return Colors.grey;
  }
}

Color ocrStatusColor(String? status) {
  switch (status?.toUpperCase()) {
    case 'COMPLETED':
    case 'COMPLETE':
      return Colors.green;
    case 'FAILED':
    case 'ERROR':
      return Colors.red;
    case 'PROCESSING':
      return Colors.blue;
    default:
      return Colors.orange;
  }
}
