import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_error_view.dart';

import '../../../core/providers/app_providers.dart';

class TrustAccount {
  final String id;
  final String name;
  final String? clientId;
  final String currency;
  final double balance;
  final String status;

  TrustAccount({
    required this.id,
    required this.name,
    this.clientId,
    required this.currency,
    required this.balance,
    required this.status,
  });

  factory TrustAccount.fromJson(Map<String, dynamic> j) {
    final raw = j['balance'];
    final balance = raw is num
        ? raw.toDouble()
        : double.tryParse(raw?.toString() ?? '0') ?? 0.0;
    return TrustAccount(
      id: j['id'] as String,
      name: j['name'] as String? ?? 'Trust Account',
      clientId: j['clientId'] as String?,
      currency: j['currency'] as String? ?? 'USD',
      balance: balance,
      status: j['status'] as String? ?? 'ACTIVE',
    );
  }
}

class TrustEntry {
  final String id;
  final String type;
  final double amount;
  final String description;
  final String status;
  final String createdAt;

  TrustEntry({
    required this.id,
    required this.type,
    required this.amount,
    required this.description,
    required this.status,
    required this.createdAt,
  });

  factory TrustEntry.fromJson(Map<String, dynamic> j) => TrustEntry(
        id: j['id'] as String,
        type: j['entryType'] as String? ?? 'DEPOSIT',
        amount: (j['amount'] as num?)?.toDouble() ?? 0.0,
        description: j['description'] as String? ?? '',
        status: j['status'] as String? ?? 'PENDING',
        createdAt: j['createdAt'] as String? ?? '',
      );
}

class TrustScreen extends ConsumerStatefulWidget {
  const TrustScreen({super.key});

  @override
  ConsumerState<TrustScreen> createState() => _TrustScreenState();
}

class _TrustScreenState extends ConsumerState<TrustScreen> {
  List<TrustAccount> _accounts = [];
  bool _loading = true;
  String? _error;
  TrustAccount? _selected;
  List<TrustEntry> _entries = [];
  bool _loadingEntries = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.dio.get<dynamic>('/billing/trust/accounts');
      final list = (resp.data as List<dynamic>? ?? []);
      setState(() {
        _accounts = list.map((e) => TrustAccount.fromJson(e as Map<String, dynamic>)).toList();
        _loading = false;
        if (_accounts.isNotEmpty) _selected = _accounts.first;
      });
      if (_selected != null) await _loadEntries(_selected!.id);
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadEntries(String accountId) async {
    setState(() => _loadingEntries = true);
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.dio.get<dynamic>('/billing/trust/accounts/$accountId');
      final data = resp.data as Map<String, dynamic>? ?? {};
      final entriesData = data['entries'] as List<dynamic>? ?? [];
      setState(() {
        _entries = entriesData.map((e) => TrustEntry.fromJson(e as Map<String, dynamic>)).toList();
      });
    } catch (_) {
      setState(() => _entries = []);
    } finally {
      setState(() => _loadingEntries = false);
    }
  }

  Future<void> _addEntry(String accountId, double amount, String type, String description) async {
    final l10n = AppLocalizations.of(context);
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post<dynamic>('/billing/trust/accounts/$accountId/entries', data: {
        'entryType': type,
        'amount': amount,
        'description': description,
      });
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.commonTrustEntryAdded), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.commonFailedE), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _createAccount(String name, String currency) async {
    final l10n = AppLocalizations.of(context);
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post<dynamic>('/billing/trust/accounts', data: {
        'name': name,
        'currency': currency,
      });
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.commonFailedE), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showAddEntryDialog() {
    if (_selected == null) return;
    final l10n = AppLocalizations.of(context);
    final amountCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String entryType = 'DEPOSIT';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Text(l10n.commonAddTrustEntry),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: entryType,
                decoration: InputDecoration(labelText: l10n.adminType),
                items: ['DEPOSIT', 'WITHDRAWAL', 'DISBURSEMENT', 'REFUND']
                    .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                    .toList(),
                onChanged: (v) => setS(() => entryType = v ?? 'DEPOSIT'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: 'Amount (${_selected!.currency})',
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descCtrl,
                decoration: InputDecoration(
                  labelText: l10n.billingDescription,
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l10n.commonCancel)),
            FilledButton(
              onPressed: () {
                final amt = double.tryParse(amountCtrl.text);
                if (amt == null || amt <= 0) return;
                Navigator.pop(ctx);
                _addEntry(_selected!.id, amt, entryType, descCtrl.text.trim());
              },
              child: Text(l10n.commonAdd),
            ),
          ],
        ),
      ),
    );
  }

  void _showCreateAccountDialog() {
    final l10n = AppLocalizations.of(context);
    final nameCtrl = TextEditingController(text: 'Client Trust Account');
    String currency = 'USD';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Text(l10n.commonCreateTrustAccount),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: l10n.commonAccountName,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: currency,
                decoration: InputDecoration(labelText: l10n.billingCurrency),
                items: ['USD', 'GBP', 'EUR', 'KES', 'INR']
                    .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                    .toList(),
                onChanged: (v) => setS(() => currency = v ?? 'USD'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l10n.commonCancel)),
            FilledButton(
              onPressed: () {
                final name = nameCtrl.text.trim();
                if (name.isEmpty) return;
                Navigator.pop(ctx);
                _createAccount(name, currency);
              },
              child: Text(l10n.commonCreate),
            ),
          ],
        ),
      ),
    );
  }

  Color _entryColor(TrustEntry e) {
    switch (e.type) {
      case 'DEPOSIT':
        return Colors.green;
      case 'WITHDRAWAL':
      case 'DISBURSEMENT':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.commonTrustAccounting),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _load,
          ),
          IconButton(
            icon: const Icon(Icons.add_card),
            tooltip: l10n.lawyerNewAccount,
            onPressed: _showCreateAccountDialog,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : _accounts.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.account_balance_wallet_outlined, size: 64, color: colorScheme.onSurface.withValues(alpha: 0.3)),
                          const SizedBox(height: 16),
                          Text(l10n.commonNoTrustAccounts, style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          Text(l10n.commonCreateATrustAccountToManageClientFunds, style: TextStyle(color: Colors.grey)),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: _showCreateAccountDialog,
                            icon: const Icon(Icons.add),
                            label: Text(l10n.authCreateAccount),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        // Account selector
                        Container(
                          height: 110,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: _accounts.length,
                            itemBuilder: (ctx, i) {
                              final acct = _accounts[i];
                              final isSelected = _selected?.id == acct.id;
                              return GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _selected = acct;
                                    _entries = [];
                                  });
                                  _loadEntries(acct.id);
                                },
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  width: 180,
                                  margin: const EdgeInsets.only(right: 12),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: isSelected ? colorScheme.primary : colorScheme.surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: isSelected ? colorScheme.primary : colorScheme.outline.withValues(alpha: 0.3),
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        acct.name,
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: isSelected ? colorScheme.onPrimary : colorScheme.onSurface,
                                          fontSize: 13,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${acct.currency} ${acct.balance.toStringAsFixed(2)}',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: isSelected ? colorScheme.onPrimary : colorScheme.primary,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        acct.status,
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: isSelected ? colorScheme.onPrimary.withValues(alpha: 0.7) : Colors.grey,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        // Entries
                        Expanded(
                          child: _loadingEntries
                              ? const Center(child: CircularProgressIndicator())
                              : _entries.isEmpty
                                  ? Center(
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey),
                                          const SizedBox(height: 8),
                                          Text(l10n.adminNoEntriesYet, style: TextStyle(color: Colors.grey)),
                                          const SizedBox(height: 16),
                                          FilledButton.icon(
                                            onPressed: _showAddEntryDialog,
                                            icon: const Icon(Icons.add),
                                            label: Text(l10n.commonAddEntry),
                                          ),
                                        ],
                                      ),
                                    )
                                  : ListView.separated(
                                      padding: const EdgeInsets.all(16),
                                      itemCount: _entries.length,
                                      separatorBuilder: (_, __) => const Divider(height: 1),
                                      itemBuilder: (ctx, i) {
                                        final entry = _entries[i];
                                        final isCredit = entry.type == 'DEPOSIT';
                                        return ListTile(
                                          contentPadding: EdgeInsets.zero,
                                          leading: CircleAvatar(
                                            backgroundColor: _entryColor(entry).withValues(alpha: 0.1),
                                            child: Icon(
                                              isCredit ? Icons.arrow_downward : Icons.arrow_upward,
                                              color: _entryColor(entry),
                                              size: 18,
                                            ),
                                          ),
                                          title: Text(entry.description.isNotEmpty ? entry.description : entry.type, style: const TextStyle(fontWeight: FontWeight.w500)),
                                          subtitle: Text('${entry.type} • ${entry.status}', style: const TextStyle(fontSize: 12)),
                                          trailing: Column(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            children: [
                                              Text(
                                                '${isCredit ? '+' : '-'}${_selected?.currency ?? ''} ${entry.amount.toStringAsFixed(2)}',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  color: _entryColor(entry),
                                                ),
                                              ),
                                              if (entry.createdAt.isNotEmpty)
                                                Text(
                                                  entry.createdAt.length >= 10 ? entry.createdAt.substring(0, 10) : entry.createdAt,
                                                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                                                ),
                                            ],
                                          ),
                                        );
                                      },
                                    ),
                        ),
                      ],
                    ),
      floatingActionButton: _accounts.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: _showAddEntryDialog,
              icon: const Icon(Icons.add),
              label: Text(l10n.commonAddEntry),
            )
          : null,
    );
  }
}
