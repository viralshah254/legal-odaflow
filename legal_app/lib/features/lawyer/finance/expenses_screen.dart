import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_page_header.dart';
import '../../../core/widgets/app_status_badge.dart';

class _Expense {
  const _Expense({
    required this.id,
    required this.description,
    required this.amount,
    required this.category,
    required this.date,
    required this.status,
    this.matterName,
  });

  final String id;
  final String description;
  final double amount;
  final String category;
  final String date;
  final String status;
  final String? matterName;
}

class ExpensesScreen extends ConsumerStatefulWidget {
  const ExpensesScreen({super.key});

  @override
  ConsumerState<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends ConsumerState<ExpensesScreen> {
  String _filter = 'ALL';

  final _expenses = const <_Expense>[
    _Expense(
      id: '1',
      description: 'Court filing fee – Case #2024-001',
      amount: 3500,
      category: 'COURT_FEES',
      date: 'Today',
      status: 'PENDING',
      matterName: 'Sharma v. Kumar',
    ),
    _Expense(
      id: '2',
      description: 'Expert witness fee – Dr. Rajan',
      amount: 25000,
      category: 'EXPERT_FEES',
      date: 'Yesterday',
      status: 'APPROVED',
      matterName: 'Tech Innovations Dispute',
    ),
    _Expense(
      id: '3',
      description: 'Travel – Delhi High Court appearance',
      amount: 8200,
      category: 'TRAVEL',
      date: '3 days ago',
      status: 'REIMBURSED',
      matterName: 'State v. Mehta',
    ),
    _Expense(
      id: '4',
      description: 'Research database subscription',
      amount: 12000,
      category: 'SOFTWARE',
      date: '1 week ago',
      status: 'APPROVED',
    ),
    _Expense(
      id: '5',
      description: 'Courier & document delivery',
      amount: 450,
      category: 'COURIER',
      date: '2 days ago',
      status: 'PENDING',
      matterName: 'Patel Estate Matter',
    ),
  ];

  static const _filterOptions = [
    AppFilterOption(id: 'ALL', label: 'All'),
    AppFilterOption(id: 'PENDING', label: 'Pending'),
    AppFilterOption(id: 'APPROVED', label: 'Approved'),
    AppFilterOption(id: 'REIMBURSED', label: 'Reimbursed'),
  ];

  List<_Expense> get _filtered => _filter == 'ALL'
      ? _expenses
      : _expenses.where((e) => e.status == _filter).toList();

  double get _total => _filtered.fold(0, (s, e) => s + e.amount);

  String _categoryLabel(String cat) => switch (cat) {
        'COURT_FEES' => 'Court Fees',
        'EXPERT_FEES' => 'Expert Fees',
        'TRAVEL' => 'Travel',
        'SOFTWARE' => 'Software',
        'COURIER' => 'Courier',
        _ => cat,
      };

  IconData _categoryIcon(String cat) => switch (cat) {
        'COURT_FEES' => Icons.gavel_outlined,
        'EXPERT_FEES' => Icons.person_outlined,
        'TRAVEL' => Icons.flight_outlined,
        'SOFTWARE' => Icons.computer_outlined,
        'COURIER' => Icons.local_shipping_outlined,
        _ => Icons.receipt_outlined,
      };

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: AppPageHeader(
              title: 'Expenses',
              subtitle:
                  '${filtered.length} expenses · ₹${_total.toStringAsFixed(0)}',
              actions: [
                FilledButton.tonal(
                  onPressed: () => _showAddSheet(context),
                  child: const Text('Add'),
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: AppFilterBar(
              options: _filterOptions,
              selected: _filter,
              onSelected: (f) => setState(() => _filter = f),
            ),
          ),
          if (filtered.isEmpty)
            const SliverToBoxAdapter(
              child: AppEmptyState(
                icon: Icons.receipt_long_outlined,
                label: 'No expenses',
                sublabel: 'Log firm expenses to track costs and bill clients.',
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _ExpenseCard(
                  expense: filtered[i],
                  categoryIcon: _categoryIcon(filtered[i].category),
                  categoryLabel: _categoryLabel(filtered[i].category),
                ),
                childCount: filtered.length,
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddSheet(context),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAddSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          top: 24,
          left: 24,
          right: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Log Expense',
                style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 16),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Description',
                prefixIcon: Icon(Icons.receipt_outlined),
              ),
            ),
            const SizedBox(height: 12),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Amount (₹)',
                prefixIcon: Icon(Icons.currency_rupee),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Save Expense'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpenseCard extends StatelessWidget {
  const _ExpenseCard({
    required this.expense,
    required this.categoryIcon,
    required this.categoryLabel,
  });
  final _Expense expense;
  final IconData categoryIcon;
  final String categoryLabel;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: cs.primaryContainer,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            categoryIcon,
            color: cs.onPrimaryContainer,
            size: 20,
          ),
        ),
        title: Text(
          expense.description,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Row(
              children: [
                AppStatusBadge(status: categoryLabel),
                const SizedBox(width: 8),
                AppStatusBadge(status: expense.status),
              ],
            ),
            if (expense.matterName != null) ...[
              const SizedBox(height: 2),
              Text(
                expense.matterName!,
                style: TextStyle(
                    color: cs.onSurfaceVariant, fontSize: 11),
              ),
            ],
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '₹${expense.amount.toStringAsFixed(0)}',
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 15,
              ),
            ),
            Text(
              expense.date,
              style: TextStyle(
                  color: cs.onSurfaceVariant, fontSize: 11),
            ),
          ],
        ),
        isThreeLine: true,
      ),
    );
  }
}
