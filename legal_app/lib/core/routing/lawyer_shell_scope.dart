import 'package:flutter/material.dart';

/// Exposes the lawyer shell drawer from nested screen [AppBar]s.
class LawyerShellScope extends InheritedWidget {
  const LawyerShellScope({
    super.key,
    required this.openMenu,
    required super.child,
  });

  final VoidCallback openMenu;

  static LawyerShellScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<LawyerShellScope>();
  }

  static void openMenuDrawer(BuildContext context) {
    maybeOf(context)?.openMenu();
  }

  @override
  bool updateShouldNotify(LawyerShellScope oldWidget) =>
      openMenu != oldWidget.openMenu;
}

class LawyerMenuButton extends StatelessWidget {
  const LawyerMenuButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: MaterialLocalizations.of(context).openAppDrawerTooltip,
      icon: const Icon(Icons.menu),
      onPressed: () => LawyerShellScope.openMenuDrawer(context),
    );
  }
}
